// Награда за засчитанное задание: опыт, золото, карта добычи, серия. SPEC.md §5, §9.
// Чистая функция: состояние игрока, итог задания, время и генератор случайных чисел — на входе.

import { BALANCE } from '../config/balance';
import type { Branch, Day, InstantKind, PlayerState } from '../model/types';
import { drawLoot, type LootCard } from './loot';
import { thresholdsCrossed } from './pigeons';
import { levelInfo, totalXp } from './progression';
import type { Rng } from './rng';
import { addLog, recordActivity, resolveStreak } from './streak';
import { dayOf } from './time';

/**
 * factor — множитель опыта и золота за минуты (BALANCE.tasks.rewardFactor); нет — 1.
 * stars — звёзды за само задание (особый элемент бесконечного босса, docs/phase2-plan.md §5.3).
 */
export type Completion =
  | { kind: 'timed'; branch: Branch; minutes: number; full: boolean; factor?: number; stars?: number }
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
  /** Все звёзды за задание: само задание, уровни, вехи серии, карта добычи. */
  stars: number;
  /** Из них — звёзды за само задание (мероприятие, особый элемент бесконечного босса). */
  taskStars: number;
  streakMilestones: number[];
  logsBurned: number;
  comeback: boolean;
}

function baseReward(c: Completion): { xp: number; gold: number; stars: number } {
  if (c.kind === 'timed') {
    const round = c.full ? Math.round : Math.floor;
    const factor = c.factor ?? 1;
    return {
      xp: round(c.minutes * BALANCE.xp.perTimedMinute * factor),
      gold: round(c.minutes * BALANCE.gold.perTimedMinute * factor),
      stars: c.stars ?? 0,
    };
  }
  return {
    xp: BALANCE.xp.instant[c.instant],
    gold: BALANCE.gold.instant[c.instant],
    stars: BALANCE.tasks.instantStars[c.instant],
  };
}

export function applyCompletion(
  state: PlayerState,
  c: Completion,
  now: number,
  rng: Rng,
): { state: PlayerState; report: RewardReport } {
  const today: Day = dayOf(now);
  const { xp, gold, stars: taskStars } = baseReward(c);

  // Серия.
  const activity = recordActivity(state.streak, today);
  let streak = activity.streak;
  let stars = taskStars + activity.milestones.length * BALANCE.streak.starsPerMilestone;

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
      taskStars,
      streakMilestones: activity.milestones,
      logsBurned: activity.logsBurned,
      comeback: activity.comeback,
    },
  };
}

export interface FeatherReport {
  golden: boolean;
  xp: number;
  gold: number;
  /** Все звёзды: золотое перо, новый общий уровень, пороги плаща. */
  stars: number;
  newLevel: number | null;
  newBranchLevel: number | null;
  /** Пройденные пороги плаща (число перьев). */
  thresholds: number[];
}

/**
 * Голубь принёс перо. [РЕШЕНО] Это не задание: серия, карта добычи и веса доски не меняются.
 * Опыт идёт в Зов — ветку откликов (решение пользователя 24.11.2026; в фазе 1 шёл в Охоту).
 * feathersBefore — сколько перьев было в плаще до этого.
 */
export function applyFeather(
  state: PlayerState,
  golden: boolean,
  feathersBefore: number,
): { state: PlayerState; report: FeatherReport } {
  const branch: Branch = 'call';
  const xp = golden ? BALANCE.xp.goldenFeather : BALANCE.xp.feather;
  const gold = golden ? BALANCE.gold.goldenFeather : BALANCE.gold.feather;

  const oldLevel = levelInfo(totalXp(state.xp)).level;
  const oldBranchLevel = levelInfo(state.xp[branch]).level;
  const newXp = { ...state.xp, [branch]: state.xp[branch] + xp };
  const newLevel = levelInfo(totalXp(newXp)).level;
  const newBranchLevel = levelInfo(newXp[branch]).level;

  const thresholds = thresholdsCrossed(feathersBefore, feathersBefore + 1);
  const stars =
    (golden ? BALANCE.pigeons.goldenFeatherStars : 0) +
    (newLevel - oldLevel) * BALANCE.level.starsPerOverallLevel +
    thresholds.length * BALANCE.cloak.starsPerThreshold;

  return {
    state: { ...state, xp: newXp, gold: state.gold + gold, stars: state.stars + stars },
    report: {
      golden,
      xp,
      gold,
      stars,
      newLevel: newLevel > oldLevel ? newLevel : null,
      newBranchLevel: newBranchLevel > oldBranchLevel ? newBranchLevel : null,
      thresholds,
    },
  };
}

export interface VictoryReport {
  branch: Branch;
  xp: number;
  gold: number;
  /** Все звёзды: сама победа и новый общий уровень. */
  stars: number;
  newLevel: number | null;
  newBranchLevel: number | null;
}

/**
 * Победа над конечным боссом (docs/phase2-plan.md §5.2): крупный бонус со звездой, опыт — в ветку босса.
 * Это не задание: серия, карта добычи и веса доски не меняются — работа уже засчитана подходами.
 */
export function applyVictory(state: PlayerState, branch: Branch): { state: PlayerState; report: VictoryReport } {
  const { xp, gold, stars: victoryStars } = BALANCE.bosses.victory;
  const oldLevel = levelInfo(totalXp(state.xp)).level;
  const oldBranchLevel = levelInfo(state.xp[branch]).level;
  const newXp = { ...state.xp, [branch]: state.xp[branch] + xp };
  const newLevel = levelInfo(totalXp(newXp)).level;
  const newBranchLevel = levelInfo(newXp[branch]).level;
  const stars = victoryStars + (newLevel - oldLevel) * BALANCE.level.starsPerOverallLevel;
  return {
    state: { ...state, xp: newXp, gold: state.gold + gold, stars: state.stars + stars },
    report: {
      branch,
      xp,
      gold,
      stars,
      newLevel: newLevel > oldLevel ? newLevel : null,
      newBranchLevel: newBranchLevel > oldBranchLevel ? newBranchLevel : null,
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
