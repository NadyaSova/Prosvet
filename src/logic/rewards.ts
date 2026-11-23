// Награда за засчитанное задание: опыт, золото, карта добычи, серия. SPEC.md §5, §9.
// Чистая функция: состояние игрока, итог задания, время и генератор случайных чисел — на входе.

import { BALANCE } from '../config/balance';
import type { Branch, Day, InstantKind, PlayerState } from '../model/types';
import { drawLoot, type LootCard } from './loot';
import { levelInfo, totalXp } from './progression';
import type { Rng } from './rng';
import { addLog, recordActivity, resolveStreak } from './streak';
import { dayOf } from './time';

export type Completion =
  | { kind: 'timed'; branch: Branch; minutes: number; full: boolean }
  | { kind: 'instant'; branch: Branch; instant: InstantKind };

export interface RewardReport {
  branch: Branch;
  xp: number;
  /** Всё золото за задание, включая золото из карты добычи. */
  gold: number;
  /** Из него — золото из карты добычи (чтобы не раскрывать карту раньше времени). */
  lootGold: number;
  /** null — карта не тянется (досрочное завершение). */
  loot: LootCard | null;
  /** Полено выпало, но запас полон — вместо него дали золото. */
  logConverted: boolean;
  /** Новый общий уровень, если он повысился. */
  newLevel: number | null;
  /** Новый уровень ветки, если он повысился. */
  newBranchLevel: number | null;
  /** Все звёзды за задание: уровни, вехи серии, карта добычи. */
  stars: number;
  streakMilestones: number[];
  logsBurned: number;
  comeback: boolean;
}

function baseReward(c: Completion): { xp: number; gold: number } {
  if (c.kind === 'timed') {
    const round = c.full ? Math.round : Math.floor;
    return {
      xp: c.minutes * BALANCE.xp.perTimedMinute,
      gold: round(c.minutes * BALANCE.gold.perTimedMinute),
    };
  }
  return { xp: BALANCE.xp.instant[c.instant], gold: BALANCE.gold.instant[c.instant] };
}

export function applyCompletion(
  state: PlayerState,
  c: Completion,
  now: number,
  rng: Rng,
): { state: PlayerState; report: RewardReport } {
  const today: Day = dayOf(now);
  const { xp, gold } = baseReward(c);

  // Серия.
  const activity = recordActivity(state.streak, today);
  let streak = activity.streak;
  let stars = activity.milestones.length * BALANCE.streak.starsPerMilestone;

  // Опыт и уровни.
  const oldLevel = levelInfo(totalXp(state.xp)).level;
  const oldBranchLevel = levelInfo(state.xp[c.branch]).level;
  const newXp = { ...state.xp, [c.branch]: state.xp[c.branch] + xp };
  const newLevel = levelInfo(totalXp(newXp)).level;
  const newBranchLevel = levelInfo(newXp[c.branch]).level;
  stars += (newLevel - oldLevel) * BALANCE.level.starsPerOverallLevel;

  // Карта добычи — только за полностью засчитанное задание.
  const fullCompletion = c.kind === 'instant' || c.full;
  const loot = fullCompletion ? drawLoot(rng) : null;
  let lootGold = 0;
  let logConverted = false;
  const inventory = [...state.inventory];
  if (loot) {
    switch (loot.kind) {
      case 'phrase':
      case 'gold':
        lootGold = loot.gold;
        break;
      case 'seed':
      case 'rare':
        inventory.push(loot.item);
        break;
      case 'log': {
        const withLog = addLog(streak);
        if (withLog) streak = withLog;
        else {
          logConverted = true;
          lootGold = BALANCE.loot.logOverflowGold;
        }
        break;
      }
      case 'star':
        stars += 1;
        break;
    }
  }

  const next: PlayerState = {
    ...state,
    xp: newXp,
    gold: state.gold + gold + lootGold,
    stars: state.stars + stars,
    streak,
    branchLastTouched: { ...state.branchLastTouched, [c.branch]: today },
    inventory,
  };

  return {
    state: next,
    report: {
      branch: c.branch,
      xp,
      gold: gold + lootGold,
      lootGold,
      loot,
      logConverted,
      newLevel: newLevel > oldLevel ? newLevel : null,
      newBranchLevel: newBranchLevel > oldBranchLevel ? newBranchLevel : null,
      stars,
      streakMilestones: activity.milestones,
      logsBurned: activity.logsBurned,
      comeback: activity.comeback,
    },
  };
}

/** Проверка серии при открытии приложения: сгоревшие поленья или прерванная серия. */
export function refreshStreak(
  state: PlayerState,
  now: number,
): { state: PlayerState; logsBurned: number; broken: boolean } {
  const r = resolveStreak(state.streak, dayOf(now));
  return { state: r.streak === state.streak ? state : { ...state, streak: r.streak }, logsBurned: r.logsBurned, broken: r.broken };
}
