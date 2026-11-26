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
import { useId } from 'preact/hooks';
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
// Переделка 25.11.2026: прежние рыбки (вид сбоку, оранжевые, красные и кои вперемешку) были мелкие и пёстрые,
// пруд — ровный эллипс в толстом зелёном кольце. Теперь — кои, видные сверху: тело-капля, слегка изогнутое
// буквой S, два грудных плавника в стороны, хвост-веер, узор — пятна на спине, без обводки. Пруд неровный
// (по сиду), с тонкой тёмной кромкой, камнями по краю и камышом группами; вода темнее к середине, чтобы
// белые рыбы читались. Рыбы крупные — около 1/6 ширины пруда — и плавают кто куда, часть — под кувшинками.

/** Пруд: середина и полуоси до неровностей. */
const POND = { cy: -15, rx: 48, ry: 13 };
const WATER_EDGE = '#5b8a92';
/** На тон глубже PALETTE.river — середина пруда. */
const WATER_DEEP = '#80b4ca';
const CATTAIL = '#7a4f33';

const KOI_WHITE = '#f7efe0';
const KOI_RED = '#d9573a';
const KOI_BLACK = PALETTE.ink;
/** Длина рыбы с хвостом — около 1/6 ширины пруда. */
const KOI_LENGTH = (2 * POND.rx) / 6;
/** До стольких рыб размер полный; дальше рыбы мельчают, и вместе они занимают столько же воды, сколько 12 полных. */
const KOI_CROWD = 12;
const koiSize = (n: number) => (n <= KOI_CROWD ? 1 : Math.sqrt(KOI_CROWD / n));
/** Пруд виден наискосок: рыба сплющена по вертикали. */
const KOI_SQUASH = 0.6;

/** Пятно на спине: цвет, где вдоль тела (0 — нос, 1 — хвост), сдвиг поперёк, полуоси. */
type Mark = [color: string, u: number, dy: number, rx: number, ry: number];

interface Koi {
  name: string;
  body: string;
  /** Плавники и хвост. */
  fin: string;
  marks: Mark[];
  /** Как часто встречается. */
  weight: number;
}

export const KOI: Record<string, Koi> = {
  kohaku: {
    name: 'Кохаку — белый с красным',
    body: KOI_WHITE,
    fin: KOI_WHITE,
    weight: 3,
    marks: [
      [KOI_RED, 0.12, 0, 1.25, 1],
      [KOI_RED, 0.43, -0.25, 1.8, 1.25],
      [KOI_RED, 0.73, 0.3, 1, 0.7],
    ],
  },
  tancho: {
    name: 'Тантё — красное пятно на голове',
    body: KOI_WHITE,
    fin: KOI_WHITE,
    weight: 1,
    marks: [[KOI_RED, 0.11, 0, 0.75, 0.62]],
  },
  sanke: {
    name: 'Санке — белый с красным и чёрным',
    body: KOI_WHITE,
    fin: KOI_WHITE,
    weight: 2,
    marks: [
      [KOI_RED, 0.14, 0.1, 1.1, 0.9],
      [KOI_RED, 0.5, -0.2, 1.5, 1.1],
      [KOI_BLACK, 0.33, 0.75, 0.45, 0.35],
      [KOI_BLACK, 0.63, -0.6, 0.5, 0.4],
      [KOI_BLACK, 0.8, 0.25, 0.35, 0.3],
    ],
  },
  bekko: {
    name: 'Сиро бекко — белый с чёрным',
    body: KOI_WHITE,
    fin: KOI_WHITE,
    weight: 2,
    marks: [
      [KOI_BLACK, 0.3, -0.5, 0.55, 0.45],
      [KOI_BLACK, 0.52, 0.5, 0.65, 0.5],
      [KOI_BLACK, 0.76, -0.2, 0.45, 0.35],
    ],
  },
  showa: {
    name: 'Сёва — чёрный с красным и белым',
    body: KOI_BLACK,
    fin: KOI_BLACK,
    weight: 1,
    marks: [
      [KOI_RED, 0.15, 0, 1.1, 0.9],
      [KOI_RED, 0.48, 0.3, 1.4, 1],
      [KOI_WHITE, 0.35, -0.8, 0.7, 0.5],
      [KOI_WHITE, 0.7, -0.3, 0.6, 0.45],
    ],
  },
};
export type KoiKind = keyof typeof KOI;

/** Особая — золотая кои (огон), без искр. */
const GOLD_KOI: Koi = { name: 'Огон', body: PALETTE.goldBright, fin: PALETTE.sun, marks: [], weight: 0 };

/** Замкнутая плавная линия через точки (сплайн Катмулла — Рома). */
function smoothClosed(pts: [number, number][]): string {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n]!;
  const f = (v: number) => v.toFixed(2);
  let d = `M${f(at(0)[0])} ${f(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

// Рыба нарисована носом вправо: нос — x = 5, начало хвоста — x = −3,5, конец веера — около −6,1.
const KOI_NOSE = 5;
const KOI_BODY = 8.5;
const KOI_HALF = 1.55;
/** Полуширина тела вдоль него (доли KOI_HALF): капля, шире всего ближе к голове. */
const KOI_PROFILE: [u: number, w: number][] = [
  [0, 0],
  [0.08, 0.62],
  [0.2, 0.9],
  [0.35, 1],
  [0.5, 0.92],
  [0.65, 0.72],
  [0.8, 0.48],
  [0.92, 0.28],
  [1, 0.16],
];
/** Длина с хвостом: тело и веер. */
const KOI_FULL = KOI_BODY + 2.6;
const KOI_TAIL = 'M0.3 0 C-0.8 -0.5 -1.9 -1.9 -2.6 -2 C-2.1 -0.7 -2.1 0.7 -2.6 2 C-1.9 1.9 -0.8 0.5 0.3 0 Z';

/** Одна кои: тело изогнуто буквой S на bend (0 — прямая). */
function KoiShape({ koi, bend, clip }: { koi: Koi; bend: number; clip: string }) {
  const xAt = (u: number) => KOI_NOSE - u * KOI_BODY;
  const yAt = (u: number) => bend * Math.sin(2 * Math.PI * u);
  const top = KOI_PROFILE.map(([u, w]) => [xAt(u), yAt(u) - KOI_HALF * w] as [number, number]);
  const bottom = KOI_PROFILE.map(([u, w]) => [xAt(u), yAt(u) + KOI_HALF * w] as [number, number]);
  const body = smoothClosed([...top, ...bottom.slice(1).reverse()]);
  // Хвост — по направлению конца изгиба.
  const tailAngle = (Math.atan2(-2 * Math.PI * bend, KOI_BODY) * 180) / Math.PI;
  const fu = 0.22;
  const fw = KOI_HALF * 0.92;
  const fx = xAt(fu) - 0.6;
  const fy = yAt(fu);
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
      </defs>
      <g fill={koi.fin} opacity="0.92">
        <ellipse cx={fx} cy={fy - fw - 0.45} rx="1.25" ry="0.55" transform={`rotate(35 ${fx} ${fy - fw - 0.45})`} />
        <ellipse cx={fx} cy={fy + fw + 0.45} rx="1.25" ry="0.55" transform={`rotate(-35 ${fx} ${fy + fw + 0.45})`} />
        <path d={KOI_TAIL} transform={`translate(${xAt(1)} ${yAt(1).toFixed(2)}) rotate(${tailAngle.toFixed(1)})`} />
      </g>
      <path d={body} fill={koi.body} />
      <g clip-path={`url(#${clip})`}>
        {koi.marks.map(([color, u, dy, rx, ry], j) => (
          <ellipse key={j} cx={xAt(u).toFixed(2)} cy={(yAt(u) + dy).toFixed(2)} rx={rx} ry={ry} fill={color} />
        ))}
      </g>
    </g>
  );
}

