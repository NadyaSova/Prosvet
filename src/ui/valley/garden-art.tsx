// Места бесконечных боссов (docs/phase2-plan.md §5.3): пруд с рыбками, цветник, пасека, луг с бабочками.
// Плоский стиль эскиза docs/reference-valley.svg, как у сооружений (landmark-art.tsx).
//
// Координаты: начало — на земле под серединой места, рисунок растёт вверх (отрицательный y).
// Место нарисовано в рамке 120 × 60 (x от −60 до 60, y от −60 до 0) и умножено на size / 60:
// size — высота рамки в единицах долины, как у сооружений. Само место — плоское пятно земли глубиной
// около 25 единиц рамки; выше поднимаются камыш, цветы, ульи и бабочки.
//
// count, special, bloom — как в gardenView (src/logic/bosses.ts): сколько элементов, сколько из них особых,
// сколько подходов сверх ёмкости. Места всех элементов выбираются по сиду заранее, поэтому новый элемент
// не сдвигает прежние. Особый элемент — каждый specialEvery-й. Особые сверх них (после ёмкости места)
// превращают обычные элементы в особые на тех же местах. Пышность: элементы крупнее и ярче, вокруг гуще
// трава и цветы; полная — через BLOOM_FULL подходов сверх ёмкости.

import type { JSX } from 'preact';
import { BALANCE } from '../../config/balance';
import { createRng, pickFrom, pickWeighted, shuffled, type Rng } from '../../logic/rng';
import type { GardenKind } from '../../model/types';
import { PALETTE } from '../palette';
import { moves } from './landmark-art';

/** Рамка рисунка в его собственных единицах: size — её высота в единицах долины. */
export const GARDEN_BOX = { width: 120, height: 60 } as const;

export const GARDEN_NAMES: Record<GardenKind, string> = {
  pond: 'Пруд с рыбками',
  flowerbed: 'Цветник',
  apiary: 'Пасека',
  meadow: 'Луг с бабочками',
};

/** Сколько подходов сверх ёмкости места дают полную пышность. */
const BLOOM_FULL = 30;

const LEAVES = [PALETTE.leaf, PALETTE.leafDark, PALETTE.leafLight];
const RIPPLE = '#e3f1f6';
const PEBBLES = [
  { body: '#b3a898', light: '#cbc1b3' },
  { body: '#aca9a3', light: '#c7c4bd' },
  { body: '#bca78d', light: '#d3c2a8' },
];

// ---------- Общее: места элементов, особые, разброс ----------

interface PlaceProps {
  seed: number;
  /** Сколько элементов видно (не больше ёмкости). */
  n: number;
  /** Номер элемента → номер особого по порядку (0, 1, 2…). */
  ranks: Map<number, number>;
  /** Пышность от 0 до 1. */
  t: number;
  /** Движение включено. */
  run: boolean;
}

/** Элемент места: где стоит, свой генератор для разброса вида и особый ли он. */
interface Item {
  i: number;
  x: number;
  y: number;
  rng: Rng;
  /** Номер особого по порядку; undefined — обычный. */
  rank: number | undefined;
  /** Ярче обычного — от пышности. */
  bright: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Свой генератор у каждого элемента: его вид не зависит от того, сколько элементов уже есть. */
function elemRng(seed: number, i: number, salt = 0): Rng {
  return createRng((seed ^ Math.imul(i + 1, 0x9e3779b1) ^ salt) >>> 0);
}

/**
 * n точек внутри области, не ближе gap друг к другу (по вертикали расстояние вдвое важнее: место плоское,
 * видно сверху наискосок). Если точка не находится, gap понемногу уменьшается.
 */
function scatter(
  rng: Rng,
  n: number,
  inside: (x: number, y: number) => boolean,
  [x0, y0, x1, y1]: [number, number, number, number],
  gap: number,
): [number, number][] {
  const pts: [number, number][] = [];
  let g = gap;
  while (pts.length < n) {
    let placed = false;
    for (let tries = 0; tries < 80 && !placed; tries++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      if (!inside(x, y)) continue;
      if (pts.every(([px, py]) => Math.hypot(px - x, (py - y) * 2) >= g)) {
        pts.push([x, y]);
        placed = true;
      }
    }
    if (!placed) g *= 0.9;
  }
  return pts;
}

/** Масштаб по глубине: дальнее (выше по рисунку) мельче. */
function depth(y: number, back: number, front: number): number {
  return 0.8 + 0.2 * clamp((y - back) / (front - back), 0, 1);
}

/** Особые: каждый specialEvery-й элемент, а сверх них — обычные элементы по порядку, заданному сидом. */
function specialRanks(n: number, special: number, cap: number, rng: Rng): Map<number, number> {
  const every = BALANCE.bosses.specialEvery;
  const want = clamp(Math.floor(special), 0, n);
  const ranks = new Map<number, number>();
  for (let i = every - 1; i < n && ranks.size < want; i += every) ranks.set(i, ranks.size);
  const order = shuffled(
    Array.from({ length: cap }, (_, i) => i),
    rng,
  );
  for (const i of order) {
    if (ranks.size >= want) break;
    if (i < n && !ranks.has(i)) ranks.set(i, ranks.size);
  }
  return ranks;
}

/** Особый ли элемент по своему месту в ряду (каждый specialEvery-й), а не превращённый после ёмкости. */
function nativeSpecial(i: number): boolean {
  const every = BALANCE.bosses.specialEvery;
  return i % every === every - 1;
}

function makeItems(p: PlaceProps, slots: [number, number][]): Item[] {
  return slots.slice(0, p.n).map(([x, y], i) => {
    const rng = elemRng(p.seed, i);
    return { i, x, y, rng, rank: p.ranks.get(i), bright: rng() < p.t };
  });
}

const byDepth = (a: { y: number }, b: { y: number }) => a.y - b.y;

/** Звёздочка у особого элемента: мерцает, если движение включено. */
function Sparkle({ x, y, r = 1.7, rng, run }: { x: number; y: number; r?: number; rng: Rng; run: boolean }) {
  const dur = 1.8 + rng() * 1.6;
  const begin = -rng() * dur;
  const q = r * 0.24;
  return (
    <path
      d={`M${x} ${y - r} L${x + q} ${y - q} L${x + r} ${y} L${x + q} ${y + q} L${x} ${y + r} L${x - q} ${y + q} L${x - r} ${y} L${x - q} ${y - q} Z`}
      fill={PALETTE.glow}
      stroke={PALETTE.goldBright}
      stroke-width="0.3"
      stroke-linejoin="round"
    >
      {/* мерцание рывком: плавное перерисовывало бы звёздочку в каждом кадре */}
      {run && <animate attributeName="opacity" calcMode="discrete" values="1;0.35" keyTimes="0;0.5" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />}
    </path>
  );
}

/** Пучок травы: три-четыре травинки. */
function Tuft({ x, y, h, rng }: { x: number; y: number; h: number; rng: Rng }) {
  const blades = Array.from({ length: 4 }, (_, k) => {
    const dx = (k - 1.5) * 0.9 + (rng() - 0.5) * 0.6;
    const lean = (k - 1.5) * 0.9 + (rng() - 0.5) * 1.2;
    const bh = h * (0.6 + rng() * 0.5);
    return `M${x + dx} ${y} q${lean * 0.3} ${-bh * 0.6} ${lean} ${-bh}`;
  });
  return <path d={blades.join(' ')} stroke={pickFrom([PALETTE.hillNear, PALETTE.leafDark, PALETTE.leaf], rng)} stroke-width="0.7" fill="none" stroke-linecap="round" />;
}

// ---------- 1. Пруд с рыбками ----------

const POND = { cy: -15.5, rx: 50, ry: 13.5 };
const WATER_DEEP = '#88bbd0';
const CATTAIL = '#7a4f33';

/** Обычные рыбки: основной цвет, плавники, цвет «ярче» для пышности, пятна у кои. */
const FISH = [
  { body: '#e8833a', fin: '#f2a86a', bright: '#f5701e' }, // оранжевая
  { body: '#f3ebdf', fin: '#f8efe4', bright: '#fffaf2', spots: '#d8503a' }, // белая с красным, как кои
  { body: '#d9603d', fin: '#ec9a78', bright: '#ec4a22' }, // красная
  { body: '#efa64c', fin: '#f6c98a', bright: '#fb9d24' }, // рыжая
];

function Fish({ item, s, gold, run }: { item: Item; s: number; gold: boolean; run: boolean }) {
  const { rng } = item;
  const c = pickFrom(FISH, rng);
  const dir = rng() < 0.5 ? 1 : -1;
  const drift = 1.2 + rng() * 1.6;
  const dur = 5 + rng() * 4;
  const begin = -rng() * dur;
  const wag = 0.7 + rng() * 0.4;
  const body = gold ? PALETTE.goldBright : item.bright ? c.bright : c.body;
  const fin = gold ? PALETTE.sun : c.fin;
  const tail = gold
    ? 'M-3.2 0 C-5.5 -2.8 -8.6 -3.4 -9.2 -1.6 C-7.8 -0.6 -7.8 0.6 -9.2 1.6 C-8.6 3.4 -5.5 2.8 -3.2 0 Z'
    : 'M-3.2 0 L-6.4 -2.1 Q-5.6 0 -6.4 2.1 Z';
  const k = gold ? s * 1.3 : s;
  return (
    <g transform={`translate(${item.x} ${item.y}) scale(${dir * k} ${k})`}>
      <g>
        {run && (
          <animateTransform attributeName="transform" type="translate" values={`0 0;${drift} 0.3;0 0`} dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
        )}
        <path d={tail} fill={fin}>
          {run && <animateTransform attributeName="transform" type="rotate" values="-14 -3.2 0;14 -3.2 0;-14 -3.2 0" dur={`${wag}s`} repeatCount="indefinite" />}
        </path>
        <path d="M-1.6 -1.4 Q0.1 -3 1.5 -1.5 Z" fill={fin} />
        <ellipse rx="4" ry="1.75" fill={body} />
        {c.spots && !gold && (
          <>
            <ellipse cx="-0.9" cy="-0.5" rx="1.3" ry="0.85" fill={c.spots} />
            <ellipse cx="1.5" cy="0.35" rx="0.75" ry="0.6" fill={c.spots} />
          </>
        )}
        {(item.bright || gold) && <path d="M-2.2 -0.95 Q0.4 -1.7 2.6 -0.75" stroke="#fff" stroke-width="0.4" fill="none" opacity="0.6" stroke-linecap="round" />}
        <circle cx="2.7" cy="-0.35" r="0.38" fill={PALETTE.ink} />
      </g>
    </g>
  );
}

/** Лист кувшинки — овал с вырезом; с цветком или без. */
function LilyPad({ x, y, s, rng, flower }: { x: number; y: number; s: number; rng: Rng; flower: boolean }) {
  const rx = 3.8;
  const ry = 1.5;
  const th = rng() * Math.PI * 2;
  const a = 0.32;
  const p1 = [rx * Math.cos(th + a), ry * Math.sin(th + a)].map((v) => v.toFixed(2)).join(' ');
  const p0 = [rx * Math.cos(th - a), ry * Math.sin(th - a)].map((v) => v.toFixed(2)).join(' ');
  const leaf = pickFrom(LEAVES, rng);
  const pink = rng() < 0.4;
  const petal = pink ? PALETTE.petalPink : '#fbf7ef';
  const shade = pink ? '#e48ea0' : '#e9dccb';
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={`M0 0 L${p1} A${rx} ${ry} 0 1 1 ${p0} Z`} fill={leaf} />
      {flower && (
        <g transform="translate(0.4 -0.3)">
          <ellipse cy="0.1" rx="2.4" ry="0.8" fill={shade} />
          {[-62, -31, 0, 31, 62].map((deg) => (
            <ellipse key={deg} rx="0.65" ry="1.7" transform={`rotate(${deg}) translate(0 -1.4)`} fill={petal} />
          ))}
          <circle cy="-0.6" r="0.65" fill="#f2c94c" />
        </g>
      )}
    </g>
  );
}

