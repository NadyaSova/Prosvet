// Доска заданий. SPEC.md §5, §7.1.
// На доске 3 задания из разных веток и разных размеров. Ветки, которые давно не трогали, выпадают чаще.
// Если шаблонов не хватает (пользователь многое скрыла), сначала жертвуем разными размерами, потом — разными ветками.

import { BALANCE } from '../config/balance';
import { BRANCHES, type Branch, type Day, type TaskTemplate } from '../model/types';
import { pickWeighted, shuffled, type Rng } from './rng';

export type SizeBucket = 'short' | 'medium' | 'long';
const BUCKETS: SizeBucket[] = ['short', 'medium', 'long'];

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

/**
 * Выбирает один шаблон. Сначала пробует все пожелания сразу, потом отбрасывает их с конца по одному.
 * Ветка выбирается по весу, а внутри ветки шаблоны равновероятны — так ветка с большим числом
 * шаблонов не получает преимущества.
 */
function pickOne(
  candidates: readonly TaskTemplate[],
  wishes: Filter[],
  weights: Record<Branch, number>,
  rng: Rng,
): TaskTemplate | undefined {
  for (let n = wishes.length; n >= 0; n--) {
    const active = wishes.slice(0, n);
    const pool = candidates.filter((t) => active.every((w) => w(t)));
    if (pool.length === 0) continue;
    const perBranch = new Map<Branch, number>();
    for (const t of pool) perBranch.set(t.branch, (perBranch.get(t.branch) ?? 0) + 1);
    return pickWeighted(pool, (t) => weights[t.branch] / perBranch.get(t.branch)!, rng);
  }
  return undefined;
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
  const order = shuffled(BUCKETS, rng);
  const base = boardable(templates).filter((t) => !exclude.includes(t.id));

  for (let i = 0; i < BALANCE.board.size; i++) {
    const bucket = order[i % order.length]!;
    const candidates = base.filter((t) => !chosen.includes(t));
    const pick = pickOne(
      candidates,
      [(t) => !chosen.some((c) => c.branch === t.branch), (t) => sizeBucket(t) === bucket],
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
 * Заменяет задание в ячейке index новым: того же размера, из ветки, которой нет на доске,
 * и не то же самое задание.
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

  const wishes: Filter[] = [(t) => !others.some((o) => o.branch === t.branch)];
  if (removed) wishes.push((t) => sizeBucket(t) === sizeBucket(removed));

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
    const buckets = new Set(chosen.map(sizeBucket));
    const pick = pickOne(
      boardable(templates).filter((t) => !chosen.includes(t)),
      [(t) => !chosen.some((c) => c.branch === t.branch), (t) => !buckets.has(sizeBucket(t))],
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
  return pickOne(short, [(t) => !board.includes(t.id)], branchWeights(ctx), rng);
}

/** Можно ли сегодня бесплатно перетянуть доску. */
export function canReroll(rerollsToday: { day: Day; count: number } | null, today: Day): boolean {
  if (!rerollsToday || rerollsToday.day !== today) return true;
  return rerollsToday.count < BALANCE.board.freeRerollsPerDay;
}
