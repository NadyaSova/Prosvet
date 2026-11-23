// Серия (костёр). SPEC.md §8.
//
// Правило [РЕШЕНО]: после активного дня D дни D+1 и D+2 могут быть пустыми;
// D+3 — последний день, чтобы продлить серию; если и он прошёл без действий — серия прерывается.
// Полено продлевает окно на день. Поленья сгорают, только если это действительно спасает серию:
// если их не хватает, серия прерывается, а поленья остаются в запасе.
//
// Значение серии [РЕШЕНО] — число календарных дней с первого дня серии по сегодня включительно.

import { BALANCE } from '../config/balance';
import type { Day, StreakState } from '../model/types';

export type FireLevel = 'full' | 'medium' | 'low' | 'embers' | 'out';

export interface StreakResolution {
  streak: StreakState;
  /** Сколько поленьев сгорело при этой проверке. */
  logsBurned: number;
  /** Серия прервалась при этой проверке. */
  broken: boolean;
}

export interface ActivityResult {
  streak: StreakState;
  logsBurned: number;
  /** Вехи, достигнутые этим действием (обычно пусто или одна). */
  milestones: number[];
  /** Серия началась заново после перерыва (раньше уже была активность). */
  comeback: boolean;
}

export interface StreakView {
  /** Число дней серии; 0 — серии нет. */
  value: number;
  fire: FireLevel;
  /** Последний день, в который нужно что-то сделать, чтобы серия не прервалась. */
  deadlineDay: Day | null;
  logs: number;
}

function isAlive(s: StreakState): s is StreakState & { startDay: Day; lastActiveDay: Day } {
  return s.startDay !== null && s.lastActiveDay !== null;
}

/** Последний день, в который можно продлить серию. */
export function deadlineDay(s: StreakState): Day | null {
  if (!isAlive(s)) return null;
  return s.lastActiveDay + BALANCE.streak.windowDays + s.extraDays;
}

/** Проверяет серию на сегодня: сжигает поленья, если они спасают серию, или прерывает её. */
export function resolveStreak(s: StreakState, today: Day): StreakResolution {
  const deadline = deadlineDay(s);
  if (deadline === null || today <= deadline) return { streak: s, logsBurned: 0, broken: false };

  const overdue = today - deadline;
  if (overdue <= s.logs) {
    return {
      streak: { ...s, logs: s.logs - overdue, extraDays: s.extraDays + overdue },
      logsBurned: overdue,
      broken: false,
    };
  }
  return {
    streak: { ...s, startDay: null, extraDays: 0, milestoneReached: 0 },
    logsBurned: 0,
    broken: true,
  };
}

/** Число дней серии на сегодня (после resolveStreak). */
function valueOn(s: StreakState, today: Day): number {
  if (s.startDay === null) return 0;
  return Math.max(1, today - s.startDay + 1);
}

/** Засчитывает активный день. */
export function recordActivity(s: StreakState, today: Day): ActivityResult {
  const { streak: resolved, logsBurned } = resolveStreak(s, today);
  let next: StreakState;
  let comeback = false;

  if (isAlive(resolved)) {
    const isNewDay = today > resolved.lastActiveDay;
    next = isNewDay ? { ...resolved, lastActiveDay: today, extraDays: 0 } : resolved;
  } else {
    comeback = resolved.lastActiveDay !== null;
    next = { ...resolved, startDay: today, lastActiveDay: today, extraDays: 0, milestoneReached: 0 };
  }

  const value = valueOn(next, today);
  const milestones = BALANCE.streak.milestones.filter((m) => m > next.milestoneReached && m <= value);
  if (milestones.length > 0) next = { ...next, milestoneReached: Math.max(...milestones) };

  return { streak: next, logsBurned, milestones, comeback };
}

/** Добавляет полено (не больше максимума). Возвращает null, если запас уже полон. */
export function addLog(s: StreakState): StreakState | null {
  if (s.logs >= BALANCE.streak.maxLogs) return null;
  return { ...s, logs: s.logs + 1 };
}

/** Что показать у костра сегодня. Не меняет состояние: поленья «сгорают» только в resolveStreak. */
export function viewStreak(s: StreakState, today: Day): StreakView {
  const { streak } = resolveStreak(s, today);
  const deadline = deadlineDay(streak);
  if (deadline === null || !isAlive(streak)) {
    return { value: 0, fire: 'out', deadlineDay: null, logs: streak.logs };
  }
  const daysLeft = deadline - today;
  let fire: FireLevel;
  if (today <= streak.lastActiveDay) fire = 'full';
  else if (daysLeft >= 2) fire = 'medium';
  else if (daysLeft === 1) fire = 'low';
  else fire = 'embers';
  return { value: valueOn(streak, today), fire, deadlineDay: deadline, logs: streak.logs };
}