function Pond(p: PlaceProps) {
  const rng = createRng(p.seed);
  const side = pickFrom([1, -1], rng);
  const extra = elemRng(p.seed, 999, 0x51ed270b);
  const inWater = (x: number, y: number) => (x / 43) ** 2 + ((y - POND.cy) / 10.3) ** 2 < 1;
  const slots = scatter(createRng(p.seed ^ 0x5bd1e995), BALANCE.bosses.gardenCapacity, inWater, [-43, POND.cy - 10.3, 43, POND.cy + 10.3], 9.5);
  const items = makeItems(p, slots).sort(byDepth);
  const s = 1 + 0.12 * p.t;
  // Камыш на дальнем берегу; при пышности гуще.
  const reeds = Array.from({ length: 11 }, () => ({
    dx: (rng() - 0.5) * 13,
    h: 11 + rng() * 10,
    bend: (rng() - 0.5) * 3,
    head: rng() < 0.55,
  })).slice(0, 6 + Math.round(p.t * 5));
  const stones = [-34, -4, 28].map((x0) => {
    const x = x0 + (rng() - 0.5) * 12;
    return { x, y: POND.cy + 14.8 * Math.sqrt(1 - (x / 54) ** 2), rx: 2.2 + rng() * 1.8, c: pickFrom(PEBBLES, rng) };
  });
  const pads = scatter(extra, 6, inWater, [-43, POND.cy - 10.3, 43, POND.cy + 10.3], 12).slice(0, Math.round(p.t * 6));
  const tufts = Array.from({ length: 5 }, () => ({ x: -side * (36 + rng() * 16), y: -3 - rng() * 6, h: 3.5 + rng() * 2.5, r: elemRng(p.seed, 500, rng() * 1e9) }));
  const reedX = side * 41;
  return (
    <g>
      {/* камыш с рогозом на дальнем берегу */}
      <g stroke-linecap="round" fill="none">
        {reeds.map((r, i) => (
          <g key={i}>
            <path d={`M${reedX + r.dx} -26 q${r.bend * 0.4} ${-r.h * 0.6} ${r.bend} ${-r.h}`} stroke={LEAVES[i % 3]} stroke-width="0.8" />
            {r.head && <rect x={reedX + r.dx + r.bend * 0.85 - 0.75} y={-26 - r.h * 0.88} width="1.5" height="3.6" rx="0.7" fill={CATTAIL} />}
          </g>
        ))}
      </g>
      {/* берег, вода, глубина, блики */}
      <ellipse cx="0" cy={POND.cy} rx="55" ry="16" fill={PALETTE.hillNear} />
      <ellipse cx="0" cy={POND.cy} rx={POND.rx} ry={POND.ry} fill={PALETTE.river} />
      <ellipse cx="2" cy={POND.cy + 0.8} rx="37" ry="8.6" fill={WATER_DEEP} opacity="0.7" />
      <path d="M-30 -24 h8 M14 -25 h10 M-12 -7.5 h7 M24 -9 h6" stroke={RIPPLE} stroke-width="0.7" stroke-linecap="round" />
      {/* рыбки под водой, сверху — тонкий слой воды */}
      {items.filter((it) => it.rank === undefined || it.rank % 2 === 1).map((it) => (
        <Fish key={it.i} item={it} s={s} gold={it.rank !== undefined} run={p.run} />
      ))}
      <ellipse cx="0" cy={POND.cy} rx={POND.rx} ry={POND.ry} fill={PALETTE.river} opacity="0.18" />
      {/* кувшинки на воде */}
      {pads.map(([x, y], i) => (
        <LilyPad key={`pad${i}`} x={x} y={y} s={0.8 * s} rng={elemRng(p.seed, 700 + i)} flower={false} />
      ))}
      {items.filter((it) => it.rank !== undefined && it.rank % 2 === 0).map((it) => (
        <LilyPad key={it.i} x={it.x} y={it.y} s={1.15 * s} rng={it.rng} flower />
      ))}
      {items.filter((it) => it.rank !== undefined).map((it) => (
        <Sparkle key={`sp${it.i}`} x={it.x + 3.5} y={it.y - 3.5} rng={elemRng(p.seed, it.i, 0x7f4a7c15)} run={p.run} />
      ))}
      {/* камни и трава на ближнем берегу */}
      {stones.map((st, i) => (
        <g key={i}>
          <ellipse cx={st.x} cy={st.y} rx={st.rx} ry={st.rx * 0.6} fill={st.c.body} />
          <ellipse cx={st.x - st.rx * 0.25} cy={st.y - st.rx * 0.22} rx={st.rx * 0.5} ry={st.rx * 0.22} fill={st.c.light} />
        </g>
      ))}
      {tufts.map((tf, i) => (
        <Tuft key={i} x={tf.x} y={tf.y} h={tf.h} rng={tf.r} />
      ))}
    </g>
  );
}

