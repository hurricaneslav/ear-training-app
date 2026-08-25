import { INTERVALS } from '../audio/intervals.js';
import { INSTRUMENTS } from '../audio/instruments.js';

const DIRECTION_OPTIONS = [
  { id: 'up', label: 'Восходящий' },
  { id: 'down', label: 'Нисходящий' },
  { id: 'both', label: 'Оба' },
  { id: 'harmonic', label: 'Гармонический' },
];

export default function IntervalsSettings({ settings, onChange, onStart, onBack }) {
  const toggleInterval = (id) => {
    const enabled = settings.enabled_intervals.includes(id)
      ? settings.enabled_intervals.filter((x) => x !== id)
      : [...settings.enabled_intervals, id];
    onChange({ ...settings, enabled_intervals: enabled });
  };

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>‹ Назад</button>
      <h2>Интервалы — настройки</h2>

      <div className="section-title">Инструмент</div>
      <div className="row">
        {Object.values(INSTRUMENTS).map((inst) => (
          <button
            key={inst.id}
            className={`pill ${settings.instrument === inst.id ? 'on' : ''}`}
            style={{ flex: 1, textAlign: 'center' }}
            onClick={() => onChange({ ...settings, instrument: inst.id })}
          >
            {inst.name}
          </button>
        ))}
      </div>

      <div className="section-title">Направление</div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {DIRECTION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`pill ${settings.direction_mode === opt.id ? 'on' : ''}`}
            onClick={() => onChange({ ...settings, direction_mode: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="section-title">Фиксировать тонику</div>
      <div className="row">
        <button
          className={`pill ${settings.fixed_root == null ? 'on' : ''}`}
          onClick={() => onChange({ ...settings, fixed_root: null })}
        >
          Случайная нота
        </button>
        <button
          className={`pill ${settings.fixed_root != null ? 'on' : ''}`}
          onClick={() => onChange({ ...settings, fixed_root: 60 })} // C4
        >
          Всегда C
        </button>
      </div>

      <div className="section-title">Интервалы</div>
      <div>
        {INTERVALS.map((iv) => {
          const isOn = settings.enabled_intervals.includes(iv.id);
          return (
            <button
              key={iv.id}
              className={`pill ${isOn ? 'on' : ''}`}
              onClick={() => toggleInterval(iv.id)}
            >
              {iv.short}
            </button>
          );
        })}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Если выбрано несколько интервалов, они будут открываться постепенно по мере прохождения — сначала простые, затем сложнее.
      </p>

      <button
        className="big-btn primary"
        onClick={onStart}
        disabled={settings.enabled_intervals.length === 0}
      >
        Начать
      </button>
    </div>
  );
}
