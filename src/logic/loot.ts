// Карта добычи. SPEC.md §9.2.

import { BALANCE } from '../config/balance';
import { pickFrom, pickWeighted, type Rng } from './rng';

export type LootCard =
  | { kind: 'phrase'; gold: number }
  | { kind: 'gold'; gold: number }
  | { kind: 'seed'; item: string }
  | { kind: 'log' }
  | { kind: 'star' }
  | { kind: 'rare'; item: string };

export function drawLoot(rng: Rng): LootCard {
  const { kind } = pickWeighted(BALANCE.loot.table, (row) => row.weight, rng);
  switch (kind) {
    case 'phrase':
      return { kind, gold: BALANCE.loot.phraseGold };
    case 'gold':
      return { kind, gold: BALANCE.loot.goldCardGold };
    case 'seed':
      return { kind, item: pickFrom(BALANCE.loot.seeds, rng) };
    case 'log':
      return { kind };
    case 'star':
      return { kind };
    case 'rare':
      return { kind, item: pickFrom(BALANCE.loot.rareDecor, rng) };
  }
}