// ---------- 2. Цветник ----------

/**
 * Овальный цветник, видный сверху наискосок: бортик, по кругу и крест-накрест — посыпанные дорожки,
 * посередине круглая площадка с фонтанчиком или солнечными часами. Четыре клумбы обведены низкой
 * стриженой изгородью; цветы растут на клумбах.
 */
const BED = {
  cy: -15,
  /** Бортик. */
  rx: 54,
  ry: 15,
  /** Внешний край клумб: между ним и бортиком — дорожка по кругу. */
  qx: 48.5,
  qy: 11.4,
  /** Половина ширины дорожки вдоль (ближе к нам шире) и поперёк. */
  pathFront: 4.4,
  pathBack: 3.4,
  pathAcross: 1.9,
  /** Площадка посередине. */
  px: 11,
  py: 4.4,
};
const SOIL = '#7d5a42';
const GRAVEL = '#e3d5b4';
const GRAVEL_DOT = '#c9b994';
const HEDGE = '#4f8344';
const HEDGE_LIGHT = '#6ea25b';

const BED_EDGES = [
  { top: '#a37a52', face: PALETTE.bark, dash: '9 0.7' }, // доски
  { top: '#cbc1b3', face: '#a39888', dash: '4 0.8' }, // камень
  { top: '#c98a6e', face: '#a85e44', dash: '2.6 0.5' }, // кирпич
] as const;
const FOUNTAIN_STONE = { body: '#c3b8a8', light: '#d8cfc2', dark: '#9a8f82' };

/** Клумба-четверть: внешний край — дуга овала, внутренние — края дорожек и площадки. sx, sy — ±1. */
function quarterPath(sx: number, sy: number): string {
  const { cy, qx: a, qy: b, pathAcross: hp, px, py } = BED;
  const w = sy > 0 ? BED.pathFront : BED.pathBack;
  const pt = (x: number, y: number) => `${(sx * x).toFixed(2)} ${(cy + sy * y).toFixed(2)}`;
  const arc = (rx: number, ry: number, f0: number, f1: number, steps: number) =>
    Array.from({ length: steps + 1 }, (_, k) => {
      const f = f0 + ((f1 - f0) * k) / steps;
      return pt(rx * Math.cos(f), ry * Math.sin(f));
    });
  // Углы в первой четверти; знаки sx, sy отражают их в нужную.
  const outer = arc(a, b, Math.asin(hp / b), Math.acos(w / a), 14);
  const inner = arc(px, py, Math.acos(w / px), Math.asin(hp / py), 6);
  return `M${outer.join(' L')} L${inner.join(' L')} Z`;
}

/** Точка на клумбе, с отступом от изгороди. */
function onBed(x: number, y: number): boolean {
  const dy = y - BED.cy;
  const w = dy > 0 ? BED.pathFront : BED.pathBack;
  return (
    (x / (BED.qx - 3)) ** 2 + (dy / (BED.qy - 1.6)) ** 2 < 1 &&
    Math.abs(x) > w + 2.2 &&
    Math.abs(dy) > BED.pathAcross + 1.6 &&
    (x / (BED.px + 2.4)) ** 2 + (dy / (BED.py + 1.4)) ** 2 > 1
  );
}

/** Фонтанчик: чаша, столбик, верхняя чашка, вода бьёт вверх и стекает. */
function Fountain({ run }: { run: boolean }) {
  const st = FOUNTAIN_STONE;
  const jets = ['M0 -8.4 Q-1.6 -11.6 -2.5 -7', 'M0 -8.4 Q1.6 -11.6 2.5 -7', 'M-2.7 -6.6 Q-3.6 -4.4 -4.4 -1.4', 'M2.7 -6.6 Q3.6 -4.4 4.4 -1.4'];
  return (
    <g>
      <ellipse cy="0.9" rx="6.8" ry="2.4" fill={st.dark} />
      <ellipse cy="-0.4" rx="6.8" ry="2.4" fill={st.body} />
      <ellipse cy="-0.6" rx="5.6" ry="1.7" fill={PALETTE.river} />
      <rect x="-0.9" y="-6.6" width="1.8" height="6" fill={st.light} />
      <ellipse cy="-6.2" rx="3" ry="0.9" fill={st.dark} />
      <ellipse cy="-6.7" rx="3" ry="0.9" fill={st.body} />
      <ellipse cy="-6.8" rx="2.3" ry="0.55" fill={PALETTE.river} />
      <path d="M0 -6.8 V-8.6" stroke={PALETTE.river} stroke-width="0.7" stroke-linecap="round" />
      <g stroke={PALETTE.river} stroke-width="0.55" fill="none" stroke-linecap="round" stroke-dasharray={run ? '1.4 0.9' : undefined}>
        {jets.map((d) => (
          <path key={d} d={d}>
            {run && <animate attributeName="stroke-dashoffset" from="2.3" to="0" dur="0.6s" repeatCount="indefinite" />}
          </path>
        ))}
      </g>
      <path d="M-3.2 -0.8 h1.6 M1.6 -0.3 h1.8" stroke={RIPPLE} stroke-width="0.4" stroke-linecap="round" />
    </g>
  );
}

/** Солнечные часы на каменной тумбе. */
function Sundial() {
  const st = FOUNTAIN_STONE;
  return (
    <g>
      <ellipse cy="0.3" rx="3.4" ry="1.2" fill={st.dark} />
      <path d="M-1.6 0 V-5.4 H1.6 V0 Z" fill={st.body} />
      <path d="M0.6 0 V-5.4 H1.6 V0 Z" fill={st.dark} opacity="0.5" />
      <ellipse cy="-5.6" rx="3.4" ry="1.15" fill={st.light} />
      <path d="M-2.4 -5.6 h0.01 M2.4 -5.6 h0.01 M0 -6.5 h0.01 M0 -4.7 h0.01" stroke={st.dark} stroke-width="0.4" stroke-linecap="round" />
      <path d="M-1.4 -5.6 L1.2 -5.6 L-1.2 -8 Z" fill={PALETTE.goldDeep} />
    </g>
  );
}

