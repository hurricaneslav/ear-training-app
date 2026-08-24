import { useState, useEffect } from 'react';
import IntervalsSettings from './components/IntervalsSettings.jsx';
import IntervalsExercise from './components/IntervalsExercise.jsx';
import { createInitialProgress, computeUnlockedIds, DEFAULT_ENABLED, UNLOCK_ORDER } from './audio/exerciseEngine.js';
import { api } from './api.js';
import './index.css';

const DEFAULT_SETTINGS = {
  enabled_intervals: [...DEFAULT_ENABLED],
  fixed_root: null,
  direction_mode: 'both',
  instrument: 'piano',
};

// screen: 'home' | 'ear-tab' | 'interval-settings' | 'interval-exercise'
export default function App() {
  const [screen, setScreen] = useState('home');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState(createInitialProgress(DEFAULT_ENABLED));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand?.();
      try { tg.disableVerticalSwipes?.(); } catch (e) {}
    }

    Promise.all([api.getSettings().catch(() => DEFAULT_SETTINGS), api.getProgress().catch(() => ({}))])
      .then(([s, p]) => {
        setSettings(s);
        // добираем прогресс дефолтными нулями для интервалов, у которых ещё нет записи
        const merged = createInitialProgress(UNLOCK_ORDER);
        Object.assign(merged, p);
        setProgress(merged);
        setLoaded(true);
      });
  }, []);

  const unlockedIds = computeUnlockedIds(progress);

  const saveSettings = (next) => {
    setSettings(next);
    api.putSettings(next).catch(() => {});
  };

  if (!loaded) {
    return <div className="app screen center-col"><p className="muted">Загрузка…</p></div>;
  }

  return (
    <div className="app">
      {screen === 'home' && (
        <div className="screen">
          <h1 style={{ marginBottom: 20 }}>Музыкальные упражнения</h1>
          <button className="card-btn" onClick={() => setScreen('ear-tab')}>
            <span>🎧 Развитие слуха</span>
            <span className="muted">›</span>
          </button>
        </div>
      )}

      {screen === 'ear-tab' && (
        <div className="screen">
          <button className="back-btn" onClick={() => setScreen('home')}>‹ Назад</button>
          <h2 style={{ marginBottom: 16 }}>Развитие слуха</h2>
          <button className="card-btn" onClick={() => setScreen('interval-settings')}>
            <span>Интервалы</span>
            <span className="muted">›</span>
          </button>
        </div>
      )}

      {screen === 'interval-settings' && (
        <IntervalsSettings
          settings={settings}
          unlockedIds={unlockedIds}
          onChange={saveSettings}
          onStart={() => setScreen('interval-exercise')}
          onBack={() => setScreen('ear-tab')}
        />
      )}

      {screen === 'interval-exercise' && (
        <IntervalsExercise
          settings={settings}
          unlockedIds={unlockedIds}
          progress={progress}
          setProgress={setProgress}
          onBack={() => setScreen('interval-settings')}
        />
      )}
    </div>
  );
}
