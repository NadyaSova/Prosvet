// Долина: что где растёт. SPEC.md §6, §12.2–§12.3.
// Чистые функции: время и генератор случайных чисел — в параметрах. Рисунок — отдельно (ui/valley),
// он видит только sceneOf().

import { BALANCE } from '../config/balance';
import {
  BRANCHES,
  DECOR_KINDS,
  PLANT_KINDS,
  type Branch,
  type BranchXp,
  type CampKind,
  type DecorKind,
  type PlantKind,
  type PlantSize,
  type ValleyDecor,
  type ValleyPlant,
  type ValleyState,
} from '../model/types';
import type { Completion } from './rewards';
import type { Rng } from './rng';
import { CAMP_SPOTS, DECOR_ANCHORS, depthScale, MIST_START_X, riverX, SLOTS, WORLD, type Band } from './valley-district';

export function emptyValley(): ValleyState {
  return { plants: [], decor: [], camp: [] };
}

/** Сколько растений помещается в район. */
export const CAPACITY = SLOTS.length;

/** Порода по ветке (SPEC.md §6). Разведка растит цветы и кусты. */
const BRANCH_TREES: Record<Exclude<Branch, 'scouting'>, PlantKind> = {
  chronicle: 'oak',
  image: 'birch',
  speech: 'willow',
  hunt: 'pine',
};

export function plantKindFor(branch: Branch, size: PlantSize): PlantKind {
  if (branch === 'scouting') return size === 'small' ? 'flowers' : 'bush';
  return BRANCH_TREES[branch];
}

/** Размер растения по заданию: короткое и мгновенное — маленькое, 10–15 минут — среднее, 25 и больше — большое. */
export function plantSize(c: Completion): PlantSize {
  if (c.kind === 'instant') return 'small';
  if (c.minutes >= BALANCE.valley.largeFromMinutes) return 'large';
  if (c.minutes >= BALANCE.valley.mediumFromMinutes) return 'medium';
  return 'small';
}

export function isDistrictOpen(v: ValleyState): boolean {
  return v.plants.length >= CAPACITY;
}

/** Какие слои любит растение. Чем больше число, тем охотнее. */
const BAND_LIKES: Record<PlantKind, Partial<Record<Band, number>>> = {
  pine: { far: 2, mid: 1 },
  oak: { mid: 2, near: 1 },
  birch: { near: 2, mid: 1 },
  willow: { near: 1, front: 1 },
  flowers: { front: 2, near: 1 },
  bush: { near: 2, front: 1 },
  rowan: { near: 2, mid: 1 },
  apple: { mid: 2, near: 1 },
  lilac: { near: 2, front: 1 },
  sunflower: { front: 2, near: 1 },
};

function slotScore(kind: PlantKind, slot: number): number {
  const s = SLOTS[slot]!;
  let score = BAND_LIKES[kind][s.band] ?? 0;
  if (kind === 'willow') {
    const d = Math.abs(s.x - riverX(s.y));
    score += d < 40 ? 3 : d < 90 ? 1 : 0;
  }
  return score;
}

/**
 * Место для нового растения: из нескольких ближайших свободных мест (по порядку открытия) — самое подходящее.
 * null — район полон.
 */
export function chooseSlot(v: ValleyState, kind: PlantKind): number | null {
  const taken = new Set(v.plants.map((p) => p.slot));
  const candidates: number[] = [];
  for (let i = 0; i < SLOTS.length && candidates.length < BALANCE.valley.slotChoice; i++) {
    if (!taken.has(i)) candidates.push(i);
  }
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  for (const c of candidates) if (slotScore(kind, c) > slotScore(kind, best)) best = c;
  return best;
}

function newSeed(rng: Rng): number {
  return Math.floor(rng() * 4_294_967_296) >>> 0;
}

/**
 * Куда можно посадить семя или саженец (номера мест): свободные места в открытой части долины,
 * а если их там мало — ещё ближайшие свободные у края хмари. Пусто — район полон.
 */
export function plantChoices(v: ValleyState): number[] {
  const taken = new Set(v.plants.map((p) => p.slot));
  // Место у самого края хмари видно плохо — оставляем запас.
  const edge = mistFrontier(v) - 20;
  const open: number[] = [];
  const beyond: number[] = [];
  SLOTS.forEach((s, i) => {
    if (taken.has(i)) return;
    if (s.x < edge) open.push(i);
    else beyond.push(i);
  });
  return [...open, ...beyond.slice(0, Math.max(0, BALANCE.valley.minChoices - open.length))].sort((a, b) => a - b);
}

function addPlant(
  v: ValleyState,
  kind: PlantKind,
  size: PlantSize,
  now: number,
  rng: Rng,
  extra: { branch?: Branch; id?: string; slot?: number } = {},
): { valley: ValleyState; plant: ValleyPlant } | null {
  const slot = extra.slot ?? chooseSlot(v, kind);
  if (slot === null) return null;
  const plant: ValleyPlant = { id: extra.id ?? `plant-${now}-${slot}`, kind, size, slot, seed: newSeed(rng), plantedAt: now };
  if (extra.branch) plant.branch = extra.branch;
  return { valley: { ...v, plants: [...v.plants, plant] }, plant };
}

/** Засчитанное задание выращивает растение своей ветки. null — район полон. */
export function plantForCompletion(
  v: ValleyState,
  c: Completion,
  now: number,
  rng: Rng,
): { valley: ValleyState; plant: ValleyPlant } | null {
  const size = plantSize(c);
  return addPlant(v, plantKindFor(c.branch, size), size, now, rng, { branch: c.branch });
}