/** Обычные цветы: вид и цвета; второй цвет в паре — «ярче» для пышности. */
const TULIPS = [
  ['#d8503a', '#ec3a24'],
  [PALETTE.petalPink, '#f78ea6'],
  ['#f2c94c', '#ffd23a'],
  ['#9b6bb0', '#a95cc8'],
];
const BELLS = [
  ['#8fa3e0', '#7790f2'],
  ['#b08fd8', '#b47cf0'],
];
const ASTERS = [
  [PALETTE.petalLilac, '#c98ae8'],
  [PALETTE.petalPink, '#f78ea6'],
  [PALETTE.fire, '#f5701e'],
];

function FlowerHead({ kind, c }: { kind: 'tulip' | 'daisy' | 'bell' | 'aster'; c: string }) {
  switch (kind) {
    case 'tulip':
      return (
        <g>
          <path d="M-1.4 0.2 C-1.7 -1.6 -1.2 -2.9 -0.6 -3 L0 -2.1 L0.6 -3 C1.2 -2.9 1.7 -1.6 1.4 0.2 C0.6 0.9 -0.6 0.9 -1.4 0.2 Z" fill={c} />
          <path d="M0 -2.1 C0.8 -1.6 1 -0.4 0.6 0.6" fill="none" stroke="#000" stroke-opacity="0.14" stroke-width="0.5" />
        </g>
      );
    case 'daisy':
      return (
        <g>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <ellipse key={deg} rx="0.45" ry="1.15" transform={`rotate(${deg}) translate(0 -1.1)`} fill="#fbf7ef" />
          ))}
          <circle r="0.7" fill={c} />
        </g>
      );
    case 'bell': {
      const bell = 'M-0.9 0 C-1 -1.4 -0.5 -1.9 0 -1.9 C0.5 -1.9 1 -1.4 0.9 0 L0.45 -0.35 L0 0.1 L-0.45 -0.35 Z';
      return (
        <g>
          <path d="M0 0 Q1.6 -0.6 2.4 0.6" stroke={PALETTE.hillNear} stroke-width="0.4" fill="none" />
          <path d={bell} fill={c} transform="translate(-0.2 1.9)" />
          <path d={bell} fill={c} transform="translate(2.4 2.6) scale(0.85)" />
        </g>
      );
    }
    case 'aster':
      return (
        <g>
          {Array.from({ length: 12 }, (_, k) => (
            <ellipse key={k} rx="0.32" ry="1" transform={`rotate(${k * 30}) translate(0 -1)`} fill={c} />
          ))}
          <circle r="0.62" fill="#f1d36a" />
        </g>
      );
  }
}

/** Редкие цветы: роза, ирис, лилия — по очереди. */
function RareHead({ rank }: { rank: number }) {
  switch (rank % 3) {
    case 0:
      return (
        <g>
          <path d="M-2 0.8 L-3.2 1.6 M2 0.8 L3.2 1.6" stroke={PALETTE.leafDark} stroke-width="0.8" stroke-linecap="round" />
          <circle r="2.4" fill="#c8324a" />
          <path d="M-1.3 -0.2 A1.3 1.3 0 1 1 1 0.7 M-0.5 0 A0.6 0.6 0 1 1 0.5 0.2" stroke="#e8798a" stroke-width="0.45" fill="none" stroke-linecap="round" />
        </g>
      );
    case 1:
      return (
        <g>
          <path d="M0 0 C-1.2 -0.8 -1.1 -2.8 0 -3.4 C1.1 -2.8 1.2 -0.8 0 0 Z" fill="#9a80d0" />
          <path d="M0 0 C-1.7 0.2 -2.8 1.5 -2.4 2.6 C-1.3 2.4 -0.4 1.3 0 0 Z M0 0 C1.7 0.2 2.8 1.5 2.4 2.6 C1.3 2.4 0.4 1.3 0 0 Z" fill="#6f52a8" />
          <path d="M0 0 C-0.8 0.8 -0.7 2.4 0 2.9 C0.7 2.4 0.8 0.8 0 0 Z" fill="#7b5db8" />
          <path d="M0 0.3 V1.6" stroke="#f2c94c" stroke-width="0.5" stroke-linecap="round" />
        </g>
      );
    default:
      return (
        <g>
          {[-75, -45, -15, 15, 45, 75].map((deg) => (
            <path key={deg} d="M0 0 C0.7 -1 0.6 -2.9 0 -3.5 C-0.6 -2.9 -0.7 -1 0 0 Z" transform={`rotate(${deg})`} fill="#f08a3c" />
          ))}
          <path d="M-1 -1.6 h0.01 M0.9 -1.8 h0.01 M-1.9 -0.6 h0.01 M1.8 -0.7 h0.01" stroke="#9c3f1c" stroke-width="0.4" stroke-linecap="round" />
          <path d="M0 0 L-0.6 -2.2 M0 0 L0 -2.5 M0 0 L0.6 -2.2" stroke="#f6e3a0" stroke-width="0.25" />
        </g>
      );
  }
}

function BedFlower({ item, s, run }: { item: Item; s: number; run: boolean }) {
  const { rng } = item;
  const kind = pickFrom(['tulip', 'tulip', 'daisy', 'bell', 'aster'] as const, rng);
  const pair = kind === 'tulip' ? pickFrom(TULIPS, rng) : kind === 'bell' ? pickFrom(BELLS, rng) : kind === 'aster' ? pickFrom(ASTERS, rng) : ['#f2c94c', '#ffcf2e'];
  const rare = item.rank !== undefined;
  const k = s * depth(item.y, BED.cy - BED.qy, BED.cy + BED.qy) * (rare ? 1.2 : 1);
  const h = rare ? 10 + rng() * 2 : 6 + rng() * 3;
  const lean = (rng() - 0.5) * 1.6;
  const leafSide = rng() < 0.5 ? 1 : -1;
  const c = item.bright ? pair[1]! : pair[0]!;
  return (
    <g transform={`translate(${item.x} ${item.y}) scale(${k})`}>
      <path d={`M0 0 q${lean * 0.3} ${-h * 0.6} ${lean} ${-h}`} stroke={PALETTE.hillNear} stroke-width="0.6" fill="none" />
      <ellipse cx={leafSide * 1.1} cy={-h * 0.35} rx="1.5" ry="0.55" transform={`rotate(${leafSide * -30} ${leafSide * 1.1} ${-h * 0.35})`} fill={PALETTE.leaf} />
      {rare && <ellipse cx={-leafSide * 1.2} cy={-h * 0.55} rx="1.6" ry="0.6" transform={`rotate(${leafSide * 30} ${-leafSide * 1.2} ${-h * 0.55})`} fill={PALETTE.leafDark} />}
      <g transform={`translate(${lean} ${-h})`}>{rare ? <RareHead rank={item.rank!} /> : <FlowerHead kind={kind} c={c} />}</g>
      {rare && <Sparkle x={lean + 3} y={-h - 3} r={1.5} rng={elemRng(item.i, 1, 0x7f4a7c15)} run={run} />}
    </g>
  );
}

/** Лейка у грядки. */
function WateringCan({ x, flip }: { x: number; flip: number }) {
  return (
    <g transform={`translate(${x} 0) scale(${flip} 1)`}>
      <ellipse cy="0.3" rx="4.5" ry="0.6" fill={PALETTE.shadowGreen} opacity="0.22" />
      <path d="M-2 -5.6 Q0 -9.2 2 -5.6" stroke="#6f868d" stroke-width="0.8" fill="none" />
      <path d="M2.6 -2.2 L6.4 -6.6" stroke="#7f979e" stroke-width="1" stroke-linecap="round" />
      <ellipse cx="6.7" cy="-6.9" rx="0.9" ry="0.6" transform="rotate(-40 6.7 -6.9)" fill="#6f868d" />
      <path d="M-3 0 V-5 Q0 -6 3 -5 V0 Z" fill="#8fa6ad" />
      <path d="M1.2 -5.3 V0" stroke="#000" stroke-opacity="0.1" stroke-width="1.8" />
    </g>
  );
}

