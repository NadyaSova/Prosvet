import { describe, expect, it } from 'vitest';
import { levelInfo, titleFor, totalXp } from './progression';

describe('уровни', () => {
  it('порог уровня n — 50 × n опыта сверх предыдущего', () => {
    expect(levelInfo(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 50 });
    expect(levelInfo(49).level).toBe(1);
    expect(levelInfo(50)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 100 });
    expect(levelInfo(149).level).toBe(2);
    expect(levelInfo(150)).toEqual({ level: 3, xpIntoLevel: 0, xpForNext: 150 });
    expect(levelInfo(310)).toEqual({ level: 4, xpIntoLevel: 10, xpForNext: 200 });
  });

  it('общий опыт — сумма веток', () => {
    expect(totalXp({ chronicle: 10, image: 20, speech: 0, scouting: 5, hunt: 15 })).toBe(50);
  });
});

describe('титулы', () => {
  it('зависят от общего уровня', () => {
    expect(titleFor(1)).toBe('Путница');
    expect(titleFor(2)).toBe('Путница');
    expect(titleFor(3)).toBe('Следопытка');
    expect(titleFor(40)).toBe('Хранительница долины');
  });
});
