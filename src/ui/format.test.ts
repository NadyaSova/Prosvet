import { describe, expect, it } from 'vitest';
import { dayOf } from '../logic/time';
import { agoText, clockText, daysText, durationText, fireText, minutesText, stopwatchText } from './format';

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

describe('секундомер и длительности боссов', () => {
  it('секундомер: минуты и секунды, с часа — часы', () => {
    expect(stopwatchText(0)).toBe('0:00');
    expect(stopwatchText(59_999)).toBe('0:59');
    expect(stopwatchText(12 * 60_000 + 5_000)).toBe('12:05');
    expect(stopwatchText(3_600_000 + 2 * 60_000 + 5_000)).toBe('1:02:05');
  });

  it('длительность и «сколько дней назад»', () => {
    expect(durationText(40)).toBe('40 минут');
    expect(durationText(135)).toBe('2 ч 15 мин');
    expect(durationText(180)).toBe('3 ч');
    expect(agoText(0)).toBe('сегодня');
    expect(agoText(1)).toBe('вчера');
    expect(agoText(5)).toBe('5 дней назад');
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