/**
 * Дрейф по дуге: полкруга в свою очередь, остановка, вторые полкруга — и рыба там, где была.
 * Плывут только DRIFT_SWIMMERS рыб пруда (выбраны по сиду), по одной: следующая начинает через DRIFT_SLOT секунд.
 * У остальных анимации нет вовсе — в долине может быть несколько боссов, а движение нагружает процессор.
 */
const DRIFT_SECONDS = 7;
const DRIFT_SLOT = 10;
const DRIFT_SWIMMERS = 3;

function Fish({
  item,
  gold,
  size,
  half,
  begin,
  clip,
  run,
}: {
  item: Item;
  gold: boolean;
  /** Множитель размера от числа рыб — koiSize. */
  size: number;
  half: number;
  begin: number;
  clip: string;
  run: boolean;
}) {
  const { rng } = item;
  const koi = gold ? GOLD_KOI : pickWeighted(Object.values(KOI), (k) => k.weight, rng);
  const heading = rng() * 360;
  const bend = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.4);
  const k = (KOI_LENGTH / KOI_FULL) * size * depth(item.y, POND.cy - POND.ry, POND.cy + POND.ry) * (gold ? 1.15 : 1);
  // Круг, по которому плывёт, начинается в месте рыбы и уходит носом вперёд; по часовой или против — по сиду.
  const r = (3.5 + rng() * 3).toFixed(2);
  const cw = rng() < 0.5;
  const loop = cw ? `M0 0 A${r} ${r} 0 0 1 0 ${2 * +r} A${r} ${r} 0 0 1 0 0` : `M0 0 A${r} ${r} 0 0 0 0 ${-2 * +r} A${r} ${r} 0 0 0 0 0`;
  const cycle = 2 * half;
  const m = DRIFT_SECONDS / cycle;
  const ease = '0.45 0 0.55 1';
  return (
    <g transform={`translate(${item.x.toFixed(2)} ${item.y.toFixed(2)}) scale(1 ${KOI_SQUASH}) rotate(${heading.toFixed(1)})`}>
      <g>
        {run && (
          <animateMotion
            // path нет в типах Preact для animateMotion, хотя это обычный атрибут SVG
            {...({ path: loop } as Record<string, string>)}
            rotate="auto"
            keyPoints="0;0.5;0.5;1;1"
            keyTimes={`0;${m.toFixed(4)};0.5;${(0.5 + m).toFixed(4)};1`}
            calcMode="spline"
            keySplines={`${ease};0 0 1 1;${ease};0 0 1 1`}
            dur={`${cycle.toFixed(2)}s`}
            begin={`${begin.toFixed(2)}s`}
            repeatCount="indefinite"
          />
        )}
        <g transform={`scale(${k.toFixed(3)})`}>
          <KoiShape koi={koi} bend={bend} clip={clip} />
        </g>
      </g>
    </g>
  );
}

