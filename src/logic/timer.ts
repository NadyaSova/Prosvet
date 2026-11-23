// Таймер задания. SPEC.md §7.3.
// Время считается по сохранённым меткам, а не по setInterval: таймер переживает блокировку экрана,
// сворачивание и перезагрузку страницы. Все функции получают текущее время параметром.

import { BALANCE } from '../config/balance';

const MS_PER_MINUTE = 60_000;

export interface TimerState {
  templateId: string;
  startedAt: number;
  durationMs: number;
  /** Момент начала текущей паузы; null — таймер идёт. */
  pausedAt: number | null;
  /** Сколько всего длились завершённые паузы. */
  pausedMs: number;
  pausesUsed: number;
}

export interface TimerSettlement {
  /** Засчитанные минуты. */
  minutes: number;
  /** true — таймер дошёл до конца; false — «закончила раньше». */
  full: boolean;
}

export function startTimer(templateId: string, minutes: number, now: number): TimerState {
  return {
    templateId,
    startedAt: now,
    durationMs: minutes * MS_PER_MINUTE,
    pausedAt: null,
    pausedMs: 0,
    pausesUsed: 0,
  };
}

/** Отработанное время (без пауз), не больше длительности и не меньше нуля. */
export function elapsedMs(t: TimerState, now: number): number {
  const until = t.pausedAt ?? now;
  const raw = until - t.startedAt - t.pausedMs;
  return Math.min(t.durationMs, Math.max(0, raw));
}

export function remainingMs(t: TimerState, now: number): number {
  return t.durationMs - elapsedMs(t, now);
}

export function isFinished(t: TimerState, now: number): boolean {
  return remainingMs(t, now) <= 0;
}

/** Когда таймер закончится (для уведомления и для награды, если приложение было закрыто). null — на паузе. */
export function endsAt(t: TimerState): number | null {
  if (t.pausedAt !== null) return null;
  return t.startedAt + t.pausedMs + t.durationMs;
}

export function canPause(t: TimerState, now: number): boolean {
  return t.pausedAt === null && t.pausesUsed < BALANCE.timer.maxPauses && !isFinished(t, now);
}

export function pauseTimer<T extends TimerState>(t: T, now: number): T {
  if (!canPause(t, now)) throw new Error('Паузу сейчас поставить нельзя');
  return { ...t, pausedAt: now, pausesUsed: t.pausesUsed + 1 };
}

export function resumeTimer<T extends TimerState>(t: T, now: number): T {
  if (t.pausedAt === null) return t;
  return { ...t, pausedAt: null, pausedMs: t.pausedMs + Math.max(0, now - t.pausedAt) };
}

/**
 * Итог таймера: дошёл до конца — все минуты; закончила раньше — целые отработанные минуты.
 * null — отработано меньше минимума, засчитывать нечего (как отмена).
 */
export function settleTimer(t: TimerState, now: number): TimerSettlement | null {
  const fullMinutes = Math.round(t.durationMs / MS_PER_MINUTE);
  if (isFinished(t, now)) return { minutes: fullMinutes, full: true };
  const minutes = Math.floor(elapsedMs(t, now) / MS_PER_MINUTE);
  if (minutes < BALANCE.timer.minPartialMinutes) return null;
  return { minutes, full: false };
}