function Flowerbed(p: PlaceProps) {
  const rng = createRng(p.seed);
  const edge = pickFrom(BED_EDGES, rng);
  const side = pickFrom([1, -1], rng);
  const fountain = rng() < 0.65;
  const box: [number, number, number, number] = [-BED.qx, BED.cy - BED.qy, BED.qx, BED.cy + BED.qy];
  const slots = scatter(createRng(p.seed ^ 0x5bd1e995), BALANCE.bosses.gardenCapacity, onBed, box, 8.5);
  const items = makeItems(p, slots).sort(byDepth);
  const s = 1 + 0.15 * p.t;
  const extra = elemRng(p.seed, 999, 0x51ed270b);
  // Пышность: низкая зелень с цветочками между цветами.
  const filler = scatter(extra, 24, onBed, box, 5)
    .slice(0, Math.round(p.t * 24))
    .map(([x, y]) => ({ x, y, c: pickFrom(LEAVES, extra), dot: pickFrom([PALETTE.petalPink, '#fbf7ef', PALETTE.glow, PALETTE.petalLilac], extra) }));
  // Камешки на дорожках.
  const gravel = Array.from({ length: 40 }, () => [(rng() - 0.5) * 2 * BED.rx, BED.cy + (rng() - 0.5) * 2 * BED.ry] as const).filter(
    ([x, y]) => (x / (BED.rx - 3)) ** 2 + ((y - BED.cy) / (BED.ry - 2)) ** 2 < 1,
  );
  const { cy } = BED;
  const back = items.filter((it) => it.y < cy);
  const front = items.filter((it) => it.y >= cy);
  const quarters = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sy]) => quarterPath(sx!, sy!));
  const flowers = (list: Item[]) => list.map((it) => <BedFlower key={it.i} item={it} s={s} run={p.run} />);
  return (
    <g>
      <ellipse cy="1.4" rx={BED.rx} ry="2.6" fill={PALETTE.shadowGreen} opacity="0.2" />
      {/* бортик: лицевая сторона и верх */}
      <ellipse cy={cy + 2} rx={BED.rx} ry={BED.ry} fill={edge.face} />
      <ellipse cy={cy} rx={BED.rx} ry={BED.ry} fill={GRAVEL} />
      <ellipse cy={cy} rx={BED.rx - 1.5} ry={BED.ry - 1.1} fill="none" stroke={edge.top} stroke-width="3" stroke-dasharray={edge.dash} />
      {/* дорожки и площадка — песок с камешками, клумбы — земля в стриженой изгороди */}
      <path d={gravel.map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)} h0.01`).join(' ')} stroke={GRAVEL_DOT} stroke-width="0.6" stroke-linecap="round" />
      <ellipse cy={cy} rx={BED.px - 1} ry={BED.py - 0.6} fill="none" stroke={GRAVEL_DOT} stroke-width="0.5" />
      {quarters.map((d) => (
        <g key={d}>
          <path d={d} fill={SOIL} stroke={HEDGE} stroke-width="1.8" stroke-linejoin="round" />
          <path d={d} fill="none" stroke={HEDGE_LIGHT} stroke-width="0.6" stroke-linejoin="round" stroke-dasharray="1.2 1.6" transform="translate(0 -0.5)" />
        </g>
      ))}
      {filler.map((f, i) => (
        <g key={`f${i}`}>
          <ellipse cx={f.x} cy={f.y - 0.6} rx="1.6" ry="0.9" fill={f.c} />
          <circle cx={f.x + 0.5} cy={f.y - 1} r="0.45" fill={f.dot} />
        </g>
      ))}
      {flowers(back)}
      <g transform={`translate(0 ${cy})`}>{fountain ? <Fountain run={p.run} /> : <Sundial />}</g>
      {flowers(front)}
      <WateringCan x={side * 60} flip={-side} />
    </g>
  );
}

// ---------- 3. Пасека ----------

const CLEARING = { cy: -13, rx: 56, ry: 12.5 };
const CLEARING_GRASS = '#a6c695';
const WATTLE = '#a07850';

/** Улей: цвет стенок и «ярче» для пышности. */
const HIVES = [
  { body: '#8fb0c9', bright: '#71a6dc' },
  { body: '#e6c66e', bright: '#f6c93e' },
  { body: '#eee6d9', bright: '#fffaf2' },
  { body: '#9bbf8e', bright: '#7fc566' },
  { body: '#d9a08b', bright: '#ee8c68' },
];
const HIVE_ROOFS = ['#7d5638', '#66707a', '#a0573e'];
const STRAW = '#d9b26a';
const STRAW_BAND = '#b8893f';

/** Ряды для ульев: дальний и ближний. Ульи ставятся от середины к краям. */
const HIVE_ROWS = [
  { y: -18, xs: [-42, -28, -14, 0, 14, 28, 42] },
  { y: -6.5, xs: [-35, -21, -7, 7, 21, 35] },
];

function Hive({ x, y, s, rng, bright }: { x: number; y: number; s: number; rng: Rng; bright: boolean }) {
  const c = pickFrom(HIVES, rng);
  const roof = pickFrom(HIVE_ROOFS, rng);
  const boxes = rng() < 0.5 ? 2 : 3;
  const body = bright ? c.bright : c.body;
  const top = -2.6 - boxes * 4.4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="0.3" rx="6.5" ry="0.9" fill={PALETTE.shadowGreen} opacity="0.25" />
      <path d="M-4 0 V-2 M4 0 V-2" stroke={PALETTE.barkDark} stroke-width="1" />
      <rect x="-5.6" y="-2.8" width="11.2" height="1" fill={PALETTE.bark} />
      <rect x="-5" y={top} width="10" height={boxes * 4.4} fill={body} />
      <path d={Array.from({ length: boxes - 1 }, (_, b) => `M-5 ${-2.6 - (b + 1) * 4.4} H5`).join(' ')} stroke="#000" stroke-opacity="0.18" stroke-width="0.4" />
      <rect x="2.4" y={top} width="2.6" height={boxes * 4.4} fill="#000" opacity="0.1" />
      <path d={`M-6.2 ${top} L0 ${top - 3.4} L6.2 ${top} Z`} fill={roof} />
      <rect x="-6.4" y={top - 0.4} width="12.8" height="0.9" fill={PALETTE.barkDark} />
      <rect x="-2" y="-4" width="4" height="0.8" fill={PALETTE.ink} opacity="0.85" />
      <rect x="-2.6" y="-3.2" width="5.2" height="0.5" fill={PALETTE.canvas} />
    </g>
  );
}

/** Соломенный улей-колпак — особый элемент пасеки. */
function Skep({ x, y, s, rng, run }: { x: number; y: number; s: number; rng: Rng; run: boolean }) {
  const bands = [-5.3, -7.6, -9.9, -12.1, -14];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="0.3" rx="7" ry="0.9" fill={PALETTE.shadowGreen} opacity="0.25" />
      <path d="M-5 0 V-1.8 M5 0 V-1.8" stroke={PALETTE.barkDark} stroke-width="1" />
      <rect x="-6.8" y="-3.1" width="13.6" height="1.4" rx="0.4" fill={PALETTE.bark} />
      <path d="M-5.8 -3 C-6.4 -10 -3.5 -15.6 0 -15.6 C3.5 -15.6 6.4 -10 5.8 -3 Z" fill={STRAW} />
      <path
        d={bands.map((yy) => {
          const w = 6 * Math.sqrt(Math.max(0, 1 - ((yy + 3) / 12.8) ** 2));
          return `M${-w} ${yy} Q0 ${yy + 0.9} ${w} ${yy}`;
        }).join(' ')}
        stroke={STRAW_BAND}
        stroke-width="0.55"
        fill="none"
      />
      <path d="M1.5 -15.2 C4.5 -13.5 6.2 -9 5.8 -3 L2.5 -3 C3 -8 2.8 -12.5 1.5 -15.2 Z" fill="#000" opacity="0.08" />
      <path d="M-1.7 -3 A1.7 1.5 0 0 1 1.7 -3 Z" fill={PALETTE.ink} />
      <path d="M-3.6 -11 Q-3 -13.6 -0.8 -14.6" stroke="#fff" stroke-width="0.5" fill="none" opacity="0.4" stroke-linecap="round" />
      <Sparkle x={5} y={-15} r={1.6} rng={rng} run={run} />
    </g>
  );
}

function Bee({ x, y, s, rng, run, gold }: { x: number; y: number; s: number; rng: Rng; run: boolean; gold: boolean }) {
  const ax = 1.5 + rng() * 2;
  const ay = 1 + rng() * 1.2;
  const dur = 1.8 + rng() * 1.8;
  const begin = -rng() * dur;
  const dir = rng() < 0.5 ? 1 : -1;
  const k = gold ? s * 1.6 : s * 1.2;
  return (
    <g transform={`translate(${x} ${y}) scale(${dir * k} ${k})`}>
      <g>
        {run && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`0 0;${ax} ${-ay};${2 * ax} 0;${ax} ${ay};0 0`}
            dur={`${dur}s`}
            begin={`${begin}s`}
            repeatCount="indefinite"
          />
        )}
        <ellipse cx="-0.4" cy="-1" rx="0.9" ry="0.55" transform="rotate(-25 -0.4 -1)" fill="#fff" opacity="0.85" />
        <ellipse cx="0.3" cy="-1.1" rx="0.8" ry="0.5" transform="rotate(20 0.3 -1.1)" fill="#fff" opacity="0.85" />
        <ellipse rx="1.25" ry="0.85" fill={gold ? PALETTE.goldBright : '#e2b04a'} />
        <path d="M-0.35 -0.75 V0.75 M0.35 -0.8 V0.8" stroke={PALETTE.ink} stroke-width="0.35" />
        <circle cx="1.2" cy="-0.1" r="0.45" fill={PALETTE.ink} />
      </g>
      {gold && <Sparkle x={1.6} y={-2} r={1} rng={rng} run={run} />}
    </g>
  );
}

function Apiary(p: PlaceProps) {
  const rng = createRng(p.seed);
  const side = pickFrom([1, -1], rng);
  const every = BALANCE.bosses.specialEvery;
  const inClearing = (x: number, y: number) => (x / (CLEARING.rx - 4)) ** 2 + ((y - CLEARING.cy) / (CLEARING.ry - 1.5)) ** 2 < 1;
  // Места ульев — от середины к краям, с разбросом по сиду.
  const slotRng = createRng(p.seed ^ 0x5bd1e995);
  const hiveSlots = HIVE_ROWS.flatMap((row) => row.xs.map((x) => ({ x: x + (slotRng() - 0.5) * 3, y: row.y + (slotRng() - 0.5) * 1.5, key: Math.abs(x) + slotRng() * 18 })))
    .sort((a, b) => a.key - b.key);
  const beeSlots = scatter(slotRng, BALANCE.bosses.gardenCapacity, (x, y) => Math.abs(x) < 50 && y < -9, [-50, -40, 50, -9], 8);
  // Элементы по порядку: каждый specialEvery-й — улей-колпак, из остальных каждый четвёртый — улей, прочие — пчёлы.
  const items = makeItems(p, Array.from({ length: p.n }, () => [0, 0] as [number, number]));
  let hives = 0;
  let bees = 0;
  const placed = items.map((it) => {
    const regular = it.i - Math.floor((it.i + 1) / every);
    const hiveLike = nativeSpecial(it.i) || regular % 4 === 0;
    const slot = hiveLike ? hiveSlots[hives++ % hiveSlots.length]! : { x: beeSlots[bees]![0], y: beeSlots[bees++]![1] };
    return { ...it, x: slot.x, y: slot.y, hiveLike };
  });
  const s = 1 + 0.1 * p.t;
  const extra = elemRng(p.seed, 999, 0x51ed270b);
  const flowers = scatter(extra, 24, inClearing, [-52, CLEARING.cy - 11, 52, CLEARING.cy + 11], 7).slice(0, 9 + Math.round(p.t * 15));
  const flowerLook = flowers.map(() => ({ c: pickFrom(['#fbf7ef', '#e8a0b8', '#a88fd0', '#fbf7ef'], extra), lavender: extra() < 0.3 }));
  const extraBees = beeSlots.slice(0, Math.round(p.t * 10)).map(([x, y], i) => ({ x: x + 3, y: y + 2, rng: elemRng(p.seed, 800 + i) }));
  const posts = Array.from({ length: 9 }, (_, k) => {
    const x = -50 + k * 12.5;
    return { x, y: CLEARING.cy - CLEARING.ry * Math.sqrt(1 - (x / CLEARING.rx) ** 2) + 2 };
  });
  const weave = [3, 5.5, 8].map((h, band) =>
    posts
      .map((pt, k) => {
        if (k === 0) return `M${pt.x} ${pt.y - h}`;
        const prev = posts[k - 1]!;
        const bulge = (k + band) % 2 === 0 ? 0.9 : -0.9;
        return `Q${(prev.x + pt.x) / 2} ${(prev.y + pt.y) / 2 - h + bulge} ${pt.x} ${pt.y - h}`;
      })
      .join(' '),
  );
  const ground = placed.filter((it) => it.hiveLike).sort(byDepth);
  const air = placed.filter((it) => !it.hiveLike);
  return (
    <g>
      {/* поляна и плетень */}
      <ellipse cx="0" cy={CLEARING.cy} rx={CLEARING.rx} ry={CLEARING.ry} fill={CLEARING_GRASS} />
      <path d={posts.map((pt) => `M${pt.x} ${pt.y} V${pt.y - 10}`).join(' ')} stroke={PALETTE.barkDark} stroke-width="1.1" stroke-linecap="round" />
      <path d={weave.join(' ')} stroke={WATTLE} stroke-width="1.6" fill="none" stroke-linecap="round" />
      <path d={weave.join(' ')} stroke={PALETTE.bark} stroke-width="0.4" fill="none" opacity="0.6" />
      {/* клевер и лаванда */}
      {flowers.map(([x, y], i) =>
        flowerLook[i]!.lavender ? (
          <g key={i}>
            <path d={`M${x} ${y} l-0.8 -3.6 M${x} ${y} v-4 M${x} ${y} l0.8 -3.6`} stroke={PALETTE.leafDark} stroke-width="0.4" />
            {[-0.8, 0, 0.8].map((dx, j) => (
              <ellipse key={j} cx={x + dx * 1.05} cy={y - 4 - (j === 1 ? 0.4 : 0)} rx="0.45" ry="1.1" fill="#9d84cc" />
            ))}
          </g>
        ) : (
          <g key={i}>
            <path d={`M${x} ${y} v-1.6`} stroke={PALETTE.leafDark} stroke-width="0.4" />
            <circle cx={x} cy={y - 1.8} r="0.9" fill={flowerLook[i]!.c} />
          </g>
        ),
      )}
      {/* пень сбоку */}
      <g transform={`translate(${side * 49} -4)`}>
        <path d="M-3.4 0 V-3.6 H3.4 V0 Q0 1 -3.4 0 Z" fill="#8a6a4a" />
        <ellipse cy="-3.6" rx="3.4" ry="1.1" fill="#c9a27a" />
        <ellipse cy="-3.6" rx="1.8" ry="0.55" fill="none" stroke="#a5805a" stroke-width="0.3" />
      </g>
      {ground.map((it) =>
        it.rank !== undefined ? (
          <Skep key={it.i} x={it.x} y={it.y} s={s * depth(it.y, -18, -6.5)} rng={it.rng} run={p.run} />
        ) : (
          <Hive key={it.i} x={it.x} y={it.y} s={s * depth(it.y, -18, -6.5)} rng={it.rng} bright={it.bright} />
        ),
      )}
      {air.map((it) => (
        <Bee key={it.i} x={it.x} y={it.y} s={s} rng={it.rng} run={p.run} gold={it.rank !== undefined} />
      ))}
      {extraBees.map((b, i) => (
        <Bee key={`b${i}`} x={b.x} y={b.y} s={s} rng={b.rng} run={p.run} gold={false} />
      ))}
    </g>
  );
}

// ---------- 4. Луг с бабочками ----------

const MEADOW = { cy: -12, rx: 57, ry: 12 };
const MEADOW_GRASS = '#a3c488';

// ---------- Луг: плоские бабочки ----------
// Переделка 24.11.2026: прежние бабочки (настоящие виды, яркие, крупные) выбивались из долины.
// Теперь — плоские силуэты с каймой своего цвета; летающие — над лугом, на фоне холма, с тенью на траве.
// Цветы луга мельче и приглушённее, чтобы бабочки на них не терялись.

/** Тот же оттенок, светлота ниже на долю amount (0.27 — на 27 %). */
function darker(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = d === 0 ? 0 : (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  const l2 = l * (1 - amount);
  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s;
  const p = 2 * l2 - q;
  const ch = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${ch(h + 1 / 3)}${ch(h)}${ch(h - 1 / 3)}`;
}

