import { getAudioContext, stopAllSounds } from './synth.js';
import { midiToFreq } from './intervals.js';
import { INSTRUMENTS } from './instruments.js';

const NOTE_DURATION = 1.1; // сек, длительность одной ноты
const GAP = 0.15; // сек, пауза между нотами при последовательном воспроизведении

// direction: 'up' | 'down' | 'harmonic'
// (режим 'both' в UI — это случайный выбор 'up'/'down' на каждый раунд, см. exerciseEngine)
export function playInterval({ rootMidi, semitones, direction, instrumentId = 'piano' }) {
  // Обрываем всё, что могло остаться играть с прошлого вызова (например, если
  // пользователь быстро нажал "▶" повторно или начался новый раунд) — иначе
  // звуки накладываются друг на друга и создают ощущение "лага"/очереди.
  stopAllSounds();

  const audioCtx = getAudioContext();
  const instrument = INSTRUMENTS[instrumentId] || INSTRUMENTS.piano;
  const now = audioCtx.currentTime + 0.05; // небольшой запас на планирование

  const lowMidi = rootMidi;
  const highMidi = rootMidi + semitones;

  if (direction === 'harmonic') {
    instrument.play(midiToFreq(lowMidi), now, NOTE_DURATION);
    instrument.play(midiToFreq(highMidi), now, NOTE_DURATION);
    return NOTE_DURATION;
  }

  const firstMidi = direction === 'down' ? highMidi : lowMidi;
  const secondMidi = direction === 'down' ? lowMidi : highMidi;

  instrument.play(midiToFreq(firstMidi), now, NOTE_DURATION);
  instrument.play(midiToFreq(secondMidi), now + NOTE_DURATION + GAP, NOTE_DURATION);

  return NOTE_DURATION * 2 + GAP;
}
