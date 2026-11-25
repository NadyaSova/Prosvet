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