interface WingColors {
  wing: string;
  /** Пятно — чуть темнее крыла. */
  spot: string;
  /** Кайма — тот же оттенок, светлота ниже на 27 %. */
  edge: string;
}
const wingColors = (wing: string, edge: string): WingColors => ({ wing, spot: darker(wing, 0.12), edge });

/**
 * Обычные бабочки и как часто встречаются. Правило пользователя: ни одна не ярче солнца эскиза (PALETTE.sun) —
 * заметность даёт тёмная кайма и тень, а не насыщенность.
 */
const MEADOW_WINGS = [
  { colors: wingColors('#f2d27a', '#b8913a'), weight: 3 }, // сливочно-жёлтая
  { colors: wingColors('#f0a868', '#b86e35'), weight: 3 }, // абрикосовая
  { colors: wingColors('#e3949a', '#a85e66'), weight: 1 }, // пыльно-розовая
];
/** Тёплая белая — две-три на лугу: какие по счёту (если не особые). */
const WHITE_WING = wingColors('#f7efe0', '#a8977c');
const WHITE_AT = [3, 16, 27];
/** Особая (каждая 5-я) — голубая, крупнее обычных. */
const MEADOW_RARE_WING = wingColors('#9fc3dd', '#5f8ea6');
const BUTTERFLY_BODY = '#4a3d33';
/** Цветы луга — мелкие и приглушённые, чтобы не спорить с бабочками. */
const MUTED_FLOWERS = ['#e6d3d8', '#efe9d2', '#d7cde3', '#e5dcb2'];

