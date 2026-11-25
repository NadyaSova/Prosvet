// Район долины: рельеф, река, лагерь, места для растений и редкостей. SPEC.md §12.
// Это данные модели («где что может расти»), а не рисунок: рендер берёт отсюда координаты
// и сам решает, как их нарисовать. Координаты — мировые: панорама шириной WORLD.width.

import { createRng } from './rng';

export const WORLD = { width: 960, height: 240 } as const;

/** Сколько мировых единиц видно на одном экране телефона. Панорама — около 2,5 экрана. */
export const VIEW_WIDTH = 380;

/** Лагерь в левой части: странница сидит у костра. */
export const CAMP = { wandererX: 58, fireX: 96, y: 226 } as const;

/** Места вещей лагеря из лавки: палатка позади странницы, фонарь справа от костра, котелок над огнём. */
export const CAMP_SPOTS = {
  tent: { x: 22, y: 216 },
  lantern: { x: 126, y: 228 },
  kettle: { x: CAMP.fireX, y: CAMP.y },
} as const;

/** Докуда долина открыта с самого начала (вокруг лагеря и реки). */
export const MIST_START_X = 300;

export type Band = 'far' | 'mid' | 'near' | 'front';
export const BANDS: readonly Band[] = ['far', 'mid', 'near', 'front'];

/** Верхний край каждого слоя холмов по x. Слой front — ближняя полоса земли. */
export function hillTop(band: Band, x: number): number {
  switch (band) {
    case 'far':
      return 112 + 7 * Math.sin(x / 95) + 4 * Math.sin(x / 37 + 1);
    case 'mid':
      return 146 + 6 * Math.sin(x / 70 + 1.3) + 3 * Math.sin(x / 29);
    case 'near':
      return 180 + 5 * Math.sin(x / 61 + 2.1) + 2 * Math.sin(x / 23 + 0.4);
    case 'front':
      return 210 + 3 * Math.sin(x / 47 + 0.7);
  }
}

/** Нижняя граница слоя: верх следующего слоя (для front — низ панорамы). */
function bandBottom(band: Band, x: number): number {
  const next = BANDS[BANDS.indexOf(band) + 1];
  return next ? hillTop(next, x) : WORLD.height - 8;
}

/** Река течёт с дальних холмов к зрителю: середина русла и ширина на высоте y. */
export const RIVER = { fromY: 116 } as const;

export function riverX(y: number): number {
  const t = y - RIVER.fromY;
  return 214 + t * 0.42 + 10 * Math.sin(t / 22);
}

export function riverWidth(y: number): number {
  return 3 + Math.max(0, y - RIVER.fromY) * 0.15;
}

/** Масштаб по глубине: дальнее меньше. */
export function depthScale(y: number): number {
  return 0.5 + (Math.min(Math.max(y, 112), 232) - 112) * (0.5 / 120);
}

export interface Slot {
  x: number;
  y: number;
  band: Band;
}

/** Шаг мест по слоям: дальше — гуще, потому что растения там меньше. */
const SPACING: Record<Band, number> = { far: 22, mid: 26, near: 30, front: 34 };

/** Сид раскладки мест. Постоянный: места одинаковы на всех устройствах и между запусками. */
const LAYOUT_SEED = 20261124;

function buildSlots(): Slot[] {
  const rng = createRng(LAYOUT_SEED);
  const slots: Slot[] = [];
  for (const band of BANDS) {
    const step = SPACING[band];
    for (let base = 16; base < WORLD.width - 10; base += step) {
      const x = base + (rng() - 0.5) * step * 0.6;
      const top = hillTop(band, x) + 4;
      const bottom = bandBottom(band, x) + 1;
      const y = top + rng() * Math.max(0, bottom - top);
      // У реки и в лагере не растёт.
      if (Math.abs(x - riverX(y)) < riverWidth(y) / 2 + 10) continue;
      if (band === 'front' && x < 150) continue;
      if (band === 'near' && x < 120) continue;
      slots.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, band });
    }
  }
  // Порядок мест — от лагеря вправо, с небольшим разбросом: долина открывается слева направо.
  const keyed = slots.map((s) => ({ s, key: s.x + rng() * 40 }));
  keyed.sort((a, b) => a.key - b.key);
  return keyed.map((k) => k.s);
}

/** Места для растений, по порядку открытия. Номер места — индекс в этом списке. */
export const SLOTS: readonly Slot[] = buildSlots();

/**
 * Сооружения конечных боссов (docs/phase2-plan.md §5.2): высота рамки рисунка у самого переднего края;
 * дальше — меньше, по depthScale. Рамка — 120 × 100, так что ширина — 1,2 высоты.
 */
export const LANDMARK_SIZE = 64;

export interface LandmarkSite {
  x: number;
  y: number;
  /** Высота рамки рисунка на этом месте, в единицах мира. */
  size: number;
}

/**
 * Места сооружений: по очереди на средних и ближних холмах, слева направо, в стороне от реки и лагеря.
 * Соседние места не перекрываются. Номер места — индекс в этом списке.
 */
export const LANDMARK_SITES: readonly LandmarkSite[] = (
  [
    [108, 'mid'], [172, 'near'], [300, 'mid'], [368, 'near'], [436, 'mid'], [504, 'near'],
    [572, 'mid'], [640, 'near'], [708, 'mid'], [776, 'near'], [844, 'mid'], [912, 'near'],
  ] as const
).map(([x, band]) => {
  const y = Math.round((hillTop(band, x) + (band === 'mid' ? 12 : 9)) * 10) / 10;
  return { x, y, size: Math.round(LANDMARK_SIZE * depthScale(y) * 10) / 10 };
});