/** Семя из карты добычи или саженец из лавки: растение, которому пользователь выбирает место. */
export function isPlantItem(item: string): item is PlantKind {
  return (
    (PLANT_KINDS as readonly string[]).includes(item) &&
    ((BALANCE.loot.seeds as readonly string[]).includes(item) || item in BALANCE.shop.plants)
  );
}

export function isDecorItem(item: string): item is DecorKind {
  return (DECOR_KINDS as readonly string[]).includes(item);
}

/** Можно ли сейчас посадить предмет из запаса: растению нужно свободное место, редкости — нет. */
export function canPlantItem(v: ValleyState, item: string): boolean {
  if (isDecorItem(item)) return true;
  return isPlantItem(item) && !isDistrictOpen(v);
}

/**
 * Сажает семя или саженец (на место slot, если оно среди plantChoices; без slot — место выбирает приложение)
 * или ставит редкость. null — такого предмета нет, растению негде расти или место не подходит.
 */
export function plantItem(
  v: ValleyState,
  item: string,
  now: number,
  rng: Rng,
  slot?: number,
): { valley: ValleyState; object: ValleyPlant | ValleyDecor } | null {
  if (isDecorItem(item)) {
    const count = v.decor.filter((d) => d.kind === item).length;
    const decor: ValleyDecor = {
      id: `${item}-${now}-${count}`,
      kind: item,
      anchor: count % DECOR_ANCHORS[item].length,
      seed: newSeed(rng),
      plantedAt: now,
    };
    return { valley: { ...v, decor: [...v.decor, decor] }, object: decor };
  }
  if (!isPlantItem(item)) return null;
  if (slot !== undefined && !plantChoices(v).includes(slot)) return null;
  const r = addPlant(v, item, 'medium', now, rng, { slot });
  return r && { valley: r.valley, object: r.plant };
}

/** Ставит вещь лагеря. null — такая уже есть. */
export function addCampItem(v: ValleyState, kind: CampKind): ValleyState | null {
  if (v.camp.includes(kind)) return null;
  return { ...v, camp: [...v.camp, kind] };
}

/** Долина для того, что сыграно до её появления: по опыту веток, вперемешку. */
export function valleyFromXp(xp: BranchXp, rng: Rng): ValleyState {
  const left = Object.fromEntries(
    BRANCHES.map((b) => [b, Math.floor(Math.max(0, xp[b] ?? 0) / BALANCE.valley.xpPerStartPlant)]),
  ) as Record<Branch, number>;
  let v = emptyValley();
  let i = 0;
  while (BRANCHES.some((b) => left[b] > 0)) {
    for (const b of BRANCHES) {
      if (left[b] <= 0) continue;
      left[b]--;
      const r = addPlant(v, plantKindFor(b, 'medium'), 'medium', 0, rng, { branch: b, id: `start-${i++}` });
      if (!r) return v;
      v = r.valley;
    }
  }
  return v;
}

/** Граница хмари (мировой x): всё левее открыто. Район полон — хмари нет. */
export function mistFrontier(v: ValleyState): number {
  if (isDistrictOpen(v)) return WORLD.width + 200;
  let x = MIST_START_X;
  for (const p of v.plants) x = Math.max(x, SLOTS[p.slot]!.x + 36);
  return x;
}

export interface ScenePlant extends ValleyPlant {
  x: number;
  y: number;
  scale: number;
}

export interface SceneDecor extends ValleyDecor {
  x: number;
  y: number;
  /** Сколько таких же редкостей уже стоит на этом месте (вторая радуга — двойная). */
  layer: number;
}

export interface SceneCamp {
  kind: CampKind;
  x: number;
  y: number;
}

export interface ValleyScene {
  plants: ScenePlant[];
  decor: SceneDecor[];
  camp: SceneCamp[];
  mistX: number;
  open: boolean;
}

/** Всё, что нужно рисунку: объекты с мировыми координатами (дальние раньше ближних) и граница хмари. */
export function sceneOf(v: ValleyState): ValleyScene {
  const plants = v.plants
    .filter((p) => SLOTS[p.slot])
    .map((p) => {
      const s = SLOTS[p.slot]!;
      return { ...p, x: s.x, y: s.y, scale: depthScale(s.y) };
    })
    .sort((a, b) => a.y - b.y);
  const perAnchor = new Map<string, number>();
  const decor = v.decor.map((d) => {
    const anchors = DECOR_ANCHORS[d.kind];
    const a = anchors[d.anchor % anchors.length]!;
    const key = `${d.kind}-${d.anchor}`;
    const layer = perAnchor.get(key) ?? 0;
    perAnchor.set(key, layer + 1);
    return { ...d, x: a.x, y: a.y, layer };
  });
  const camp = v.camp.map((kind) => ({ kind, ...CAMP_SPOTS[kind] }));
  return { plants, decor, camp, mistX: mistFrontier(v), open: isDistrictOpen(v) };
}

/** Последнее посаженное растение — к нему прокручивается панорама. */
export function latestPlant(v: ValleyState): ValleyPlant | undefined {
  return v.plants.reduce<ValleyPlant | undefined>(
    (best, p) =>
      !best || p.plantedAt > best.plantedAt || (p.plantedAt === best.plantedAt && p.slot > best.slot) ? p : best,
    undefined,
  );
}