function MutedFlower({ x, y, h, rng }: { x: number; y: number; h: number; rng: Rng }) {
  const lean = (rng() - 0.5) * 1.2;
  return (
    <g>
      <path d={`M${x} ${y} q${lean * 0.4} ${-h * 0.6} ${lean} ${-h}`} stroke={PALETTE.hillNear} stroke-width="0.4" fill="none" />
      <circle cx={x + lean} cy={y - h} r={0.85 + rng() * 0.35} fill={pickFrom(MUTED_FLOWERS, rng)} />
    </g>
  );
}
/** Крылья бабочки: левая пара, размах около 19,6 (начало — середина тела); правая пара — зеркало левой. */
const FW = 'M-0.4 -1.2 C-2.5 -4.2 -6 -7.2 -9.2 -7.6 C-9.8 -5 -9.2 -1.6 -7.4 0.8 C-5 1.6 -2.2 1.4 -0.4 0.6 Z';
const HW = 'M-0.4 0.4 C-3 0.2 -7.2 1 -7.6 3.6 C-7.8 6.2 -5.2 8.4 -2.8 7.8 C-1.2 7.2 -0.5 4.6 -0.3 2.4 Z';
const SIL_WIDTH = 19.6;
/** Размах бабочки на лугу в единицах рамки (прежние были около 8,4); решение пользователя 24.11.2026. */
const BUTTERFLY_SPAN = 8;
/** Летающие бабочки — над светлым пятном луга, на фоне холма: от и до (y в единицах рамки). */
const FLY_LOW = -25.5;
const FLY_HIGH = -33;
/** Сколько секунд бабочка машет крыльями в свою очередь; остальное время крылья раскрыты. */
const FLAP_SECONDS = 2;
/** Сколько плавных взмахов за это время. */
const FLAPS_PER_TURN = 3;
/** Следующая бабочка начинает махать через столько секунд после предыдущей: машут одна-две сразу, не в такт. */
const FLAP_START_EVERY = 1.5;
/** Цикл не короче: при нескольких бабочках они машут с передышкой, а не без конца. */
const FLAP_CYCLE_MIN = 6;

/**
 * n точек внутри области, разложенных ровно: каждая следующая — самая далёкая от уже поставленных
 * из нескольких случайных (по вертикали расстояние вдвое важнее: луг виден наискосок). Первые точки
 * тоже разбросаны по всему лугу, поэтому и при малом числе бабочек они не сбиваются в кучу.
 */
function spread(rng: Rng, n: number, inside: (x: number, y: number) => boolean, [x0, y0, x1, y1]: [number, number, number, number]): [number, number][] {
  const pts: [number, number][] = [];
  const sample = (): [number, number] => {
    for (;;) {
      const p: [number, number] = [x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)];
      if (inside(p[0], p[1])) return p;
    }
  };
  while (pts.length < n) {
    let best = sample();
    let bestD = -1;
    for (let c = 0; c < 14; c++) {
      const cand = c === 0 ? best : sample();
      const d = Math.min(Infinity, ...pts.map(([px, py]) => Math.hypot(px - cand[0], (py - cand[1]) * 2)));
      if (d > bestD) {
        best = cand;
        bestD = d;
      }
    }
    pts.push(best);
  }
  return pts;
}

interface MeadowButterflyLook {
  i: number;
  /** Точка на земле под бабочкой — по ней порядок рисования и глубина. */
  gx: number;
  gy: number;
  /** Где сама бабочка. */
  y: number;
  /** Высота цветка, на котором сидит; 0 — летает. */
  perch: number;
  flower: string;
  colors: WingColors;
  k: number;
  opacity: number;
  tilt: number;
  /** Когда начинается очередь этой бабочки махать крыльями, секунд от начала цикла. */
  begin: number;
}

function SilhouetteWings({ c }: { c: WingColors }) {
  return (
    <g stroke={c.edge} stroke-width="1.4" stroke-linejoin="round">
      <path d={HW} fill={c.wing} />
      <path d={FW} fill={c.wing} />
      <circle cx="-5" cy="-3" r="1.2" fill={c.spot} stroke="none" />
    </g>
  );
}

