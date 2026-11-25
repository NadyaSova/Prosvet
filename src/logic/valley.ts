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
  type Boss,
  type CampKind,
  type DecorKind,
  type LandmarkKind,
  type PlantKind,
  type PlantSize,
  type ValleyDecor,
  type ValleyPlant,
  type ValleyState,
} from '../model/types';
import { fogDensity } from './bosses';
import type { Completion } from './rewards';
import type { Rng } from './rng';
import {
  CAMP_SPOTS,
  DECOR_ANCHORS,
  depthScale,
  LANDMARK_SITES,
  landmarkHalfWidth,
  MIST_START_X,
  riverX,
  slotsUnder,
  SLOTS,
  WORLD,
  type Band,
  type LandmarkSite,
} from './valley-district';

export function emptyValley(): ValleyState {
  return { plants: [], decor: [], camp: [], landmarks: [] };
}

/** Сколько мест для растений в районе. Часть из них может занять сооружение босса (blockedSlots). */
export const CAPACITY = SLOTS.length;

/** Места растений под сооружениями боссов: туда не сажают. */
export function blockedSlots(v: ValleyState): Set<number> {
  const blocked = new Set<number>();
  for (const l of v.landmarks) {
    const site = LANDMARK_SITES[l.site];
    if (site) for (const i of slotsUnder(site)) blocked.add(i);
  }
  return blocked;
}

/** Свободные места для растений: не заняты растением и не под сооружением. По порядку открытия. */
function freeSlots(v: ValleyState): number[] {
  const taken = new Set(v.plants.map((p) => p.slot));
  const blocked = blockedSlots(v);
  const free: number[] = [];
  for (let i = 0; i < SLOTS.length; i++) if (!taken.has(i) && !blocked.has(i)) free.push(i);
  return free;
}

/** Сколько растений поместится в район всего: уже выросшие и свободные места. */
export function districtCapacity(v: ValleyState): number {
  return v.plants.length + freeSlots(v).length;
}

/**
 * Порода по ветке (SPEC.md §6, docs/phase2-plan.md §4.9). Разведка растит цветы и кусты.
 * Зов, Нити и Ремесло выбрала пользователь (24.11.2026). Берёза раньше была у Облика.
 */
const BRANCH_TREES: Record<Exclude<Branch, 'scouting'>, PlantKind> = {
  chronicle: 'oak',
  hunt: 'pine',
  call: 'birch',
  threads: 'flax',
  prep: 'willow',
  craft: 'hazel',
};

export function plantKindFor(branch: Branch, size: PlantSize): PlantKind {
  if (branch === 'scouting') return size === 'small' ? 'flowers' : 'bush';
  return BRANCH_TREES[branch];
}

/** Размер растения по заданию: короткое и мгновенное — маленькое, 10–15 минут — среднее, 25 и больше — большое. */
export function plantSize(c: Completion): PlantSize {
  // Мероприятие — крупное дело: большое растение.
  if (c.kind === 'instant') return c.instant === 'event' ? 'large' : 'small';
  if (c.minutes >= BALANCE.valley.largeFromMinutes) return 'large';
  if (c.minutes >= BALANCE.valley.mediumFromMinutes) return 'medium';
  return 'small';
}

export function isDistrictOpen(v: ValleyState): boolean {
  return freeSlots(v).length === 0;
}

