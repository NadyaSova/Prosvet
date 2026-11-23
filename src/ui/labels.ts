// Подписи для интерфейса: названия веток и предметов из добычи.

import type { Branch, PigeonColor, PigeonSize, PlantKind, PlantSize, ValleyDecor, ValleyPlant } from '../model/types';

export const PIGEON_COLOR_NAMES: Record<PigeonColor, string> = {
  slate: 'сизый',
  white: 'белый',
  rose: 'дымчато-розовый',
  lilac: 'сиреневый',
};

export const FEATHER_NAMES: Record<PigeonColor | 'gold', string> = {
  slate: 'Сизое перо',
  white: 'Белое перо',
  rose: 'Дымчато-розовое перо',
  lilac: 'Сиреневое перо',
  gold: 'Золотое перо',
};

export const PIGEON_SIZE_NAMES: Record<PigeonSize, string> = {
  small: 'маленький',
  medium: 'средний',
  large: 'большой',
};

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

/** Растения долины: маленькое, среднее, большое. */
const PLANT_NAMES: Record<PlantKind, [string, string, string]> = {
  oak: ['дубок', 'дуб', 'могучий дуб'],
  birch: ['берёзка', 'берёза', 'высокая берёза'],
  willow: ['ивушка', 'ива', 'раскидистая ива'],
  pine: ['сосенка', 'сосна', 'высокая сосна'],
  flowers: ['цветы', 'цветы', 'поляна цветов'],
  bush: ['кустик', 'куст', 'цветущий куст'],
  rowan: ['рябинка', 'рябина', 'рябина'],
  apple: ['яблонька', 'яблоня', 'яблоня'],
  lilac: ['сирень', 'сирень', 'сирень'],
  sunflower: ['подсолнух', 'подсолнухи', 'подсолнухи'],
};

const SIZE_INDEX: Record<PlantSize, number> = { small: 0, medium: 1, large: 2 };

export function plantName(p: Pick<ValleyPlant, 'kind' | 'size'>): string {
  return PLANT_NAMES[p.kind][SIZE_INDEX[p.size]]!;
}

const DECOR_NAMES: Record<ValleyDecor['kind'], string> = {
  fireflies: 'светлячки',
  rainbow: 'радуга над рекой',
  deer: 'олень у воды',
};

/** Что появилось в долине: растение или редкость. */
export function valleyObjectName(o: ValleyPlant | ValleyDecor): string {
  return 'size' in o ? plantName(o) : DECOR_NAMES[o.kind];
}