function MeadowButterfly({ b, cycle, run }: { b: MeadowButterflyLook; cycle: number; run: boolean }) {
  // В свою очередь (первые FLAP_SECONDS цикла от begin) — несколько плавных взмахов, остальное время крылья раскрыты.
  const w = FLAP_SECONDS / cycle;
  const steps = FLAPS_PER_TURN * 2;
  const values = [...Array.from({ length: steps }, (_, j) => (j % 2 === 0 ? '1 1' : '0.3 1')), '1 1', '1 1'].join(';');
  const keyTimes = [...Array.from({ length: steps + 1 }, (_, j) => ((w * j) / steps).toFixed(4)), '1'].join(';');
  return (
    <g>
      {b.perch > 0 ? (
        <g>
          <path d={`M${b.gx} ${b.gy} q0.3 ${-b.perch * 0.6} 0 ${-b.perch}`} stroke={PALETTE.hillNear} stroke-width="0.5" fill="none" />
          <circle cx={b.gx} cy={b.gy - b.perch} r="1" fill={b.flower} />
        </g>
      ) : (
        // тень летающей на траве
        <ellipse cx={b.gx} cy={b.gy} rx={0.32 * b.k * SIL_WIDTH} ry={0.1 * b.k * SIL_WIDTH} fill={PALETTE.shadowGreen} opacity="0.25" />
      )}
      <g transform={`translate(${b.gx.toFixed(2)} ${b.y.toFixed(2)}) rotate(${b.tilt.toFixed(1)}) scale(${b.k.toFixed(3)})`} opacity={b.opacity.toFixed(2)}>
        <g>
          {run && (
            <animateTransform
              attributeName="transform"
              type="scale"
              values={values}
              keyTimes={keyTimes}
              dur={`${cycle.toFixed(2)}s`}
              begin={`${b.begin.toFixed(2)}s`}
              repeatCount="indefinite"
            />
          )}
          <SilhouetteWings c={b.colors} />
          <g transform="scale(-1 1)">
            <SilhouetteWings c={b.colors} />
          </g>
        </g>
        <path d="M0 -2.6 V5.4" stroke={BUTTERFLY_BODY} stroke-width="1.1" stroke-linecap="round" />
        <path d="M-0.3 -2.4 Q-1.4 -5 -2.6 -6.2 M0.3 -2.4 Q1.4 -5 2.6 -6.2" stroke={BUTTERFLY_BODY} stroke-width="0.5" fill="none" stroke-linecap="round" />
      </g>
    </g>
  );
}

function Meadow(p: PlaceProps) {
  const rng = createRng(p.seed);
  const inMeadow = (x: number, y: number) => (x / (MEADOW.rx - 3)) ** 2 + ((y - MEADOW.cy) / (MEADOW.ry - 1)) ** 2 < 1;
  const box: [number, number, number, number] = [-54, MEADOW.cy - 11, 54, MEADOW.cy + 11];
  const far = MEADOW.cy - MEADOW.ry + 1;
  const near = MEADOW.cy + MEADOW.ry - 1;
  // Земля под бабочками — ровно по всему лугу, с отступом от края.
  const ground = spread(
    createRng(p.seed ^ 0x5bd1e995),
    BALANCE.bosses.gardenCapacity,
    (x, y) => (x / (MEADOW.rx - 7)) ** 2 + ((y - MEADOW.cy) / (MEADOW.ry - 2.5)) ** 2 < 1,
    box,
  );
  // Пышность — гуще и выше трава, больше цветов; бабочки не меняются.
  const extra = elemRng(p.seed, 999, 0x51ed270b);
  const tufts = scatter(rng, 40, inMeadow, box, 9)
    .slice(0, 16 + Math.round(p.t * 24))
    .map(([x, y]) => ({ x, y, r: elemRng(p.seed, Math.round(x * 100 + y)) }));
  const flowers = scatter(extra, 36, inMeadow, box, 6)
    .slice(0, 10 + Math.round(p.t * 26))
    .map(([x, y], i) => ({ x, y, r: elemRng(p.seed, 600 + i) }));
  const grassH = 1 + 0.35 * p.t;
  // Взмахи по очереди: каждая следующая бабочка начинает через FLAP_START_EVERY секунд после предыдущей.
  const cycle = Math.max(FLAP_CYCLE_MIN, p.n * FLAP_START_EVERY);
  const turn = shuffled(
    Array.from({ length: p.n }, (_, i) => i),
    createRng(p.seed ^ 0x27d4eb2f),
  );
  // На дальней половине луга бабочки летают — выше травы, на фоне холма, тень на траве; на ближней сидят на цветах.
  const butterflies: MeadowButterflyLook[] = ground.slice(0, p.n).map(([gx, gy], i) => {
    const r = elemRng(p.seed, i);
    const d = depth(gy, far, near);
    const sits = gy >= MEADOW.cy - 1;
    const flyAt = FLY_LOW + (FLY_HIGH - FLY_LOW) * r();
    const perch = (3 + r() * 2.5) * d;
    const rare = p.ranks.has(i);
    return {
      i,
      gx,
      gy,
      y: sits ? gy - perch - 0.3 : flyAt,
      perch: sits ? perch : 0,
      flower: pickFrom(MUTED_FLOWERS, r),
      colors: rare ? MEADOW_RARE_WING : WHITE_AT.includes(i) ? WHITE_WING : pickWeighted(MEADOW_WINGS, (w) => w.weight, r).colors,
      k: (BUTTERFLY_SPAN / SIL_WIDTH) * d * (rare ? 1.2 : 1),
      opacity: 0.85 + 0.75 * (d - 0.8),
      tilt: (r() - 0.5) * (sits ? 16 : 36),
      begin: turn.indexOf(i) * FLAP_START_EVERY,
    };
  });
  type Drawn = { y: number; el: JSX.Element };
  const drawn: Drawn[] = [
    ...tufts.map((tf, i) => ({ y: tf.y, el: <Tuft key={`t${i}`} x={tf.x} y={tf.y} h={(4 + tf.r() * 3) * grassH * depth(tf.y, far, near)} rng={tf.r} /> })),
    ...flowers.map((f, i) => ({ y: f.y, el: <MutedFlower key={`f${i}`} x={f.x} y={f.y} h={(3 + f.r() * 4) * depth(f.y, far, near)} rng={f.r} /> })),
    ...butterflies.filter((b) => b.perch > 0).map((b) => ({ y: b.gy + 0.01, el: <MeadowButterfly key={`b${b.i}`} b={b} cycle={cycle} run={p.run} /> })),
  ];
  return (
    <g>
      <ellipse cx="0" cy={MEADOW.cy} rx={MEADOW.rx} ry={MEADOW.ry} fill={MEADOW_GRASS} />
      {drawn.sort((a, b) => a.y - b.y).map((d) => d.el)}
      {/* летающие — поверх травы, дальние первыми */}
      {butterflies
        .filter((b) => b.perch === 0)
        .sort((a, b) => a.gy - b.gy)
        .map((b) => (
          <MeadowButterfly key={`b${b.i}`} b={b} cycle={cycle} run={p.run} />
        ))}
    </g>
  );
}

export function GardenArt({
  kind,
  seed,
  size,
  count,
  special,
  bloom,
  still = false,
}: {
  kind: GardenKind;
  seed: number;
  size: number;
  count: number;
  special: number;
  bloom: number;
  /** Без движения: например, когда на странице много мест сразу (галерея). */
  still?: boolean;
}) {
  const cap = BALANCE.bosses.gardenCapacity;
  const n = clamp(Math.floor(count), 0, cap);
  const p: PlaceProps = {
    seed,
    n,
    ranks: specialRanks(n, special, cap, createRng(seed ^ 0x2545f491)),
    t: clamp(bloom / BLOOM_FULL, 0, 1),
    run: !still && moves(),
  };
  const art = (() => {
    switch (kind) {
      case 'pond':
        return <Pond {...p} />;
      case 'flowerbed':
        return <Flowerbed {...p} />;
      case 'apiary':
        return <Apiary {...p} />;
      case 'meadow':
        return <Meadow {...p} />;
    }
  })();
  return (
    <g transform={`scale(${size / GARDEN_BOX.height})`} role="img" aria-label={GARDEN_NAMES[kind]}>
      {art}
    </g>
  );
}