/** Половина ширины сооружения на месте: столько по x от середины заняты места растений. */
export function landmarkHalfWidth(site: LandmarkSite): number {
  return site.size * 0.55;
}

/**
 * Какие места растений занимает сооружение: под ним и сразу за ним (то, что позади, оно бы закрыло).
 * Растения чуть впереди остаются — в пейзаже дерево перед мельницей выглядит естественно.
 */
export function slotsUnder(site: LandmarkSite): number[] {
  const half = landmarkHalfWidth(site);
  const out: number[] = [];
  SLOTS.forEach((s, i) => {
    if (Math.abs(s.x - site.x) < half + 4 && s.y > site.y - site.size * 0.4 && s.y < site.y + 6) out.push(i);
  });
  return out;
}

/**
 * Места бесконечных боссов (docs/phase2-plan.md §5.3): высота рамки рисунка у самого переднего края — 80,
 * одобрено пользователем (24.11.2026); дальше — меньше, по depthScale. Рамка — 120 × 60 (garden-art.tsx).
 */
export const GARDEN_SIZE = 80;

/** Пятно земли места в единицах рамки (120 × 60): середина и полуоси, с травой по краю. Из garden-art.tsx. */
const GARDEN_PATCH = { cy: -14, rx: 57, ry: 13 } as const;

export interface GardenSite {
  x: number;
  y: number;
  /** Высота рамки рисунка на этом месте, в единицах мира. */
  size: number;
}

/**
 * Места бесконечных боссов. Сначала четыре на ближней полосе земли, перед сооружениями и в стороне от реки,
 * оленя у воды и лагеря: они не мешают ни сооружениям, ни друг другу. Потом шесть на средних холмах — там они
 * делят землю с сооружениями (gardenBlocksLandmark). Номер места — индекс в этом списке.
 */
export const GARDEN_SITES: readonly GardenSite[] = [
  ...[370, 530, 690, 850].map((x) => ({ x, y: 232 })),
  // На холме пятно не заходит за гребень ближнего холма.
  ...[130, 320, 450, 640, 760, 880].map((x) => ({ x, y: Math.round(Math.min(hillTop('mid', x) + 30, hillTop('near', x)) * 10) / 10 })),
].map((s) => ({ ...s, size: Math.round(GARDEN_SIZE * depthScale(s.y) * 10) / 10 }));

/** Сколько первых мест — на ближней полосе. Они занимаются раньше мест на холмах. */
export const FRONT_GARDEN_SITES = 4;

/** Пятно земли места в мировых координатах. */
export function gardenPatch(site: GardenSite): { cx: number; cy: number; rx: number; ry: number } {
  const k = site.size / 60;
  return { cx: site.x, cy: site.y + GARDEN_PATCH.cy * k, rx: GARDEN_PATCH.rx * k, ry: GARDEN_PATCH.ry * k };
}

/** Половина ширины места: столько по x от середины оно закрывает. */
export function gardenHalfWidth(site: GardenSite): number {
  return gardenPatch(site).rx;
}

/** Места растений на пятне земли места: там не сажают. Растения позади и впереди пятна остаются. */
export function slotsUnderGarden(site: GardenSite): number[] {
  const p = gardenPatch(site);
  const out: number[] = [];
  SLOTS.forEach((s, i) => {
    if (((s.x - p.cx) / (p.rx + 3)) ** 2 + ((s.y - p.cy) / (p.ry + 3)) ** 2 < 1) out.push(i);
  });
  return out;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Земля под сооружением: от основания немного вглубь (что позади, оно закрывает). */
function landmarkBox(s: LandmarkSite): Box {
  const half = s.size * 0.6;
  return { x0: s.x - half, x1: s.x + half, y0: s.y - s.size * 0.4, y1: s.y + 2 };
}

function gardenBox(s: GardenSite): Box {
  const p = gardenPatch(s);
  return { x0: p.cx - p.rx, x1: p.cx + p.rx, y0: p.cy - p.ry, y1: p.cy + p.ry };
}

/** Место и сооружение не могут стоять вместе: их земля перекрывается. */
export function gardenBlocksLandmark(garden: number, landmark: number): boolean {
  const g = GARDEN_SITES[garden];
  const l = LANDMARK_SITES[landmark];
  return !!g && !!l && overlaps(gardenBox(g), landmarkBox(l));
}

/** Два места не могут стоять вместе. */
export function gardensOverlap(a: number, b: number): boolean {
  const ga = GARDEN_SITES[a];
  const gb = GARDEN_SITES[b];
  return a !== b && !!ga && !!gb && overlaps(gardenBox(ga), gardenBox(gb));
}

/** Места редкостей. Вторая редкость того же вида встаёт на следующее место. */
export const DECOR_ANCHORS = {
  deer: [
    { x: 288, y: 214 },
    { x: 198, y: 172 },
    { x: 262, y: 152 },
  ],
  fireflies: [
    { x: 150, y: 196 },
    { x: 40, y: 172 },
    { x: 250, y: 200 },
    { x: 440, y: 198 },
  ],
  // Радуга над рекой; вторая делает её двойной.
  rainbow: [{ x: 240, y: 150 }],
} as const;
