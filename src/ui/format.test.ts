import { describe, expect, it } from 'vitest';
import { dayOf } from '../logic/time';
import { clockText, daysText, fireText, minutesText } from './format';

describe('склонение', () => {
  it('минуты и дни', () => {
    expect(minutesText(1)).toBe('1 минута');
    expect(minutesText(3)).toBe('3 минуты');
    expect(minutesText(5)).toBe('5 минут');
    expect(minutesText(11)).toBe('11 минут');
    expect(minutesText(21)).toBe('21 минута');
    expect(minutesText(25)).toBe('25 минут');
    expect(daysText(2)).toBe('2 дня');
    expect(daysText(14)).toBe('14 дней');
  });
});

describe('часы таймера', () => {
  it('минуты и секунды, секунды вверх', () => {
    expect(clockText(25 * 60_000)).toBe('25:00');
    expect(clockText(59_001)).toBe('1:00');
    expect(clockText(500)).toBe('0:01');
    expect(clockText(0)).toBe('0:00');
  });
});

describe('подпись костра', () => {
  const today = dayOf(new Date(2026, 10, 23, 12).getTime()); // понедельник
  const view = (deadlineDay: number | null) => ({ value: 1, fire: 'full' as const, deadlineDay, logs: 0 });

  it('по дням до конца окна', () => {
    expect(fireText(view(today + 3), today, true)).toBe('Огонь горит до конца четверга, 26 ноября.');
    expect(fireText(view(today + 1), today, true)).toBe('Огонь горит до конца завтрашнего дня.');
    expect(fireText(view(today), today, true)).toMatch(/сегодня последний день/);
  });

  it('без серии', () => {
    expect(fireText(view(null), today, false)).toBe('Костёр ждёт первого задания.');
    expect(fireText(view(null), today, true)).toMatch(/погас/);
  });
});