/** Какие слои любит растение. Чем больше число, тем охотнее. */
const BAND_LIKES: Record<PlantKind, Partial<Record<Band, number>>> = {
  pine: { far: 2, mid: 1 },
  oak: { mid: 2, near: 1 },
  birch: { near: 2, mid: 1 },
  willow: { near: 1, front: 1 },
  flowers: { front: 2, near: 1 },
  bush: { near: 2, front: 1 },
  flax: { front: 2, near: 1 },
  hazel: { near: 2, mid: 1 },
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
  const candidates = freeSlots(v).slice(0, BALANCE.valley.slotChoice);
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
 * а если их там мало — ещё ближайшие свободные у края тумана. Пусто — район полон.
 */
export function plantChoices(v: ValleyState): number[] {
  // Место у самого края тумана видно плохо — оставляем запас.
  const edge = mistFrontier(v) - 20;
  const open: number[] = [];
  const beyond: number[] = [];
  for (const i of freeSlots(v)) {
    if (SLOTS[i]!.x < edge) open.push(i);
    else beyond.push(i);
  }
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

/** Граница тумана (мировой x): всё левее открыто. Район полон — тумана нет. */
export function mistFrontier(v: ValleyState): number {
  if (isDistrictOpen(v)) return WORLD.width + 200;
  let x = MIST_START_X;
  for (const p of v.plants) x = Math.max(x, SLOTS[p.slot]!.x + 36);
  // Сооружение босса стоит на открытой земле, под своим туманом: общий туман за ним.
  for (const l of v.landmarks) {
    const site = LANDMARK_SITES[l.site];
    if (site) x = Math.max(x, site.x + landmarkHalfWidth(site) + 30);
  }
  return x;
}

/** У каких боссов сооружение стоит в долине: конечные в работе и победы. Отпущенные уходят вместе с туманом. */
function hasLandmark(b: Boss): boolean {
  return b.kind === 'finite' && b.place.landmark !== undefined && (b.status === 'active' || b.status === 'won');
}

/**
 * Сколько мест растений, уже занятых растениями, закрыло бы сооружение на этом месте.
 * Сооружение ставится туда, где таких меньше всего.
 */
function plantsUnder(v: ValleyState, site: number): number {
  const taken = new Set(v.plants.map((p) => p.slot));
  return slotsUnder(LANDMARK_SITES[site]!).filter((i) => taken.has(i)).length;
}

/**
 * Сооружения в долине — по боссам: новому конечному боссу — место, отпущенному — убрать.
 * Место — свободное, где меньше всего растений, из таких — ближайшее к лагерю. Все места заняты —
 * сооружение ждёт, пока место освободится (босс работает и без него). Ничего не изменилось — та же долина.
 */
export function syncLandmarks(v: ValleyState, bosses: readonly Boss[]): ValleyState {
  const wanted = new Map(bosses.filter(hasLandmark).map((b) => [b.id, b]));
  const kept = v.landmarks.filter((l) => wanted.has(l.bossId) && LANDMARK_SITES[l.site]);
  const placed = new Set(kept.map((l) => l.bossId));
  const missing = [...wanted.values()].filter((b) => !placed.has(b.id)).sort((a, b) => a.createdAt - b.createdAt);
  if (missing.length === 0 && kept.length === v.landmarks.length) return v;
  const landmarks = [...kept];
  for (const b of missing) {
    const used = new Set(landmarks.map((l) => l.site));
    let best: number | null = null;
    for (let i = 0; i < LANDMARK_SITES.length; i++) {
      if (used.has(i)) continue;
      if (best === null || plantsUnder(v, i) < plantsUnder(v, best)) best = i;
    }
    if (best === null) break;
    landmarks.push({ bossId: b.id, site: best });
  }
  return { ...v, landmarks };
}

/** Где в долине сооружение босса. undefined — не стоит (отпущен, бесконечный или все места заняты). */
export function landmarkSite(v: ValleyState, bossId: string): LandmarkSite | undefined {
  const l = v.landmarks.find((x) => x.bossId === bossId);
  return l && LANDMARK_SITES[l.site];
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

/** Сооружение босса для рисунка: где, какое и сколько над ним тумана. */
export interface SceneLandmark extends LandmarkSite {
  bossId: string;
  kind: LandmarkKind;
  seed: number;
  /** Плотность тумана сейчас: 1 — сплошной, 0 — нет (победа). */
  fog: number;
  /** Плотность до последнего подхода или до победы — от неё туман редеет в анимации. */
  fogBefore: number;
  won: boolean;
  /** Сколько подходов было. 0 — босс только что заведён. */
  sessions: number;
}

export interface ValleyScene {
  plants: ScenePlant[];
  decor: SceneDecor[];
  camp: SceneCamp[];
  landmarks: SceneLandmark[];
  mistX: number;
  open: boolean;
}

function sceneLandmarks(v: ValleyState, bosses: readonly Boss[]): SceneLandmark[] {
  const out: SceneLandmark[] = [];
  for (const l of v.landmarks) {
    const site = LANDMARK_SITES[l.site];
    const b = bosses.find((x) => x.id === l.bossId);
    if (!site || !b || !hasLandmark(b)) continue;
    const won = b.status === 'won';
    const active = { ...b, status: 'active' as const };
    const fogBefore = won
      ? fogDensity(active)
      : fogDensity({ ...active, sessions: b.sessions.slice(0, Math.max(0, b.sessions.length - 1)) });
    out.push({ ...site, bossId: b.id, kind: b.place.landmark!, seed: b.place.seed, fog: fogDensity(b), fogBefore, won, sessions: b.sessions.length });
  }
  return out;
}

/**
 * Всё, что нужно рисунку: объекты с мировыми координатами (дальние раньше ближних), сооружения боссов
 * и граница тумана.
 */
export function sceneOf(v: ValleyState, bosses: readonly Boss[] = []): ValleyScene {
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
  return { plants, decor, camp, landmarks: sceneLandmarks(v, bosses), mistX: mistFrontier(v), open: isDistrictOpen(v) };
}

/** Последнее посаженное растение — к нему прокручивается панорама. */
export function latestPlant(v: ValleyState): ValleyPlant | undefined {
  return v.plants.reduce<ValleyPlant | undefined>(
    (best, p) =>
      !best || p.plantedAt > best.plantedAt || (p.plantedAt === best.plantedAt && p.slot > best.slot) ? p : best,
    undefined,
  );
}
