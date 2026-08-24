import { INTERVALS, UNLOCK_ORDER, DEFAULT_ENABLED, randomRootMidi } from './intervals.js';

export const BAR_MAX = 10;      // сколько правильных ответов подряд-эквивалент нужно чтобы заполнить шкалу
export const FILL_STEP = 1;     // на сколько заполняется шкала за правильный ответ
export const PENALTY_STEP = 2;  // на сколько откатывается шкала за неправильный ответ

// Состояние прогресса — одна шкала (bar) на КАЖДЫЙ включённый интервал.
// Когда шкала интервала полностью заполнена, следующий интервал в UNLOCK_ORDER разблокируется.
export function createInitialProgress(enabledIds) {
  const progress = {};
  enabledIds.forEach((id) => {
    progress[id] = { bar: 0, mastered: false };
  });
  return progress;
}

// Список интервалов, которые СЕЙЧАС активны в раунде: включённые пользователем
// ИЛИ уже разблокированные через прогресс, но ещё не мастер-нутые считаются активными для повторения.
// Простая модель: активен = enabled AND (в базовом наборе ИЛИ уже разблокирован).
export function getActiveIntervalIds(enabledIds, unlockedIds) {
  return enabledIds.filter((id) => unlockedIds.includes(id));
}

// Следующий интервал для разблокировки — первый в UNLOCK_ORDER, который включён пользователем,
// но ещё не разблокирован.
export function getNextToUnlock(enabledIds, unlockedIds) {
  return UNLOCK_ORDER.find((id) => enabledIds.includes(id) && !unlockedIds.includes(id)) || null;
}

// Выбирает случайный интервал из активного пула (взвешенно - немастер-нутые чаще)
export function pickRoundInterval(activeIds, progress) {
  const weighted = [];
  activeIds.forEach((id) => {
    const p = progress[id];
    const weight = p && p.mastered ? 1 : 3; // ещё не освоенные встречаются чаще
    for (let i = 0; i < weight; i++) weighted.push(id);
  });
  if (weighted.length === 0) return activeIds[0] || null;
  return weighted[Math.floor(Math.random() * weighted.length)];
}

// Генерирует параметры одного раунда
export function generateRound({ intervalId, fixedRoot, directionMode, allowedDirections }) {
  const rootMidi = fixedRoot != null ? fixedRoot : randomRootMidi();
  let direction;
  if (directionMode === 'harmonic') {
    direction = 'harmonic';
  } else if (directionMode === 'both') {
    direction = Math.random() < 0.5 ? 'up' : 'down';
  } else {
    direction = directionMode; // 'up' | 'down'
  }
  return { intervalId, rootMidi, direction };
}

// Применяет результат ответа к прогрессу. Возвращает { progress, justUnlocked }.
export function applyAnswer(progress, intervalId, isCorrect) {
  const next = { ...progress };
  const cur = next[intervalId] || { bar: 0, mastered: false };
  let bar = cur.bar + (isCorrect ? FILL_STEP : -PENALTY_STEP);
  bar = Math.max(0, Math.min(BAR_MAX, bar));
  const mastered = bar >= BAR_MAX;
  next[intervalId] = { bar, mastered };
  return next;
}

// Вычисляет полный список разблокированных интервалов на основе прогресса.
// Правило: DEFAULT_ENABLED разблокированы всегда; каждый следующий в UNLOCK_ORDER
// открывается только если ВСЕ интервалы перед ним (в порядке UNLOCK_ORDER, не входящие
// в DEFAULT_ENABLED) уже mastered.
export function computeUnlockedIds(progress) {
  const unlocked = new Set(DEFAULT_ENABLED);
  let allPriorMastered = true;
  for (const id of UNLOCK_ORDER) {
    if (DEFAULT_ENABLED.includes(id)) continue;
    if (allPriorMastered) unlocked.add(id);
    const entry = progress[id];
    if (!entry || !entry.mastered) allPriorMastered = false;
  }
  return Array.from(unlocked);
}

export { INTERVALS, UNLOCK_ORDER, DEFAULT_ENABLED };
