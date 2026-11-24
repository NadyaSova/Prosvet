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

/** Запланированные минуты таймера. */
export function plannedMinutes(t: TimerState): number {
  return Math.round(t.durationMs / MS_PER_MINUTE);
}

/** Пределы правки времени. */
export const CORRECTION_MIN = BALANCE.timer.minPartialMinutes;
export const CORRECTION_MAX = BALANCE.timer.maxCorrectedMinutes;

/**
 * Правка времени при остановке (docs/phase2-plan.md §3), в обе стороны: засчитываются вписанные минуты.
 * Запланированное время и больше — как полный таймер, с картой добычи; меньше — как «закончила раньше».
 */
export function correctSettlement(t: TimerState, minutes: number): TimerSettlement {
  const m = Math.min(CORRECTION_MAX, Math.max(CORRECTION_MIN, Math.round(minutes)));
  return { minutes: m, full: m >= plannedMinutes(t) };
}

/**
 * Кнопки «−» и «+» в правке времени: шаг BALANCE.timer.correctionStep с выравниванием на кратное шагу
 * (23 → 25 или 20); на шаге и ниже «−» убавляет по минуте. Не выходит за пределы правки.
 */
export function nudgeMinutes(minutes: number, dir: 1 | -1): number {
  const step = BALANCE.timer.correctionStep;
  let next: number;
  if (dir > 0) next = minutes < step ? step : Math.floor(minutes / step) * step + step;
  else if (minutes <= step) next = minutes - 1;
  else next = Math.ceil(minutes / step) * step - step;
  return Math.min(CORRECTION_MAX, Math.max(CORRECTION_MIN, next));
}

/**
 * Итог таймера: дошёл до конца — все минуты; закончила раньше — целые отработанные минуты.
 * null — отработано меньше минимума, засчитывать нечего (как отмена).
 */
export function settleTimer(t: TimerState, now: number): TimerSettlement | null {
  if (isFinished(t, now)) return { minutes: plannedMinutes(t), full: true };
  const minutes = Math.floor(elapsedMs(t, now) / MS_PER_MINUTE);
  if (minutes < BALANCE.timer.minPartialMinutes) return null;
  return { minutes, full: false };
}
