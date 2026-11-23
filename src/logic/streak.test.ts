import { describe, expect, it } from 'vitest';
import type { StreakState } from '../model/types';
import { addLog, deadlineDay, recordActivity, resolveStreak, viewStreak } from './streak';
import { dayOf } from './time';

const D = 20_000; // произвольный номер дня
const empty: StreakState = { startDay: null, lastActiveDay: null, extraDays: 0, logs: 0, milestoneReached: 0 };

function activeOn(...days: number[]): StreakState {
  return days.reduce((s, d) => recordActivity(s, d).streak, empty);
}

describe('правило окна в 3 дня', () => {
  it('первое действие начинает серию', () => {
    const s = activeOn(D);
    expect(s.startDay).toBe(D);
    expect(viewStreak(s, D).value).toBe(1);
  });

  it('после действия в день D последний шанс — день D+3', () => {
    expect(deadlineDay(activeOn(D))).toBe(D + 3);
  });

  it('пропуск двух дней не прерывает серию', () => {
    expect(resolveStreak(activeOn(D), D + 3).broken).toBe(false);
    expect(viewStreak(activeOn(D), D + 3).value).toBe(4);
  });

  it('действие в D+3 ещё спасает серию', () => {
    const s = activeOn(D, D + 3);
    expect(s.startDay).toBe(D);
    expect(s.lastActiveDay).toBe(D + 3);
  });

  it('если D+3 прошёл без действий, серия прерывается', () => {
    const r = resolveStreak(activeOn(D), D + 4);
    expect(r.broken).toBe(true);
    expect(r.streak.startDay).toBeNull();
    expect(viewStreak(activeOn(D), D + 4).value).toBe(0);
  });

  it('действие после прерывания начинает новую серию и отмечается как возвращение', () => {
    const r = recordActivity(activeOn(D), D + 5);
    expect(r.comeback).toBe(true);
    expect(r.streak.startDay).toBe(D + 5);
    expect(viewStreak(r.streak, D + 5).value).toBe(1);
  });

  it('первое в жизни действие — не возвращение', () => {
    expect(recordActivity(empty, D).comeback).toBe(false);
  });

  it('несколько действий в один день ничего не ломают', () => {
    const s = activeOn(D, D, D);
    expect(s).toEqual(activeOn(D));
  });
});

describe('значение серии — календарные дни', () => {
  it('считает все дни с начала серии, включая пропущенные и сегодняшний', () => {
    const s = activeOn(D, D + 3, D + 5);
    expect(viewStreak(s, D + 5).value).toBe(6);
    expect(viewStreak(s, D + 7).value).toBe(8);
  });
});

describe('костёр', () => {
  it('яркость уменьшается к последнему дню', () => {
    const s = activeOn(D);
    expect(viewStreak(s, D).fire).toBe('full');
    expect(viewStreak(s, D + 1).fire).toBe('medium');
    expect(viewStreak(s, D + 2).fire).toBe('low');
    expect(viewStreak(s, D + 3).fire).toBe('embers');
    expect(viewStreak(s, D + 4).fire).toBe('out');
  });

  it('без серии костёр не горит', () => {
    expect(viewStreak(empty, D)).toEqual({ value: 0, fire: 'out', deadlineDay: null, logs: 0 });
  });
});

describe('дрова', () => {
  it('полено продлевает окно на день', () => {
    const s = { ...activeOn(D), logs: 1 };
    const r = resolveStreak(s, D + 4);
    expect(r.broken).toBe(false);
    expect(r.logsBurned).toBe(1);
    expect(r.streak.logs).toBe(0);
    expect(deadlineDay(r.streak)).toBe(D + 4);
    expect(viewStreak(s, D + 4).fire).toBe('embers');
  });

  it('два полена — два дня', () => {
    const s = { ...activeOn(D), logs: 2 };
    const r = resolveStreak(s, D + 5);
    expect(r.broken).toBe(false);
    expect(r.logsBurned).toBe(2);
  });

  it('поленья не сгорают зря, если серию они уже не спасут', () => {
    const s = { ...activeOn(D), logs: 2 };
    const r = resolveStreak(s, D + 6);
    expect(r.broken).toBe(true);
    expect(r.logsBurned).toBe(0);
    expect(r.streak.logs).toBe(2);
  });

  it('пока срок не вышел, поленья не трогаются', () => {
    const s = { ...activeOn(D), logs: 2 };
    expect(resolveStreak(s, D + 3).logsBurned).toBe(0);
  });

  it('после нового активного дня продление сбрасывается', () => {
    const s = recordActivity({ ...activeOn(D), logs: 1 }, D + 4);
    expect(s.logsBurned).toBe(1);
    expect(s.streak.extraDays).toBe(0);
    expect(deadlineDay(s.streak)).toBe(D + 7);
  });

  it('в запасе не больше двух поленьев', () => {
    const one = addLog(empty)!;
    const two = addLog(one)!;
    expect(two.logs).toBe(2);
    expect(addLog(two)).toBeNull();
  });
});

describe('вехи серии', () => {
  it('веха 7 дней даётся один раз за серию', () => {
    let s = activeOn(D, D + 3);
    const r = recordActivity(s, D + 6);
    expect(r.milestones).toEqual([7]);
    s = r.streak;
    expect(recordActivity(s, D + 7).milestones).toEqual([]);
  });

  it('новая серия снова получает вехи', () => {
    const first = recordActivity(activeOn(D, D + 3), D + 6).streak;
    expect(first.milestoneReached).toBe(7);
    const again = recordActivity(first, D + 20); // перерыв — новая серия
    expect(again.streak.milestoneReached).toBe(0);
    let s = again.streak;
    for (let d = D + 21; d <= D + 26; d++) s = recordActivity(s, d).streak;
    expect(s.milestoneReached).toBe(7);
  });
});

describe('серия на реальных датах с переводом часов', () => {
  it('переход на летнее время не прерывает серию и не добавляет лишний день', () => {
    const thu = dayOf(Date.parse('2026-03-26T22:00:00+02:00'));
    const sun = dayOf(Date.parse('2026-03-29T23:30:00+03:00'));
    expect(sun - thu).toBe(3);
    const s = activeOn(thu, sun);
    expect(s.startDay).toBe(thu);
    expect(viewStreak(s, sun).value).toBe(4);
  });

  it('переход на зимнее время: последний шанс всё ещё на третий день', () => {
    const sat = dayOf(Date.parse('2026-10-24T21:00:00+03:00'));
    const lateTue = dayOf(Date.parse('2026-10-27T23:59:00+02:00'));
    const wed = dayOf(Date.parse('2026-10-28T00:01:00+02:00'));
    const s = activeOn(sat);
    expect(resolveStreak(s, lateTue).broken).toBe(false);
    expect(resolveStreak(s, wed).broken).toBe(true);
  });
});
