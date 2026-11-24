import { describe, expect, it } from 'vitest';
import {
  CORRECTION_MAX,
  CORRECTION_MIN,
  canPause,
  correctSettlement,
  elapsedMs,
  nudgeMinutes,
  endsAt,
  isFinished,
  pauseTimer,
  remainingMs,
  resumeTimer,
  settleTimer,
  startTimer,
} from './timer';

const MIN = 60_000;
const T0 = 1_800_000_000_000;

describe('таймер по меткам времени', () => {
  it('считает время от старта', () => {
    const t = startTimer('x', 15, T0);
    expect(elapsedMs(t, T0 + 5 * MIN)).toBe(5 * MIN);
    expect(remainingMs(t, T0 + 5 * MIN)).toBe(10 * MIN);
    expect(endsAt(t)).toBe(T0 + 15 * MIN);
  });

  it('заканчивается ровно по истечении времени, даже если приложение было закрыто', () => {
    const t = startTimer('x', 15, T0);
    expect(isFinished(t, T0 + 15 * MIN - 1)).toBe(false);
    expect(isFinished(t, T0 + 15 * MIN)).toBe(true);
    // Открыла через 3 часа — таймер просто закончен, без переполнения.
    expect(elapsedMs(t, T0 + 180 * MIN)).toBe(15 * MIN);
    expect(settleTimer(t, T0 + 180 * MIN)).toEqual({ minutes: 15, full: true });
  });

  it('часы, переведённые назад, не дают отрицательного времени', () => {
    const t = startTimer('x', 15, T0);
    expect(elapsedMs(t, T0 - 10 * MIN)).toBe(0);
  });
});

describe('пауза', () => {
  it('время на паузе не идёт', () => {
    let t = startTimer('x', 15, T0);
    t = pauseTimer(t, T0 + 5 * MIN);
    expect(elapsedMs(t, T0 + 50 * MIN)).toBe(5 * MIN);
    expect(isFinished(t, T0 + 50 * MIN)).toBe(false);
    expect(endsAt(t)).toBeNull();
    t = resumeTimer(t, T0 + 20 * MIN);
    expect(elapsedMs(t, T0 + 20 * MIN)).toBe(5 * MIN);
    expect(endsAt(t)).toBe(T0 + 30 * MIN);
  });

  it('разрешена только одна пауза', () => {
    let t = startTimer('x', 15, T0);
    expect(canPause(t, T0 + MIN)).toBe(true);
    t = resumeTimer(pauseTimer(t, T0 + MIN), T0 + 2 * MIN);
    expect(canPause(t, T0 + 3 * MIN)).toBe(false);
    expect(() => pauseTimer(t, T0 + 3 * MIN)).toThrow();
  });

  it('нельзя поставить на паузу закончившийся таймер', () => {
    const t = startTimer('x', 5, T0);
    expect(canPause(t, T0 + 5 * MIN)).toBe(false);
  });
});

describe('«закончила раньше»', () => {
  it('засчитывает целые отработанные минуты', () => {
    const t = startTimer('x', 30, T0);
    expect(settleTimer(t, T0 + 12 * MIN + 59_000)).toEqual({ minutes: 12, full: false });
  });

  it('меньше минуты — нечего засчитывать', () => {
    const t = startTimer('x', 30, T0);
    expect(settleTimer(t, T0 + 59_000)).toBeNull();
  });

  it('учитывает паузу', () => {
    let t = startTimer('x', 30, T0);
    t = pauseTimer(t, T0 + 10 * MIN);
    t = resumeTimer(t, T0 + 40 * MIN);
    expect(settleTimer(t, T0 + 45 * MIN)).toEqual({ minutes: 15, full: false });
  });
});

describe('правка времени', () => {
  const t = startTimer('x', 30, T0);

  it('меньше запланированного — как «закончила раньше», столько же и больше — полное', () => {
    expect(correctSettlement(t, 10)).toEqual({ minutes: 10, full: false });
    expect(correctSettlement(t, 30)).toEqual({ minutes: 30, full: true });
    expect(correctSettlement(t, 45)).toEqual({ minutes: 45, full: true });
  });

  it('не выходит за пределы', () => {
    expect(correctSettlement(t, 0)).toEqual({ minutes: CORRECTION_MIN, full: false });
    expect(correctSettlement(t, 10_000).minutes).toBe(CORRECTION_MAX);
    expect(correctSettlement(t, 12.6).minutes).toBe(13);
  });

  it('«−» и «+» — шагом 5 с выравниванием, внизу — по минуте', () => {
    expect(nudgeMinutes(23, 1)).toBe(25);
    expect(nudgeMinutes(25, 1)).toBe(30);
    expect(nudgeMinutes(23, -1)).toBe(20);
    expect(nudgeMinutes(25, -1)).toBe(20);
    expect(nudgeMinutes(7, -1)).toBe(5);
    expect(nudgeMinutes(5, -1)).toBe(4);
    expect(nudgeMinutes(2, -1)).toBe(1);
    expect(nudgeMinutes(1, -1)).toBe(CORRECTION_MIN);
    expect(nudgeMinutes(3, 1)).toBe(5);
    expect(nudgeMinutes(CORRECTION_MAX, 1)).toBe(CORRECTION_MAX);
  });
});