/** Одна кои крупно, для галереи: длина около 11, носом вправо; gold — особая золотая. */
export function KoiSample({ kind, gold = false, bend = 0.45 }: { kind?: KoiKind; gold?: boolean; bend?: number }) {
  const clip = `koi-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <KoiShape koi={gold ? GOLD_KOI : KOI[kind!]!} bend={bend} clip={clip} />;
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
  const id = `pond-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Неровный край: радиус по углу — сумма трёх волн со случайными сдвигами.
  const waves = [1, 2, 3].map((h) => ({ h, a: (0.04 + rng() * 0.04) / h ** 0.3, ph: rng() * Math.PI * 2 }));
  const rad = (th: number) => 1 + waves.reduce((s, w) => s + w.a * Math.cos(w.h * th + w.ph), 0);
  const rim = (th: number, out = 0): [number, number] => [(POND.rx * rad(th) + out) * Math.cos(th), POND.cy + (POND.ry * rad(th) + out * 0.3) * Math.sin(th)];
  const outline = smoothClosed(Array.from({ length: 24 }, (_, j) => rim((j / 24) * Math.PI * 2)));

  const inner = (x: number, y: number) => (x / (POND.rx * 0.9 - 7)) ** 2 + ((y - POND.cy) / (POND.ry * 0.9 - 3)) ** 2 < 1;
  const box: [number, number, number, number] = [-POND.rx, POND.cy - POND.ry, POND.rx, POND.cy + POND.ry];
  const slots = scatter(createRng(p.seed ^ 0x5bd1e995), BALANCE.bosses.gardenCapacity, inner, box, 14);
  const items = makeItems(p, slots).sort(byDepth);
  const fish = items.filter((it) => it.rank === undefined || it.rank % 2 === 1);
  // Плывут несколько рыб по очереди, по одной за раз.
  const swimmers = shuffled(
    fish.map((it) => it.i),
    createRng(p.seed ^ 0x27d4eb2f),
  ).slice(0, DRIFT_SWIMMERS);
  const half = Math.max(1, swimmers.length) * DRIFT_SLOT;

  // Кувшинки: две всегда, при пышности до семи; особые — с цветком, на месте своего элемента.
  const s = 1.3 * (1 + 0.12 * p.t);
  const extra = elemRng(p.seed, 999, 0x51ed270b);
  const inPads = (x: number, y: number) => (x / (POND.rx * 0.85)) ** 2 + ((y - POND.cy) / (POND.ry * 0.75)) ** 2 < 1;
  const pads = scatter(extra, 7, inPads, box, 16).slice(0, 2 + Math.round(p.t * 5));

  // Камыш группами на дальнем берегу и по бокам; при пышности гуще.
  const groups = Array.from({ length: 2 + (rng() < 0.5 ? 1 : 0) }, (_, g) => {
    const th = Math.PI * (1.08 + (0.84 * (g + 0.2 + rng() * 0.6)) / 3);
    const [bx, by] = rim(th);
    return Array.from({ length: 9 }, () => ({
      x: bx + (rng() - 0.5) * 7,
      y: by + rng() * 1.2,
      h: 9 + rng() * 9,
      bend: (rng() - 0.5) * 3,
      head: rng() < 0.55,
    })).slice(0, 4 + Math.round(p.t * 4) + (g === 0 ? 1 : 0));
  });
  // Камни по краю: 3–5, в разных местах.
  const stoneCount = 3 + Math.floor(rng() * 3);
  const stones = Array.from({ length: stoneCount }, (_, j) => {
    const th = ((j + 0.2 + rng() * 0.6) / stoneCount) * Math.PI * 2;
    const [x, y] = rim(th, 0.5);
    return { x, y, rx: 2.2 + rng() * 1.6, c: pickFrom(PEBBLES, rng) };
  }).sort(byDepth);
  const tufts = [0.12, 0.42, 0.62, 0.88].map((f, j) => {
    const [x, y] = rim(Math.PI * f, 1.5);
    return { x, y: y + 1, h: 3.5 + rng() * 2.5, r: elemRng(p.seed, 500 + j) };
  });

  return (
    <g>
      <defs>
        <clipPath id={`${id}-water`}>
          <path d={outline} />
        </clipPath>
        <radialGradient id={`${id}-deep`} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stop-color={WATER_DEEP} />
          <stop offset="0.65" stop-color={WATER_DEEP} stop-opacity="0.55" />
          <stop offset="1" stop-color={WATER_DEEP} stop-opacity="0" />
        </radialGradient>
      </defs>
      {/* камыш с рогозом */}
      <g stroke-linecap="round" fill="none">
        {groups.flat().map((r, i) => (
          <g key={i}>
            <path d={`M${r.x.toFixed(2)} ${r.y.toFixed(2)} q${r.bend * 0.4} ${-r.h * 0.6} ${r.bend} ${-r.h}`} stroke={LEAVES[i % 3]} stroke-width="0.8" />
            {r.head && <rect x={r.x + r.bend * 0.85 - 0.75} y={r.y - r.h * 0.88} width="1.5" height="3.6" rx="0.7" fill={CATTAIL} />}
          </g>
        ))}
      </g>
      {/* вода: светлая у края, глубже к середине */}
      <path d={outline} fill={PALETTE.river} />
      <path d={outline} fill={`url(#${id}-deep)`} />
      <path d="M-28 -23 h7 M13 -24.5 h9 M-14 -8 h6 M22 -9.5 h5" stroke={RIPPLE} stroke-width="0.6" stroke-linecap="round" opacity="0.8" />
      {/* рыбы под водой, обрезаны по краю пруда; сверху — тонкий слой воды */}
      <g clip-path={`url(#${id}-water)`}>
        {fish.map((it) => (
          <Fish
            key={it.i}
            item={it}
            gold={it.rank !== undefined}
            size={koiSize(p.n)}
            half={half}
            begin={swimmers.indexOf(it.i) * DRIFT_SLOT}
            clip={`${id}-koi${it.i}`}
            run={p.run && swimmers.includes(it.i)}
          />
        ))}
        <path d={outline} fill={PALETTE.river} opacity="0.12" />
      </g>
      {/* кувшинки на воде */}
      {pads.map(([x, y], i) => (
        <LilyPad key={`pad${i}`} x={x} y={y} s={s} rng={elemRng(p.seed, 700 + i)} flower={false} />
      ))}
      {items
        .filter((it) => it.rank !== undefined && it.rank % 2 === 0)
        .map((it) => (
          <g key={it.i}>
            <LilyPad x={it.x} y={it.y} s={s * 1.1} rng={it.rng} flower />
            <Sparkle x={it.x + 4.5} y={it.y - 4} rng={elemRng(p.seed, it.i, 0x7f4a7c15)} run={p.run} />
          </g>
        ))}
      {/* тонкая тёмная кромка, камни и трава по краю */}
      <path d={outline} fill="none" stroke={WATER_EDGE} stroke-width="0.7" />
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
// Переделка 25.11.2026 (docs/tasks/flowerbed-redesign.md): прежние цветы были девяти несвязанных оттенков,
// нарисованы с разных точек зрения и стояли редко на тонких стеблях над тёмной землёй — выглядело уныло.
// Теперь одна сине-красно-фиолетовая палитра; все цветы видны сбоку и чуть сверху и построены одинаково:
// заливка, тень того же цвета, маленькая светлая середина, без обводок. Элемент — куст: горка листвы и 2–3
// цветка одного вида и цвета. Вид и цвет куста — от его места: клумбы по диагонали засажены одной цветовой
// схемой, у изгороди — белый бордюр, ближе к середине — крупные цветы. Земля, песок, бортик и лейка — светлее.

/**
 * Овальный цветник, видный сверху наискосок: бортик, по кругу и крест-накрест — посыпанные дорожки,
 * посередине круглая площадка с фонтанчиком или солнечными часами. Четыре клумбы обведены низкой
 * стриженой изгородью; кусты растут на клумбах.
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
/** Вскопанная земля — тёплая и светлая, чтобы пустой цветник не был тёмным пятном. */
const SOIL = '#ab7d5a';
const SOIL_FURROW = '#946649';
const GRAVEL = '#f0e4c8';
const GRAVEL_DOT = '#d9c8a0';
const HEDGE = '#4f8344';
const HEDGE_LIGHT = '#6ea25b';

const BED_EDGES = [
  { top: '#c9a275', face: '#9c7652', dash: '9 0.7' }, // доски
  { top: '#e4dccf', face: '#bfb4a3', dash: '4 0.8' }, // камень
  { top: '#dfa384', face: '#b9765b', dash: '2.6 0.5' }, // кирпич
] as const;
/** Камень фонтанчика, солнечных часов и вазонов — светлый и тёплый. */
const FOUNTAIN_STONE = { body: '#d9cfbe', light: '#ece4d7', dark: '#b4a791' };
/** Лейка — крашеная: приглушённый зелёный или терракота. */
const CANS = [
  { body: '#88ae90', dark: '#65896e' },
  { body: '#cd8b69', dark: '#a8684c' },
];

const n2 = (v: number) => v.toFixed(2);

// --- Палитра цветника ---

/** Тот же цвет, смешанный с белым на долю amount: светлый блик того же оттенка. */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** Цвет цветка: заливка, тень того же оттенка (второй слой лепестков), блик сверху, «ярче» — для пышности. */
interface Bloom {
  name: string;
  base: string;
  shade: string;
  light: string;
  bright: string;
}
const bloom = (name: string, base: string, bright: string, shade = 0.2): Bloom => ({ name, base, shade: darker(base, shade), light: tint(base, 0.4), bright });

/**
 * Сине-красно-фиолетовая гамма (выбор пользователя): один красный — малиновый, белый — для бордюра.
 * Малиновый, фиолетовый и васильковый подняты на тон-два (просьба пользователя 26.11.2026).
 */
export const BLOOMS = {
  crimson: bloom('малиновый', '#e25d79', '#ef5378'),
  orchid: bloom('розово-сиреневый', '#e08cbf', '#ec7fc6'),
  lilac: bloom('сиреневый', PALETTE.petalLilac, '#d29cf0'),
  violet: bloom('фиолетовый', '#a580dc', '#a874ec'),
  cornflower: bloom('васильковый', '#8aa6ee', '#7c9cfa'),
  sky: bloom('светло-голубой', '#b3c6f4', '#a9c0ff'),
  white: bloom('белый', '#fbf7ef', '#ffffff', 0.09),
};
export type BloomColor = keyof typeof BLOOMS;
/** Жёлтый — только серединки: оживляет холодную гамму. */
const EYE = '#f1d36a';

export type BedFlowerKind = 'tulip' | 'aster' | 'daisy' | 'bell' | 'spike';
export type Planting = readonly [BedFlowerKind, BloomColor];
type Band = 'inner' | 'mid' | 'border';

interface Scheme {
  name: string;
  /** Ближе к середине — крупные и высокие. */
  inner: readonly Planting[];
  mid: readonly Planting[];
  /** У изгороди — низкий белый бордюр. */
  border: readonly Planting[];
}

/** Цветовые схемы клумб: клумбы по диагонали — одной схемы. В полосе виды чередуются пятнами по углу. */
export const FLOWERBED_SCHEMES = {
  blue: {
    name: 'Сине-сиреневая',
    inner: [
      ['spike', 'cornflower'],
      ['tulip', 'lilac'],
    ],
    mid: [
      ['aster', 'sky'],
      ['bell', 'cornflower'],
      ['aster', 'lilac'],
    ],
    border: [['daisy', 'white']],
  },
  red: {
    name: 'Красно-фиолетовая',
    inner: [
      ['tulip', 'crimson'],
      ['spike', 'violet'],
    ],
    mid: [
      ['aster', 'orchid'],
      ['tulip', 'violet'],
      ['aster', 'crimson'],
    ],
    border: [['daisy', 'white']],
  },
} satisfies Record<string, Scheme>;
export type SchemeKey = keyof typeof FLOWERBED_SCHEMES;

/** Редкие (каждый 5-й подход): роза, ирис, лилия — насыщеннее и с золотом. */
const RARE = [
  { name: 'роза', shade: '#8f1d40', base: '#c83256', light: tint('#c83256', 0.4), bright: '#d82c5c', eye: PALETTE.goldBright },
  { name: 'ирис', shade: '#6a49b0', base: '#7886e0', light: tint('#7886e0', 0.4), bright: '#6e80f4', eye: PALETTE.goldBright },
  { name: 'лилия', shade: '#e4d9c9', base: '#fbf7ef', light: '#ffffff', bright: '#ffffff', eye: '#c0508a', gold: PALETTE.goldBright },
];

// --- Головки цветов: пути, чтобы головки одного куста складывались в одну фигуру ---

type Pen = (px: number, py: number) => string;
/** Точка головки (px, py) в координатах куста: головка стоит в (x, y), масштаб k. */
const pen =
  (x: number, y: number, k: number): Pen =>
  (px, py) =>
    `${n2(x + px * k)} ${n2(y + py * k)}`;

function ellD(P: Pen, k: number, cx: number, cy: number, rx: number, ry: number): string {
  const a = `${n2(rx * k)} ${n2(ry * k)} 0 1 0`;
  return `M${P(cx - rx, cy)} A${a} ${P(cx + rx, cy)} A${a} ${P(cx - rx, cy)} Z`;
}

/** Розетка лепестков, сплющенная как овал клумбы: n лепестков, inner — глубина выреза между ними. */
function rosetteD(P: Pen, cy: number, rx: number, ry: number, n: number, inner: number, phase: number, pointy = false): string {
  const at = (a: number, r: number) => P(r * rx * Math.cos(a), cy + r * ry * Math.sin(a));
  const step = (2 * Math.PI) / n;
  const tip = pointy ? 1 : 2 - inner * Math.cos(step / 2);
  let d = `M${at(phase, inner)}`;
  for (let j = 0; j < n; j++) {
    const a = phase + j * step;
    d += pointy ? ` L${at(a + step / 2, tip)} L${at(a + step, inner)}` : ` Q${at(a + step / 2, tip)} ${at(a + step, inner)}`;
  }
  return `${d} Z`;
}

/** Колосок (лаванда, шалфей): начало — внизу, высота 5. */
function spikeD(P: Pen): string {
  return (
    `M${P(0, -5)} C${P(0.5, -4.8)} ${P(0.6, -4.2)} ${P(0.4, -3.9)} C${P(0.8, -3.6)} ${P(0.8, -2.9)} ${P(0.5, -2.6)} ` +
    `C${P(0.9, -2.3)} ${P(0.9, -1.5)} ${P(0.5, -1.2)} C${P(0.9, -0.9)} ${P(0.8, -0.1)} ${P(0, 0)} ` +
    `C${P(-0.8, -0.1)} ${P(-0.9, -0.9)} ${P(-0.5, -1.2)} C${P(-0.9, -1.5)} ${P(-0.9, -2.3)} ${P(-0.5, -2.6)} ` +
    `C${P(-0.8, -2.9)} ${P(-0.8, -3.6)} ${P(-0.4, -3.9)} C${P(-0.6, -4.2)} ${P(-0.5, -4.8)} ${P(0, -5)} Z`
  );
}

/** Слои головки: тень (снизу), заливка, середина; у лилии — ещё золотые тычинки. */
interface HeadPaths {
  shade: string;
  base: string;
  /** Светлый блик сверху: отделяет головку от зелени. */
  light: string;
  eye: string;
  gold?: string;
}

function headD(kind: BedFlowerKind, x: number, y: number, k: number): HeadPaths {
  const P = pen(x, y, k);
  switch (kind) {
    case 'tulip':
      // Чашка; сверху видно её отверстие и серединку между лепестками.
      return {
        shade: ellD(P, k, 0, -1.3, 1.25, 0.55),
        base: `M${P(-1.35, -1.55)} Q${P(-0.6, -1.45)} ${P(0, -1)} Q${P(0.6, -1.45)} ${P(1.35, -1.55)} C${P(1.45, 0.2)} ${P(0.8, 1.3)} ${P(0, 1.3)} C${P(-0.8, 1.3)} ${P(-1.45, 0.2)} ${P(-1.35, -1.55)} Z`,
        light: ellD(P, k, -0.6, -0.75, 0.32, 0.6),
        eye: ellD(P, k, 0, -1.25, 0.35, 0.2),
      };
    case 'aster':
      return {
        shade: rosetteD(P, 0.35, 2, 1.05, 12, 0.55, 0),
        base: rosetteD(P, 0, 1.85, 0.95, 12, 0.55, Math.PI / 12),
        light: ellD(P, k, 0, -0.5, 1.15, 0.3),
        eye: ellD(P, k, 0, -0.05, 0.6, 0.35),
      };
    case 'daisy':
      return {
        shade: rosetteD(P, 0.3, 1.7, 0.9, 10, 0.5, 0),
        base: rosetteD(P, 0, 1.6, 0.82, 10, 0.5, Math.PI / 10),
        light: ellD(P, k, 0, -0.45, 1, 0.26),
        eye: ellD(P, k, 0, -0.05, 0.62, 0.38),
      };
    case 'bell':
      // Колокольчик висит: снизу видно его тёмное устье и пестик.
      return {
        shade: ellD(P, k, 0, 0.95, 1.05, 0.4),
        base: `M${P(-1.05, 0.95)} C${P(-1.15, -0.4)} ${P(-0.6, -1.2)} ${P(0, -1.2)} C${P(0.6, -1.2)} ${P(1.15, -0.4)} ${P(1.05, 0.95)} Q${P(0, 0.3)} ${P(-1.05, 0.95)} Z`,
        light: ellD(P, k, -0.35, -0.55, 0.35, 0.4),
        eye: ellD(P, k, 0, 1.05, 0.22, 0.16),
      };
    case 'spike':
      return { shade: spikeD(pen(x + 0.35 * k, y + 0.15 * k, k)), base: spikeD(P), light: ellD(P, k, -0.15, -3.6, 0.22, 1), eye: '' };
  }
}

/** Редкая головка: 0 — роза, 1 — ирис, 2 — лилия. */
function rareD(rank: number, x: number, y: number, k: number): HeadPaths {
  const P = pen(x, y, k);
  switch (rank % 3) {
    case 0:
      // Роза — чашка: дальние лепестки, два передних с вырезом, золотая середина.
      return {
        shade: ellD(P, k, 0, -1.5, 2.1, 1.1),
        base: `M${P(-2.1, -1.5)} C${P(-2, 0)} ${P(-1, 0.9)} ${P(0, 0.9)} C${P(1, 0.9)} ${P(2, 0)} ${P(2.1, -1.5)} C${P(1.4, -0.9)} ${P(0.7, -1.3)} ${P(0, -0.8)} C${P(-0.7, -1.3)} ${P(-1.4, -0.9)} ${P(-2.1, -1.5)} Z`,
        light: ellD(P, k, -0.9, -0.35, 0.65, 0.25) + ellD(P, k, 0.9, -0.35, 0.65, 0.25),
        eye: ellD(P, k, 0, -1.55, 0.55, 0.3),
      };
    case 1:
      // Ирис — тёмно-фиолетовые нижние лепестки, синие верхние, золотая бородка.
      return {
        shade: `M${P(0, 0)} C${P(-1.6, -0.2)} ${P(-2.7, 0.9)} ${P(-2.5, 2.2)} C${P(-1.4, 2.3)} ${P(-0.5, 1.4)} ${P(0, 0.4)} C${P(0.5, 1.4)} ${P(1.4, 2.3)} ${P(2.5, 2.2)} C${P(2.7, 0.9)} ${P(1.6, -0.2)} ${P(0, 0)} Z`,
        base: `M${P(0, 0.6)} C${P(-1.3, -0.2)} ${P(-1.2, -2.5)} ${P(0, -3.1)} C${P(1.2, -2.5)} ${P(1.3, -0.2)} ${P(0, 0.6)} Z`,
        light: ellD(P, k, -0.35, -1.9, 0.3, 0.75),
        eye: ellD(P, k, -0.95, 1, 0.45, 0.2) + ellD(P, k, 0.95, 1, 0.45, 0.2),
      };
    default: {
      // Лилия — белая звезда из шести лепестков, малиново-фиолетовая середина, золотые тычинки.
      const phase = -Math.PI / 2 - Math.PI / 6;
      return {
        shade: rosetteD(P, 0.3, 2.5, 1.3, 6, 0.25, phase + 0.3, true),
        base: rosetteD(P, 0, 2.3, 1.15, 6, 0.25, phase, true),
        light: ellD(P, k, 0, -0.55, 0.7, 0.2),
        eye: ellD(P, k, 0, 0, 0.7, 0.42),
        gold: ellD(P, k, -0.55, -0.55, 0.22, 0.15) + ellD(P, k, 0.55, -0.6, 0.22, 0.15) + ellD(P, k, 0, -0.9, 0.22, 0.15),
      };
    }
  }
}

function HeadLayers({ d, shade, base, light, eye, gold }: { d: HeadPaths; shade: string; base: string; light: string; eye: string; gold?: string }) {
  return (
    <g>
      <path d={d.shade} fill={shade} />
      <path d={d.base} fill={base} />
      {d.light && <path d={d.light} fill={light} />}
      {d.eye && <path d={d.eye} fill={eye} />}
      {d.gold && <path d={d.gold} fill={gold} />}
    </g>
  );
}

// --- Куст-букет ---
// Правка 26.11.2026 по просьбе пользователя: куст читается как букет — цвета примерно вдвое больше, чем
// зелени. Головки вдвое крупнее прежних и стоят над листвой; листва — только низкая оборка у земли.

/** Где головки на кусте (над оборкой листвы) и насколько тот или иной вид поднят выше. */
const BUSH_HEADS: [number, number][] = [
  [-2.4, -2.4],
  [2.4, -2.7],
  [0, -3.9],
];
const HEAD_LIFT: Record<BedFlowerKind, number> = { tulip: 1.4, bell: 1.2, aster: 0, daisy: 0, spike: 0 };
const HEAD_SCALE: Record<BedFlowerKind, number> = { tulip: 1.7, bell: 1.6, aster: 1.6, daisy: 1.5, spike: 1 };
/** Колоски: x, y начала (за оборкой) и масштаб. */
const BUSH_SPIKES: [number, number, number][] = [
  [-2, -0.8, 1.35],
  [0.2, -1, 1.6],
  [2.1, -0.7, 1.3],
];
/** Масштаб куста по полосе клумбы: бордюр низкий, середина выше. */
const BAND_SCALE: Record<Band, number> = { border: 0.72, mid: 0.95, inner: 1.05 };
/** Общий масштаб кустов в рамке места. */
const BUSH_SCALE = 1.3;
/** До стольких кустов размер полный; дальше кусты постепенно мельчают (как рыбы в пруду). */
const BUSH_CROWD = 6;
const bushSize = (n: number) => (n <= BUSH_CROWD ? 1 : (BUSH_CROWD / n) ** 0.35);

/**
 * Куст-букет в своих координатах: начало — на земле под серединой, ширина около 11. Низкая оборка листвы
 * из двух овалов и над ней 2–3 крупных цветка одного вида и цвета (или 2 редких). Фигур — 6–7:
 * головки куста сложены в общие пути.
 */
function Bush({ plant, rank, bright, rng }: { plant: Planting; rank?: number; bright: boolean; rng: Rng }) {
  const [kind, color] = plant;
  const jit = () => (rng() - 0.5) * 0.8;
  const leaf = pickFrom([PALETTE.leaf, PALETTE.leafDark], rng);
  const lightX = jit() * 1.5;
  const frill = (
    <g>
      <ellipse cy="-0.6" rx="4.2" ry="1.1" fill={leaf} />
      <ellipse cx={n2(lightX)} cy="-1" rx="2.6" ry="0.55" fill={PALETTE.leafLight} />
    </g>
  );
  const joined = (heads: HeadPaths[]): HeadPaths => ({
    shade: heads.map((h) => h.shade).join(' '),
    base: heads.map((h) => h.base).join(' '),
    light: heads.map((h) => h.light).join(' '),
    eye: heads.map((h) => h.eye).join(' '),
    gold: heads.map((h) => h.gold ?? '').join(' ').trim(),
  });
  if (rank !== undefined) {
    const r = RARE[rank % 3]!;
    const heads = [rareD(rank, -1.7 + jit(), -3.4, 1.3), rareD(rank, 2.1 + jit(), -2.6, 1.1)];
    return (
      <g>
        {frill}
        <HeadLayers d={joined(heads)} shade={r.shade} base={bright ? r.bright : r.base} light={r.light} eye={r.eye} gold={r.gold} />
      </g>
    );
  }
  const c = BLOOMS[color];
  const fill = bright ? c.bright : c.base;
  if (kind === 'spike') {
    const spikes = BUSH_SPIKES.map(([x, y, k]) => headD('spike', x + jit() * 0.5, y, k * (0.92 + rng() * 0.16)));
    return (
      <g>
        <HeadLayers d={joined(spikes)} shade={c.shade} base={fill} light={c.light} eye={EYE} />
        {frill}
      </g>
    );
  }
  const count = rng() < 0.3 ? 2 : 3;
  const lift = HEAD_LIFT[kind];
  const k = HEAD_SCALE[kind];
  const spots = BUSH_HEADS.slice(0, count).map(([x, y]) => [x + jit(), y - lift + jit() * 0.5] as const);
  const heads = spots.map(([x, y]) => headD(kind, x, y, k));
  // Короткие стебли — у тюльпанов и колокольчиков, остальные лежат на оборке.
  const stems =
    kind === 'tulip'
      ? spots.map(([x, y]) => `M${n2(x * 0.7)} -1 L${n2(x)} ${n2(y + 1.2 * k)}`).join(' ')
      : kind === 'bell'
        ? spots.map(([x, y]) => `M${n2(x - 0.9)} -1.2 Q${n2(x - 0.6)} ${n2(y - 1.6 * k)} ${n2(x)} ${n2(y - 1.1 * k)}`).join(' ')
        : '';
  return (
    <g>
      {stems && <path d={stems} stroke={PALETTE.hillNear} stroke-width="0.55" fill="none" stroke-linecap="round" />}
      {frill}
      <HeadLayers d={joined(heads)} shade={c.shade} base={fill} light={c.light} eye={EYE} />
    </g>
  );
}

/** Цветовые схемы клумб по диагоналям: [дальняя левая и ближняя правая, дальняя правая и ближняя левая]. */
function schemesOf(blueFirst: boolean): [Scheme, Scheme] {
  const { blue, red } = FLOWERBED_SCHEMES;
  return blueFirst ? [blue, red] : [red, blue];
}

/**
 * Что растёт на месте (x, y): схема — по клумбе, полоса — по расстоянию от середины до изгороди,
 * вид — по углу внутри клумбы (пятнами). Только от места: новый куст не меняет прежние.
 */
function plantingAt(x: number, y: number, schemes: [Scheme, Scheme]): { plant: Planting; band: Band } {
  const dy = y - BED.cy;
  const scheme = schemes[Math.sign(x) === Math.sign(dy) ? 0 : 1];
  const d = Math.hypot(x / (BED.qx - 3), dy / (BED.qy - 1.6));
  const band: Band = d > 0.86 ? 'border' : d > 0.55 ? 'mid' : 'inner';
  const angle = Math.atan2(Math.abs(dy) / BED.qy, Math.abs(x) / BED.qx);
  const sector = Math.min(2, Math.floor(angle / (Math.PI / 6)));
  const list = scheme[band];
  return { plant: list[sector % list.length]!, band };
}

function BedBush({ item, s, schemes, seed, run }: { item: Item; s: number; schemes: [Scheme, Scheme]; seed: number; run: boolean }) {
  const { plant, band } = plantingAt(item.x, item.y, schemes);
  const rare = item.rank !== undefined;
  const k = s * depth(item.y, BED.cy - BED.qy, BED.cy + BED.qy) * (rare ? Math.max(BAND_SCALE[band], 0.95) * 1.1 : BAND_SCALE[band]);
  return (
    <g transform={`translate(${n2(item.x)} ${n2(item.y)}) scale(${k.toFixed(3)})`}>
      <Bush plant={plant} rank={item.rank} bright={item.bright} rng={item.rng} />
      {rare && <Sparkle x={3.6} y={-7.6} r={1.5} rng={elemRng(seed, item.i, 0x7f4a7c15)} run={run} />}
    </g>
  );
}

// --- Середина и окружение ---

/** Фонтанчик: чаша, столбик, верхняя чашка, вода бьёт вверх и стекает; на воде — два блика. */
function Fountain({ run }: { run: boolean }) {
  const st = FOUNTAIN_STONE;
  const jets = ['M0 -8.4 Q-1.6 -11.6 -2.5 -7', 'M0 -8.4 Q1.6 -11.6 2.5 -7', 'M-2.7 -6.6 Q-3.6 -4.4 -4.4 -1.4', 'M2.7 -6.6 Q3.6 -4.4 4.4 -1.4'];
  return (
    <g>
      <ellipse cy="0.9" rx="6.8" ry="2.4" fill={st.dark} />
      <ellipse cy="-0.4" rx="6.8" ry="2.4" fill={st.body} />
      <ellipse cy="-0.6" rx="5.6" ry="1.7" fill={PALETTE.river} />
      <ellipse cx="-2.6" cy="-1" rx="1.4" ry="0.35" fill={RIPPLE} />
      <rect x="-0.9" y="-6.6" width="1.8" height="6" fill={st.light} />
      <ellipse cy="-6.2" rx="3" ry="0.9" fill={st.dark} />
      <ellipse cy="-6.7" rx="3" ry="0.9" fill={st.body} />
      <ellipse cy="-6.8" rx="2.3" ry="0.55" fill={PALETTE.river} />
      <ellipse cx="1.1" cy="-6.9" rx="0.7" ry="0.18" fill={RIPPLE} />
      <path d="M0 -6.8 V-8.6" stroke={PALETTE.river} stroke-width="0.7" stroke-linecap="round" />
      <g stroke={PALETTE.river} stroke-width="0.55" fill="none" stroke-linecap="round" stroke-dasharray={run ? '1.4 0.9' : undefined}>
        {jets.map((d) => (
          <path key={d} d={d}>
            {run && <animate attributeName="stroke-dashoffset" from="2.3" to="0" dur="0.6s" repeatCount="indefinite" />}
          </path>
        ))}
      </g>
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

/** Каменный вазон с цветами — на бортике у конца поперечной дорожки, при пышности. */
function Vase({ x, y, c }: { x: number; y: number; c: Bloom }) {
  const st = FOUNTAIN_STONE;
  const heads = (
    [
      [-1.3, -4.3],
      [1.2, -4.5],
      [0, -5.2],
    ] as const
  ).map(([hx, hy]) => headD('aster', hx, hy, 0.5));
  return (
    <g transform={`translate(${n2(x)} ${n2(y)}) scale(1.6)`}>
      <path d="M-1.3 0 H1.3 L0.8 -1.2 H-0.8 Z" fill={st.dark} />
      <path d="M-2.3 -3.4 C-2.1 -1.8 -1.1 -1.1 0 -1.1 C1.1 -1.1 2.1 -1.8 2.3 -3.4 Z" fill={st.body} />
      <ellipse cy="-3.4" rx="2.3" ry="0.55" fill={st.light} />
      <ellipse cy="-4.4" rx="2.4" ry="1" fill={PALETTE.leaf} />
      <HeadLayers
        d={{ shade: heads.map((h) => h.shade).join(' '), base: heads.map((h) => h.base).join(' '), light: heads.map((h) => h.light).join(' '), eye: heads.map((h) => h.eye).join(' ') }}
        shade={c.shade}
        base={c.base}
        light={c.light}
        eye={EYE}
      />
    </g>
  );
}

/** Крашеная лейка у цветника. */
function WateringCan({ x, flip, c }: { x: number; flip: number; c: { body: string; dark: string } }) {
  return (
    <g transform={`translate(${x} 0) scale(${flip} 1)`}>
      <ellipse cy="0.3" rx="4.5" ry="0.6" fill={PALETTE.shadowGreen} opacity="0.22" />
      <path d="M-2 -5.6 Q0 -9.2 2 -5.6" stroke={c.dark} stroke-width="0.8" fill="none" />
      <path d="M2.6 -2.2 L6.4 -6.6" stroke={c.body} stroke-width="1" stroke-linecap="round" />
      <ellipse cx="6.7" cy="-6.9" rx="0.9" ry="0.6" transform="rotate(-40 6.7 -6.9)" fill={c.dark} />
      <path d="M-3 0 V-5 Q0 -6 3 -5 V0 Z" fill={c.body} />
      <path d="M1.2 -5.3 V0" stroke="#000" stroke-opacity="0.1" stroke-width="1.8" />
    </g>
  );
}

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

/** Первые выборы по сиду цветника: бортик (номер в BED_EDGES), сторона лейки, середина, схемы, цвет лейки. */
function bedLook(rng: Rng) {
  const edge = Math.floor(rng() * BED_EDGES.length);
  const side = pickFrom([1, -1], rng);
  const fountain = rng() < 0.65;
  const blueFirst = rng() < 0.5;
  const can = Math.floor(rng() * CANS.length);
  return { edge, side, fountain, blueFirst, can };
}

/**
 * Для галереи: бортик (0 — доски, 1 — камень, 2 — кирпич), что посередине и какая схема у дальней левой
 * и ближней правой клумб (у двух других — другая).
 */
export function flowerbedLook(seed: number): { edge: number; fountain: boolean; diagonal: SchemeKey } {
  const { edge, fountain, blueFirst } = bedLook(createRng(seed));
  return { edge, fountain, diagonal: blueFirst ? 'blue' : 'red' };
}

/** Для галереи: одна головка крупно, середина — около (0, 0). Обычная — kind и color, редкая — rare (0 — роза, 1 — ирис, 2 — лилия). */
export function FlowerSample({ kind, color, rare }: { kind?: BedFlowerKind; color?: BloomColor; rare?: number }) {
  if (rare !== undefined) {
    const r = RARE[rare % 3]!;
    const dy = [0.8, 0.4, 0][rare % 3]!;
    return <HeadLayers d={rareD(rare, 0, dy, 1)} shade={r.shade} base={r.base} light={r.light} eye={r.eye} gold={r.gold} />;
  }
  const c = BLOOMS[color!];
  return <HeadLayers d={headD(kind!, 0, kind === 'spike' ? 2.5 : 0, 1)} shade={c.shade} base={c.base} light={c.light} eye={EYE} />;
}

/** Для галереи: один куст крупно; rare — редкий куст (0 — роза, 1 — ирис, 2 — лилия). */
export function BushSample({ plant, rare, seed = 1 }: { plant: Planting; rare?: number; seed?: number }) {
  return <Bush plant={plant} rank={rare} bright={false} rng={elemRng(seed, rare ?? 0)} />;
}

function Flowerbed(p: PlaceProps) {
  const rng = createRng(p.seed);
  const look = bedLook(rng);
  const edge = BED_EDGES[look.edge]!;
  const schemes = schemesOf(look.blueFirst);
  const box: [number, number, number, number] = [-BED.qx, BED.cy - BED.qy, BED.qx, BED.cy + BED.qy];
  // Места — по сиду заранее, кусты появляются вразброс по всем клумбам. Посадку по одной клумбе
  // пользователь попробовала и отменила (26.11.2026).
  const slots = scatter(createRng(p.seed ^ 0x5bd1e995), BALANCE.bosses.gardenCapacity, onBed, box, 9);
  const items = makeItems(p, slots).sort(byDepth);
  // Пока кустов мало, они крупнее.
  const s = BUSH_SCALE * bushSize(p.n) * (1 + 0.15 * p.t);
  const extra = elemRng(p.seed, 999, 0x51ed270b);
  // Пышность: низкая зелень с цветочками между кустами.
  const dots = [BLOOMS.white.base, BLOOMS.sky.base, BLOOMS.lilac.base, BLOOMS.orchid.base];
  const filler = scatter(extra, 24, onBed, box, 5)
    .slice(0, Math.round(p.t * 24))
    .map(([x, y]) => ({ x, y, c: pickFrom(LEAVES, extra), dot: pickFrom(dots, extra) }));
  // Камешки на дорожках и бороздки на вскопанной земле.
  const gravel = Array.from({ length: 40 }, () => [(rng() - 0.5) * 2 * BED.rx, BED.cy + (rng() - 0.5) * 2 * BED.ry] as const).filter(
    ([x, y]) => (x / (BED.rx - 3)) ** 2 + ((y - BED.cy) / (BED.ry - 2)) ** 2 < 1,
  );
  const furrows = Array.from({ length: 70 }, () => [(rng() - 0.5) * 2 * BED.qx, BED.cy + (rng() - 0.5) * 2 * BED.qy] as const)
    .filter(([x, y]) => onBed(x, y))
    .slice(0, 28);
  const { cy } = BED;
  const back = items.filter((it) => it.y < cy);
  const front = items.filter((it) => it.y >= cy);
  const quarters = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sy]) => quarterPath(sx!, sy!));
  const bushes = (list: Item[]) => list.map((it) => <BedBush key={it.i} item={it} s={s} schemes={schemes} seed={p.seed} run={p.run} />);
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
      <path d={furrows.map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)} h1.8`).join(' ')} stroke={SOIL_FURROW} stroke-width="0.45" stroke-linecap="round" />
      {filler.map((f, i) => (
        <g key={`f${i}`}>
          <ellipse cx={f.x} cy={f.y - 0.6} rx="1.6" ry="0.9" fill={f.c} />
          <circle cx={f.x + 0.5} cy={f.y - 1} r="0.45" fill={f.dot} />
        </g>
      ))}
      {bushes(back)}
      <g transform={`translate(0 ${cy})`}>{look.fountain ? <Fountain run={p.run} /> : <Sundial />}</g>
      {p.t > 0 &&
        ([-1, 1] as const).map((sx) => <Vase key={sx} x={sx * (BED.rx - 1.6)} y={cy + 0.4} c={BLOOMS[schemes[sx < 0 ? 0 : 1].mid[0]![1]]} />)}
      {bushes(front)}
      <WateringCan x={look.side * 60} flip={-look.side} c={CANS[look.can]!} />
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
