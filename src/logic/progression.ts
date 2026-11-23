// Опыт и уровни. SPEC.md §9.1.
// Уровни начинаются с 1. Чтобы перейти с уровня n на n+1, нужно levelStep × n опыта.

import { BALANCE } from '../config/balance';
import type { BranchXp } from '../model/types';

export interface LevelInfo {
  level: number;
  /** Опыт, набранный на текущем уровне. */
  xpIntoLevel: number;
  /** Сколько всего опыта нужно на текущем уровне до следующего. */
  xpForNext: number;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= BALANCE.xp.levelStep * level) {
    rest -= BALANCE.xp.levelStep * level;
    level++;
  }
  return { level, xpIntoLevel: rest, xpForNext: BALANCE.xp.levelStep * level };
}

export function totalXp(xp: BranchXp): number {
  return Object.values(xp).reduce((sum, v) => sum + v, 0);
}

export function titleFor(level: number): string {
  let title: string = BALANCE.level.titles[0].title;
  for (const t of BALANCE.level.titles) if (level >= t.fromLevel) title = t.title;
  return title;
}
