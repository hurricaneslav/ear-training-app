// Базовый аудио-движок на чистом Web Audio API.
// Частота ноты вычисляется напрямую по формуле (см. intervals.js midiToFreq) —
// это гарантирует идеальный строй, в отличие от сэмплов, где возможна расстройка.

let ctx = null;

export function getAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // На iOS/Telegram WebView контекст может быть suspended до первого user gesture
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
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
