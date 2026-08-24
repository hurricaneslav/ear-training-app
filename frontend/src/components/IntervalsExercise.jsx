import { useState, useEffect, useCallback, useRef } from 'react';
import { playInterval } from '../audio/player.js';
import { getInterval } from '../audio/intervals.js';
import {
  BAR_MAX,
  getActiveIntervalIds,
  pickRoundInterval,
  generateRound,
  applyAnswer,
} from '../audio/exerciseEngine.js';
import { api } from '../api.js';

// answerState: null (не отвечено) | 'correct' | 'wrong'
export default function IntervalsExercise({ settings, unlockedIds, progress, setProgress, onBack, onUnlock }) {
  const [round, setRound] = useState(null);
  const [answerState, setAnswerState] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const roundLockRef = useRef(false);

  const activeIds = getActiveIntervalIds(settings.enabled_intervals, unlockedIds);

  const startNewRound = useCallback(() => {
    const intervalId = pickRoundInterval(activeIds, progress);
    if (!intervalId) return;
    const r = generateRound({
      intervalId,
      fixedRoot: settings.fixed_root,
      directionMode: settings.direction_mode,
    });
    setRound(r);
    setAnswerState(null);
    setSelectedId(null);
    roundLockRef.current = false;
  }, [activeIds, progress, settings]);

  useEffect(() => {
    startNewRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback(() => {
    if (!round) return;
    const interval = getInterval(round.intervalId);
    setIsPlaying(true);
    const dur = playInterval({
      rootMidi: round.rootMidi,
      semitones: interval.semitones,
      direction: round.direction,
      instrumentId: settings.instrument,
    });
    setTimeout(() => setIsPlaying(false), dur * 1000);
  }, [round, settings.instrument]);

  useEffect(() => {
    if (round) {
      const t = setTimeout(play, 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const handleAnswer = (guessId) => {
    if (roundLockRef.current || !round) return;
    roundLockRef.current = true;

    const isCorrect = guessId === round.intervalId;
    setSelectedId(guessId);
    setAnswerState(isCorrect ? 'correct' : 'wrong');

    const nextProgress = applyAnswer(progress, round.intervalId, isCorrect);
    setProgress(nextProgress);

    const entry = nextProgress[round.intervalId];
    api.postAnswer({
      interval_id: round.intervalId,
      is_correct: isCorrect,
      new_bar: entry.bar,
      mastered: entry.mastered,
    }).catch(() => {});

    if (entry.mastered && onUnlock) {
      onUnlock();
    }

    setTimeout(() => {
      startNewRound();
    }, isCorrect ? 900 : 1400);
  };

  if (!round) {
    return (
      <div className="screen center-col">
        <p>Выбери хотя бы один интервал в настройках.</p>
        <button className="big-btn" onClick={onBack}>‹ Назад</button>
      </div>
    );
  }

  const currentEntry = progress[round.intervalId] || { bar: 0 };
  const fillPct = Math.round((currentEntry.bar / BAR_MAX) * 100);

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>‹ Назад</button>

      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${fillPct}%` }} />
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        {getInterval(round.intervalId).name}: {currentEntry.bar}/{BAR_MAX}
      </p>

      <div className="center-col">
        <button className="play-btn" onClick={play} disabled={isPlaying}>
          {isPlaying ? '♪' : '▶'}
        </button>
        <p className="muted">Нажми, чтобы прослушать снова</p>
      </div>

      <div className="section-title">Какой это интервал?</div>
      <div className="interval-answer-grid">
        {activeIds.map((id) => {
          const iv = getInterval(id);
          let cls = 'interval-answer-btn';
          if (answerState) {
            if (id === round.intervalId) cls += ' correct';
            else if (id === selectedId) cls += ' wrong';
          }
          return (
            <button
              key={id}
              className={cls}
              onClick={() => handleAnswer(id)}
              disabled={!!answerState}
            >
              {iv.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
