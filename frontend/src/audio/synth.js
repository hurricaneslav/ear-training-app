// Базовый аудио-движок на чистом Web Audio API.
// Частота ноты вычисляется напрямую по формуле (см. intervals.js midiToFreq) —
// это гарантирует идеальный строй, в отличие от сэмплов, где возможна расстройка.

let ctx = null;
let masterOut = null;

export function getAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

// Единая выходная точка для ВСЕХ звуков. Позволяет мгновенно заглушить
// всё что играет сейчас (см. stopAllSounds) — без этого повторные нажатия
// "▶" или быстрый переход между раундами накапливают звуки друг на друга.
export function getMasterOut() {
  const audioCtx = getAudioContext();
  if (!masterOut || masterOut.context !== audioCtx) {
    masterOut = audioCtx.createGain();
    masterOut.gain.value = 1;
    masterOut.connect(audioCtx.destination);
  }
  return masterOut;
}

// Мгновенно обрывает всё текущее звучание: отключаем старый master (все ноды,
// которые в него играли, теряют путь к destination и просто "проваливаются в тишину"
// без щелчка благодаря быстрому fade), и создаём новый чистый master для следующего звука.
export function stopAllSounds() {
  const audioCtx = getAudioContext();
  if (masterOut) {
    try {
      const now = audioCtx.currentTime;
      masterOut.gain.cancelScheduledValues(now);
      masterOut.gain.setValueAtTime(masterOut.gain.value, now);
      masterOut.gain.linearRampToValueAtTime(0, now + 0.02); // короткий fade, без щелчка
      masterOut.disconnect(audioCtx.destination);
    } catch (e) {
      // no-op — если нода уже отключена
    }
  }
  masterOut = null; // следующий getMasterOut() создаст новый чистый узел
}

// iOS Safari (и WKWebView внутри Telegram, который на iOS ВСЕГДА использует движок
// Safari — так требует сама Apple) требует, чтобы создание/resume AudioContext
// произошло СИНХРОННО внутри обработчика user gesture (клик/тап), иначе звук
// навсегда останется заблокирован для этого контекста. Вызывать эту функцию
// напрямую в onClick, без await/setTimeout перед вызовом getAudioContext().
export function unlockAudioContext() {
  const audioCtx = getAudioContext();
  if (audioCtx.state === 'suspended') {
    // resume() асинхронный — само его вызывание не гарантирует, что context
    // уже 'running' к моменту, когда мы начнём планировать ноты через currentTime.
    // Если контекст всё ещё suspended в момент планирования, события просто
    // никогда не наступают - без единой ошибки в консоли, просто тишина.
    audioCtx.resume();
  }
  // Беззвучный буфер синхронно в жесте - "будит" аудио-подсистему на iOS
  // даже когда resume() ещё не успел зарезолвиться.
  const buffer = audioCtx.createBuffer(1, 1, 22050);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0);
  return audioCtx;
}

// Гарантирует, что контекст реально 'running' перед тем как планировать звук.
// В отличие от unlockAudioContext (синхронный "будильник" для user gesture),
// это асинхронная подстраховка — используется прямо перед планированием нот,
// чтобы не потерять события, если resume() из клика ещё не успел завершиться.
export async function ensureAudioRunning() {
  const audioCtx = getAudioContext();
  if (audioCtx.state !== 'running') {
    try {
      await audioCtx.resume();
    } catch (e) {
      // no-op — попытка сделана, дальше играем как есть
    }
  }
  return audioCtx;
}

// ADSR envelope применяется к GainNode
// times в секундах, sustainLevel 0..1 (относительно peak=1)
function applyEnvelope(gainNode, startTime, { attack, decay, sustain, release, duration }) {
  const g = gainNode.gain;
  g.cancelScheduledValues(startTime);
  g.setValueAtTime(0, startTime);
  g.linearRampToValueAtTime(1, startTime + attack);
  g.linearRampToValueAtTime(sustain, startTime + attack + decay);
  // держим sustain до начала release
  const releaseStart = startTime + duration - release;
  g.setValueAtTime(sustain, Math.max(releaseStart, startTime + attack + decay));
  g.linearRampToValueAtTime(0.0001, startTime + duration);
}

export function createOscVoice(audioCtx, { freq, type = 'sine', detuneCents = 0, gain = 1 }) {
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detuneCents;
  const g = audioCtx.createGain();
  g.gain.value = gain;
  osc.connect(g);
  return { osc, gain: g };
}

export { applyEnvelope };
