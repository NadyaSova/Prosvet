// Форматирование чисел, времени и дат для интерфейса.

import type { StreakView } from '../logic/streak';
import { dayStart } from '../logic/time';
import type { Day } from '../model/types';

/** Русское склонение по числу: plural(5, ['минута', 'минуты', 'минут']) → «минут». */
export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export const minutesText = (n: number) => `${n} ${plural(n, ['минута', 'минуты', 'минут'])}`;
export const daysText = (n: number) => `${n} ${plural(n, ['день', 'дня', 'дней'])}`;

/** Оставшееся время таймера: «24:59». Секунды округляются вверх, чтобы 0:00 было только в самом конце. */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const WEEKDAY_GENITIVE = ['воскресенья', 'понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы'];
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

/** «23 ноября». */
export const dateText = (timestamp: number) => dayMonth.format(new Date(timestamp));

export const feathersText = (n: number) => `${n} ${plural(n, ['перо', 'пера', 'перьев'])}`;

/** Подпись под числом серии: до какого дня горит огонь. */
export function fireText(view: StreakView, today: Day, everActive: boolean): string {
  if (view.deadlineDay === null) {
    return everActive ? 'Костёр погас. Любое задание разожжёт его снова.' : 'Костёр ждёт первого задания.';
  }
  const left = view.deadlineDay - today;
  if (left <= 0) return 'Угли тлеют: сегодня последний день, чтобы сохранить серию.';
  if (left === 1) return 'Огонь горит до конца завтрашнего дня.';
  const date = new Date(dayStart(view.deadlineDay));
  return `Огонь горит до конца ${WEEKDAY_GENITIVE[date.getDay()]}, ${dayMonth.format(date)}.`;
}
