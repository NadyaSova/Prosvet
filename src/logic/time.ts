import type { Day } from '../model/types';

const MS_PER_DAY = 86_400_000;

/**
 * Номер календарного дня по местному времени телефона.
 * Берём местную дату (год, месяц, число) и считаем дни от 1970-01-01 по ней,
 * поэтому переход на летнее/зимнее время не сдвигает дни: сутки в 23 или 25 часов — всё равно один день.
 */
export function dayOf(timestamp: number): Day {
  const d = new Date(timestamp);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);
}

/** Момент местной полуночи, с которой начинается день. */
export function dayStart(day: Day): number {
  const d = new Date(day * MS_PER_DAY);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
}

/** Момент, когда день заканчивается (= начало следующего). */
export function dayEnd(day: Day): number {
  return dayStart(day + 1);
}
