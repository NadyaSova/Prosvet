// Доска заданий. SPEC.md §5, §7.1.
// На доске 3 задания из разных веток. Ветки, которые давно не трогали, выпадают чаще.
// Сначала выбирается ветка (по весу), потом задание в ней — по возможности другого размера, чем уже на доске.
// Одно задание на доске — не длинное (до 15 минут или мгновенное), если такие есть: чтобы было что взять
// и в вялый день. Размер не решает, какая ветка попадёт на доску: в наборе фазы 2 короткие задания
// есть только в Летописи, и правило «три разных размера» ставило бы Летопись на каждую доску.
// Если шаблонов не хватает (пользователь многое скрыла), жертвуем разными ветками.

import { BALANCE } from '../config/balance';
import { BRANCHES, type Branch, type Day, type TaskTemplate } from '../model/types';
import { pickFrom, pickWeighted, type Rng } from './rng';

export type SizeBucket = 'short' | 'medium' | 'long';

export interface BoardContext {
  today: Day;
  branchLastTouched: Partial<Record<Branch, Day>>;
}

/** Размер задания: до 5 минут и мгновенные — короткие, до 15 — средние, дальше — длинные. */
export function sizeBucket(t: TaskTemplate): SizeBucket {
  if (t.kind === 'instant' || t.minutes <= 5) return 'short';
  if (t.minutes <= 15) return 'medium';
  return 'long';
}

/** Не длинное задание: короткое или среднее. */
export const isLight = (t: TaskTemplate): boolean => sizeBucket(t) !== 'long';

export function branchWeights(ctx: BoardContext): Record<Branch, number> {
  const { staleBoostPerDay, maxStaleDays } = BALANCE.board;
  const weights = {} as Record<Branch, number>;
  for (const b of BRANCHES) {
    const last = ctx.branchLastTouched[b];
    const stale = last === undefined ? maxStaleDays : Math.min(maxStaleDays, Math.max(0, ctx.today - last));
    weights[b] = 1 + stale * staleBoostPerDay;
  }
  return weights;
}

function boardable(templates: readonly TaskTemplate[]): TaskTemplate[] {
  return templates.filter((t) => t.onBoard && !t.hidden);
}

type Filter = (t: TaskTemplate) => boolean;

/** Отбор, который отбрасывается, если после него ничего не остаётся. */
function softly(pool: readonly TaskTemplate[], f: Filter | undefined): readonly TaskTemplate[] {
  if (!f) return pool;
  const kept = pool.filter(f);
  return kept.length > 0 ? kept : pool;
}

interface Wishes {
  /** Какие задания подходят — до выбора ветки (например, только не длинные). */
  pool?: Filter;
  /** Ветка, которой ещё нет на доске. */
  branch?: (b: Branch) => boolean;
  /** Какое задание взять внутри ветки; пробуются по порядку, первое непустое побеждает. */
  inBranch?: Filter[];
}

/**
 * Выбирает один шаблон: сначала ветку по весу, потом задание в ней. Пожелания мягкие:
 * если пожеланию ничего не отвечает, оно отбрасывается. Ветка с большим числом шаблонов
 * не получает преимущества: вес — у ветки, а не у задания.
 */
function pickOne(
  candidates: readonly TaskTemplate[],
  wishes: Wishes,
  weights: Record<Branch, number>,
  rng: Rng,
): TaskTemplate | undefined {
  // Другая ветка важнее, чем не длинное задание.
  const branchWish = wishes.branch;
  let pool = softly(candidates, branchWish && ((t) => branchWish(t.branch)));
  pool = softly(pool, wishes.pool);
  if (pool.length === 0) return undefined;
  const branches = [...new Set(pool.map((t) => t.branch))];
  const branch = pickWeighted(branches, (b) => weights[b], rng);
  const inBranch = pool.filter((t) => t.branch === branch);
  for (const f of wishes.inBranch ?? []) {
    const kept = inBranch.filter(f);
    if (kept.length > 0) return pickFrom(kept, rng);
  }
  return pickFrom(inBranch, rng);
}

/** Пожелания для следующего задания на доску, где уже лежат chosen. */
function nextWishes(chosen: readonly TaskTemplate[]): Wishes {
  const sizes = new Set(chosen.map(sizeBucket));
  return {
    pool: chosen.some(isLight) ? undefined : isLight,
    branch: (b) => !chosen.some((c) => c.branch === b),
    inBranch: [(t) => !sizes.has(sizeBucket(t))],
  };
}

