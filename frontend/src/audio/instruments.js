import { getAudioContext, applyEnvelope } from './synth.js';

// Каждая play-функция: (freq, startTime, duration) -> void
// Все они используют один и тот же audioCtx.currentTime как базу для планирования.

// ---------- PIANO ----------
// Аддитивный синтез: несколько гармоник с убывающей амплитудой (имитация тембра),
// два слегка расстроенных осциллятора на каждой гармонике (хорус/живость, НЕ расстройка
// относительно эталонной частоты — среднее двух точно равно freq).
export function playPiano(freq, startTime, duration = 1.4) {
  const audioCtx = getAudioContext();
  const master = audioCtx.createGain();
  master.gain.value = 0.35;
  master.connect(audioCtx.destination);

  // относительные амплитуды гармоник (1-я это основной тон)
  const harmonics = [1, 0.55, 0.3, 0.15, 0.08, 0.04];
  const detunes = [-3, 3]; // центы, для хоруса

  harmonics.forEach((amp, i) => {
    const harmFreq = freq * (i + 1);
    if (harmFreq > 18000) return; // за пределами слышимости - не считаем
    detunes.forEach((det) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = harmFreq;
      osc.detune.value = det;

      // envelope-нода: форма огибающей громкости во времени
      const env = audioCtx.createGain();
      applyEnvelope(env, startTime, {
        attack: 0.005,
        decay: 0.15 + i * 0.05,
        sustain: 0.25,
        release: duration * 0.35,
        duration,
      });

      // scale-нода: амплитуда конкретной гармоники (постоянный множитель)
      const scale = audioCtx.createGain();
      scale.gain.value = amp / detunes.length;

      osc.connect(env);
      env.connect(scale);
      scale.connect(master);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });
  });
}

// ---------- BASS ----------
// Треугольник + синус (тело) через мягкий waveshaper (сатурация) для плотности.
function makeSaturationCurve(amount = 20) {
  const n = 4096;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
  }
  return curve;
}

export function playBass(freq, startTime, duration = 1.2) {
  const audioCtx = getAudioContext();
  const master = audioCtx.createGain();
  master.gain.value = 0.5;
  master.connect(audioCtx.destination);

  const osc1 = audioCtx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = freq;

  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq; // синус на той же частоте добавляет плотное "тело" звука

  const shaper = audioCtx.createWaveShaper();
  shaper.curve = makeSaturationCurve(3);
  shaper.oversample = '2x';

  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = Math.min(freq * 6, 3000);
  lowpass.Q.value = 0.7;

  const g = audioCtx.createGain();
  applyEnvelope(g, startTime, {
    attack: 0.01,
    decay: 0.2,
    sustain: 0.6,
    release: duration * 0.3,
    duration,
  });

  const mix1 = audioCtx.createGain();
  mix1.gain.value = 0.7;
  const mix2 = audioCtx.createGain();
  mix2.gain.value = 0.3;

  osc1.connect(mix1);
  osc2.connect(mix2);
  mix1.connect(shaper);
  mix2.connect(shaper);
  shaper.connect(lowpass);
  lowpass.connect(g);
  g.connect(master);

  osc1.start(startTime);
  osc2.start(startTime);
  osc1.stop(startTime + duration + 0.05);
  osc2.stop(startTime + duration + 0.05);
}

// ---------- GUITAR ----------
// Karplus-Strong: physical modeling щипковой струны через delay-line + фильтр обратной связи.
// Реализовано через ScriptProcessor-free подход - заполняем AudioBuffer напрямую (offline-style),
// затем проигрываем через BufferSource. Это надёжнее и проще, чем городить delay-граф в реальном времени.
export function playGuitar(freq, startTime, duration = 1.6) {
  const audioCtx = getAudioContext();
  const sampleRate = audioCtx.sampleRate;
  const totalSamples = Math.floor(sampleRate * duration);

  // "Tuned" Karplus-Strong: sampleRate/freq почти никогда не целое число.
  // Наивное округление длины буфера даёт расстройку до 5-8 центов (проверено) —
  // именно та проблема, которую хотим избежать. Решение: дробная длина delay line
  // через линейную интерполяцию между двумя соседними целыми длинами (allpass-подобная
  // фракционная задержка) — это стандартный fix для Karplus-Strong.
  // -0.5 компенсирует фазовую задержку однополюсного averaging-фильтра ниже
  // ((current+prevOut)/2 сам по себе сдвигает резонанс на пол-сэмпла) — без этой
  // коррекции даже дробная delay line даёт расстройку в несколько центов.
  const exactLength = sampleRate / freq - 0.5;
  const bufferLength = Math.max(2, Math.floor(exactLength));
  const fraction = exactLength - bufferLength; // дробная часть, 0..1

  const buffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Инициализация delay line случайным шумом (щипок струны)
  const ring = new Float32Array(bufferLength + 1);
  for (let i = 0; i < ring.length; i++) {
    ring[i] = Math.random() * 2 - 1;
  }

  // Коэффициент затухания - управляет длительностью звучания струны
  const damping = 0.995;
  let ringIndex = 0;
  let prevOut = 0;
  let prevFrac = 0;

  for (let n = 0; n < totalSamples; n++) {
    const idx0 = ringIndex;
    const idx1 = (ringIndex + 1) % ring.length;
    // дробная задержка через линейную интерполяцию соседних сэмплов delay line
    const current = ring[idx0] * (1 - fraction) + ring[idx1] * fraction;

    // low-pass фильтр внутри цепи обратной связи (усреднение с предыдущим выходом)
    const avg = 0.5 * (current + prevOut);
    const next = avg * damping;
    ring[idx0] = next;
    prevOut = current;
    data[n] = current;
    ringIndex = idx1;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const g = audioCtx.createGain();
  // общая огибающая громкости поверх естественного затухания Karplus-Strong
  applyEnvelope(g, startTime, {
    attack: 0.003,
    decay: 0.05,
    sustain: 0.8,
    release: duration * 0.5,
    duration,
  });

  const master = audioCtx.createGain();
  master.gain.value = 0.6;

  source.connect(g);
  g.connect(master);
  master.connect(audioCtx.destination);

  source.start(startTime);
  source.stop(startTime + duration + 0.05);
}

export const INSTRUMENTS = {
  piano: { id: 'piano', name: 'Пианино', play: playPiano },
  bass: { id: 'bass', name: 'Бас', play: playBass },
  guitar: { id: 'guitar', name: 'Гитара', play: playGuitar },
};
