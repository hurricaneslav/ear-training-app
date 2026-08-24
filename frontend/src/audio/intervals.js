// Интервалы: имя, полутона, порядок разблокировки (easy → hard)
// semitones — расстояние вверх от тоники
export const INTERVALS = [
  { id: 'm2',  name: 'Малая секунда',  short: 'm2',  semitones: 1,  order: 4 },
  { id: 'M2',  name: 'Большая секунда', short: 'M2',  semitones: 2,  order: 5 },
  { id: 'm3',  name: 'Малая терция',   short: 'm3',  semitones: 3,  order: 3 },
  { id: 'M3',  name: 'Большая терция', short: 'M3',  semitones: 4,  order: 0 }, // старт
  { id: 'P4',  name: 'Кварта',         short: 'P4',  semitones: 5,  order: 6 },
  { id: 'TT',  name: 'Тритон',         short: 'TT',  semitones: 6,  order: 8 },
  { id: 'P5',  name: 'Квинта',         short: 'P5',  semitones: 7,  order: 1 }, // старт
  { id: 'm6',  name: 'Малая секста',   short: 'm6',  semitones: 8,  order: 7 },
  { id: 'M6',  name: 'Большая секста', short: 'M6',  semitones: 9,  order: 9 },
  { id: 'm7',  name: 'Малая септима',  short: 'm7',  semitones: 10, order: 10 },
  { id: 'M7',  name: 'Большая септима',short: 'M7',  semitones: 11, order: 11 },
  { id: 'P8',  name: 'Октава',         short: 'P8',  semitones: 12, order: 2 }, // старт
];

// Дефолтный набор интервалов, включённый "из коробки"
export const DEFAULT_ENABLED = ['M3', 'P5', 'P8'];

// Порядок разблокировки новых интервалов (после того как дефолтные освоены)
export const UNLOCK_ORDER = [...INTERVALS].sort((a, b) => a.order - b.order).map(i => i.id);

export function getInterval(id) {
  return INTERVALS.find(i => i.id === id);
}

// MIDI note number -> частота в Гц (A4 = MIDI 69 = 440Hz)
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Диапазон для случайной тоники (примерно от C3 до C5 — комфортная зона для угадывания)
export const ROOT_MIDI_MIN = 48; // C3
export const ROOT_MIDI_MAX = 72; // C5

export function randomRootMidi() {
  return ROOT_MIDI_MIN + Math.floor(Math.random() * (ROOT_MIDI_MAX - ROOT_MIDI_MIN + 1));
}