/**
 * Собирает новую доску. exclude — шаблоны, которых на ней быть не должно
 * (например, при перетягивании — задания прежней доски).
 */
export function buildBoard(
  templates: readonly TaskTemplate[],
  ctx: BoardContext,
  rng: Rng,
  exclude: readonly string[] = [],
): string[] {
  const weights = branchWeights(ctx);
  const chosen: TaskTemplate[] = [];
  const base = boardable(templates).filter((t) => !exclude.includes(t.id));

  for (let i = 0; i < BALANCE.board.size; i++) {
    const pick = pickOne(
      base.filter((t) => !chosen.includes(t)),
      nextWishes(chosen),
      weights,
      rng,
    );
    if (!pick) break;
    chosen.push(pick);
  }

  // Если без исключённых шаблонов доску не набрать, добираем из них.
  if (chosen.length < BALANCE.board.size && exclude.length > 0) {
    const rest = buildBoard(templates, ctx, rng).filter((id) => !chosen.some((c) => c.id === id));
    return [...chosen.map((t) => t.id), ...rest].slice(0, BALANCE.board.size);
  }
  return chosen.map((t) => t.id);
}

/**
 * Заменяет задание в ячейке index новым: из ветки, которой нет на доске, и не то же самое задание;
 * в выбранной ветке — по возможности того же размера.
 */
export function refillSlot(
  board: readonly string[],
  index: number,
  templates: readonly TaskTemplate[],
  ctx: BoardContext,
  rng: Rng,
): string[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const removed = byId.get(board[index]!);
  const others = board.filter((_, i) => i !== index).map((id) => byId.get(id)).filter((t) => t !== undefined);
  const candidates = boardable(templates).filter((t) => !board.includes(t.id));

  const wishes = nextWishes(others);
  if (removed) wishes.inBranch = [(t) => sizeBucket(t) === sizeBucket(removed), ...(wishes.inBranch ?? [])];

  const pick = pickOne(candidates, wishes, branchWeights(ctx), rng);
  const next = [...board];
  if (pick) next[index] = pick.id;
  else next.splice(index, 1);
  return next;
}

/**
 * Приводит доску в порядок после того, как задания скрыли или удалили:
 * негодное задание заменяется на том же месте, недостающие места добираются.
 * Если менять нечего, возвращает тот же массив.
 */
export function repairBoard(
  board: readonly string[],
  templates: readonly TaskTemplate[],
  ctx: BoardContext,
  rng: Rng,
): readonly string[] {
  const valid = new Set(boardable(templates).map((t) => t.id));
  let next: string[] = board.filter((id, i) => board.indexOf(id) === i);
  // С конца: refillSlot может убрать ячейку, если заменить нечем.
  for (let i = next.length - 1; i >= 0; i--) {
    if (!valid.has(next[i]!)) next = refillSlot(next, i, templates, ctx, rng);
  }
  if (next.length === 0) next = buildBoard(templates, ctx, rng);

  const byId = new Map(templates.map((t) => [t.id, t]));
  const chosen = next.map((id) => byId.get(id)!);
  const weights = branchWeights(ctx);
  while (chosen.length < BALANCE.board.size) {
    const pick = pickOne(
      boardable(templates).filter((t) => !chosen.includes(t)),
      nextWishes(chosen),
      weights,
      rng,
    );
    if (!pick) break;
    chosen.push(pick);
  }
  const ids = chosen.map((t) => t.id);
  return ids.length === board.length && ids.every((id, i) => id === board[i]) ? board : ids;
}

/** Задание для кнопки «Не хочу ничего»: короткое, по возможности не с доски. */
export function pickTinyTask(
  templates: readonly TaskTemplate[],
  ctx: BoardContext,
  rng: Rng,
  board: readonly string[] = [],
): TaskTemplate | undefined {
  const short = boardable(templates).filter((t) => sizeBucket(t) === 'short');
  return pickOne(short, { pool: (t) => !board.includes(t.id) }, branchWeights(ctx), rng);
}

/** Можно ли сегодня бесплатно перетянуть доску. */
export function canReroll(rerollsToday: { day: Day; count: number } | null, today: Day): boolean {
  if (!rerollsToday || rerollsToday.day !== today) return true;
  return rerollsToday.count < BALANCE.board.freeRerollsPerDay;
}
