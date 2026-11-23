// Подписи для интерфейса: названия веток и предметов из добычи.

import type { Branch } from '../model/types';

export const BRANCH_NAMES: Record<Branch, string> = {
  chronicle: 'Летопись',
  image: 'Облик',
  speech: 'Речь',
  scouting: 'Разведка',
  hunt: 'Охота',
};

/** Семена и редкий декор из карты добычи (BALANCE.loot.seeds и rareDecor). */
export const ITEM_NAMES: Record<string, string> = {
  rowan: 'Семя рябины',
  apple: 'Семя яблони',
  lilac: 'Семя сирени',
  sunflower: 'Семя подсолнуха',
  fireflies: 'Светлячки',
  rainbow: 'Радуга над рекой',
  deer: 'Олень у воды',
};

export function itemName(id: string): string {
  return ITEM_NAMES[id] ?? id;
}
