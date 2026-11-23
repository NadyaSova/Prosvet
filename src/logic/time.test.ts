import { describe, expect, it } from 'vitest';
import { dayEnd, dayOf, dayStart } from './time';

const HOUR = 3_600_000;

describe('часовой пояс тестов', () => {
  it('тесты идут по времени Израиля', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Asia/Jerusalem');
    // Зимой UTC+2, летом UTC+3.
    expect(new Date('2026-01-15T12:00:00Z').getTimezoneOffset()).toBe(-120);
    expect(new Date('2026-07-15T12:00:00Z').getTimezoneOffset()).toBe(-180);
  });
});

describe('dayOf', () => {
  it('один и тот же день с полуночи до полуночи по местному времени', () => {
    const morning = new Date(2026, 10, 23, 0, 0).getTime();
    const night = new Date(2026, 10, 23, 23, 59).getTime();
    expect(dayOf(morning)).toBe(dayOf(night));
    expect(dayOf(night + 60_000)).toBe(dayOf(night) + 1);
  });

  it('день считается по местному времени, а не по UTC', () => {
    // 23:30 по Израилю — это ещё 21:30 по UTC того же дня; 00:30 по Израилю — уже следующий день.
    const before = Date.parse('2026-01-15T23:30:00+02:00');
    const after = Date.parse('2026-01-16T00:30:00+02:00');
    expect(dayOf(after) - dayOf(before)).toBe(1);
  });

  it('переход на летнее время (27.03.2026): сутки в 23 часа — один день', () => {
    const start = dayStart(dayOf(Date.parse('2026-03-27T12:00:00+03:00')));
    const end = dayEnd(dayOf(start));
    expect(end - start).toBe(23 * HOUR);
    expect(dayOf(start)).toBe(dayOf(end - 1));
    expect(dayOf(end)).toBe(dayOf(start) + 1);
  });

  it('переход на зимнее время (25.10.2026): сутки в 25 часов — один день', () => {
    const start = dayStart(dayOf(Date.parse('2026-10-25T12:00:00+02:00')));
    const end = dayEnd(dayOf(start));
    expect(end - start).toBe(25 * HOUR);
    expect(dayOf(start)).toBe(dayOf(end - 1));
    expect(dayOf(end)).toBe(dayOf(start) + 1);
  });

  it('дни идут подряд через переходы времени', () => {
    let ts = new Date(2026, 0, 1, 12, 0).getTime();
    let prev = dayOf(ts);
    for (let i = 0; i < 365; i++) {
      ts = new Date(new Date(ts).getFullYear(), new Date(ts).getMonth(), new Date(ts).getDate() + 1, 12).getTime();
      const d = dayOf(ts);
      expect(d).toBe(prev + 1);
      prev = d;
    }
  });
});

describe('dayStart', () => {
  it('возвращает местную полночь', () => {
    const day = dayOf(new Date(2026, 10, 23, 15, 0).getTime());
    expect(dayStart(day)).toBe(new Date(2026, 10, 23).getTime());
  });
});
