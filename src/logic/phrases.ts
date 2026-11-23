// Выбор мотивирующей фразы без частых повторов. SPEC.md §11.

import { BALANCE } from '../config/balance';
import { pickFrom, type Rng } from './rng';

/** Сколько последних показанных фраз помнить (по всем пулам вместе). */
const HISTORY_LIMIT = 200;

/**
 * Выбирает фразу из пула. Фраза не повторяется, пока не покажут noRepeatWindow других из того же пула
 * (если пул меньше — пока не покажут весь пул). recent — показанные фразы, последняя — в конце.
 */
export function pickPhrase(
  pool: readonly string[],
  recent: readonly string[],
  rng: Rng,
): { phrase: string; recent: string[] } {
  const window = Math.min(BALANCE.phrases.noRepeatWindow, pool.length - 1);
  const shownFromPool = recent.filter((p) => pool.includes(p));
  const blocked = new Set(window > 0 ? shownFromPool.slice(-window) : []);
  const phrase = pickFrom(
    pool.filter((p) => !blocked.has(p)),
    rng,
  );
  return { phrase, recent: [...recent.filter((p) => p !== phrase), phrase].slice(-HISTORY_LIMIT) };
}
