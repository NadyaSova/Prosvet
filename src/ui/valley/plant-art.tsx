// Растения долины по виду и размеру. Плоский стиль эскиза docs/reference-valley.svg.
// Сид растения даёт разброс: высота, оттенок, форма кроны — каждое дерево чуть своё, но одинаковое между запусками.
// Начало координат — у корня, растение растёт вверх (отрицательный y).

import { createRng, pickFrom, type Rng } from '../../logic/rng';
import type { PlantKind, PlantSize } from '../../model/types';

const TRUNK = '#6b4a35';

/** Высота дерева по размеру (в единицах долины, на переднем плане). */
const TREE_HEIGHT: Record<PlantSize, number> = { small: 16, medium: 29, large: 42 };

/** Деревья качаются; цветы и кусты — нет. */
export function sways(kind: PlantKind, size: PlantSize): boolean {
  return size !== 'small' && !['flowers', 'bush', 'lilac', 'sunflower'].includes(kind);
}

function vary(rng: Rng, base: number, spread = 0.12): number {
  return base * (1 - spread + rng() * spread * 2);
}

function Pine({ h, rng }: { h: number; rng: Rng }) {
  const color = pickFrom(['#3f6b4a', '#45734f', '#3a6345', '#4e7a57'], rng);
  const tiers = h > 30 ? 3 : 2;
  const trunk = h * 0.16;
  const crown = h - trunk * 0.6;
  return (
    <>
      <rect x={-h * 0.045} y={-trunk * 2} width={h * 0.09} height={trunk * 2} fill={TRUNK} />
      {Array.from({ length: tiers }, (_, i) => {
        const apex = -h + (i * crown * 0.3);
        const base = apex + crown * (tiers === 3 ? 0.42 : 0.55);
        const half = h * (0.2 + i * 0.07) * vary(rng, 1, 0.08);
        return <polygon key={i} points={`0,${apex} ${-half},${base} ${half},${base}`} fill={color} />;
      })}
    </>
  );
}

function RoundCrown({ h, rng, colors, trunkW }: { h: number; rng: Rng; colors: string[]; trunkW: number }) {
  const r = h * vary(rng, 0.3, 0.1);
  const cy = -h + r;
  const lean = (rng() - 0.5) * r * 0.3;
  return (
    <>
      <rect x={-trunkW / 2} y={-h * 0.45} width={trunkW} height={h * 0.45} fill={TRUNK} />
      <circle cx={lean} cy={cy} r={r} fill={colors[0]} />
      <circle cx={lean - r * 0.68} cy={cy + r * 0.45} r={r * vary(rng, 0.66)} fill={colors[1]} />
      <circle cx={lean + r * 0.68} cy={cy + r * 0.38} r={r * vary(rng, 0.6)} fill={colors[2]} />
    </>
  );
}

const OAK_COLORS = [
  ['#6e9b5a', '#5e8a4e', '#7faa66'],
  ['#7fae6e', '#6c9c5e', '#89b877'],
  ['#739f5c', '#628f52', '#86b26c'],
];

function Birch({ h, rng }: { h: number; rng: Rng }) {
  const colors = pickFrom(
    [
      ['#a6c77a', '#93b86a'],
      ['#b5d18a', '#9fc174'],
      ['#c2d78a', '#a9c777'],
    ],
    rng,
  );
  const trunkH = h * 0.62;
  const w = Math.max(1.6, h * 0.07);
  return (
    <>
      <ellipse cx={0} cy={-h * 0.68} rx={h * vary(rng, 0.2)} ry={h * 0.32} fill={colors[0]} />
      <ellipse cx={h * 0.1} cy={-h * 0.55} rx={h * 0.13} ry={h * 0.2} fill={colors[1]} />
      <rect x={-w / 2} y={-trunkH} width={w} height={trunkH} fill="#efe9dc" />
      <path
        d={`M${-w / 2} ${-trunkH * 0.25} h${w * 0.6} M${w / 2} ${-trunkH * 0.5} h${-w * 0.6} M${-w / 2} ${-trunkH * 0.75} h${w * 0.5}`}
        stroke="#4b463f"
        stroke-width={Math.max(0.6, h * 0.025)}
      />
    </>
  );
}

function Willow({ h, rng }: { h: number; rng: Rng }) {
  const [crown, strand] = pickFrom(
    [
      ['#a9c785', '#8fb56f'],
      ['#9cbf7a', '#86ac66'],
      ['#b2cc8a', '#97ba74'],
    ],
    rng,
  );
  const rx = h * vary(rng, 0.3, 0.08);
  const top = -h;
  const base = -h * 0.66;
  const n = h > 20 ? 11 : 7;
  const w = Math.max(0.9, h * 0.05);
  // Тонкие ветви свисают из-под купола и расходятся в стороны почти до земли.
  const strands = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1) - 0.5;
    const sx = t * 2 * rx * 0.95;
    const ex = sx * vary(rng, 1.45, 0.1);
    const ey = -h * vary(rng, 0.14, 0.5);
    return `M${sx.toFixed(2)} ${base.toFixed(2)} Q${(sx * 1.35).toFixed(2)} ${((base + ey) / 2).toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  });
  return (
    <>
      <path d={`M0 0 L0 ${-h * 0.62} M0 ${-h * 0.4} L${-h * 0.1} ${-h * 0.6}`} stroke={TRUNK} stroke-width={Math.max(1.4, h * 0.075)} stroke-linecap="round" />
      <path d={strands.join(' ')} stroke={strand} stroke-width={w} stroke-linecap="round" fill="none" />
      <path
        d={`M${-rx * 1.05} ${base} C${-rx * 1.05} ${top + h * 0.04} ${rx * 1.05} ${top + h * 0.04} ${rx * 1.05} ${base} Q0 ${base + h * 0.06} ${-rx * 1.05} ${base} Z`}
        fill={crown}
      />
    </>
  );
}

const PETALS = ['#f2a7b5', '#fff3b0', '#c9a0dc', '#f6c177', '#ffffff'];

function Flowers({ size, rng }: { size: PlantSize; rng: Rng }) {
  const n = { small: 3, medium: 5, large: 7 }[size];
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const x = (i - (n - 1) / 2) * 2.4 + (rng() - 0.5) * 1.5;
        const stem = vary(rng, 5, 0.3);
        return (
          <g key={i}>
            <line x1={x} y1={0} x2={x + (rng() - 0.5) * 1.5} y2={-stem} stroke="#5a8758" stroke-width="0.7" />
            <circle cx={x} cy={-stem} r={vary(rng, 1.5, 0.2)} fill={pickFrom(PETALS, rng)} />
          </g>
        );
      })}
    </>
  );
}

function Bush({ size, rng, blossoms }: { size: PlantSize; rng: Rng; blossoms: string[] | null }) {
  const r = { small: 4, medium: 5.5, large: 7.5 }[size] * vary(rng, 1, 0.1);
  const colors = pickFrom(
    [
      ['#79a863', '#6c9c5e', '#86b46e'],
      ['#6f9e5d', '#5f8d52', '#7eac67'],
    ],
    rng,
  );
  const dots = blossoms ? (size === 'large' ? 9 : 6) : size === 'large' ? 6 : 0;
  const dotColors = blossoms ?? ['#f2a7b5', '#ffffff', '#fff3b0'];
  return (
    <>
      <circle cx={-r * 0.75} cy={-r * 0.55} r={r * 0.7} fill={colors[1]} />
      <circle cx={r * 0.75} cy={-r * 0.55} r={r * 0.65} fill={colors[2]} />
      <circle cx={0} cy={-r * 0.85} r={r * 0.85} fill={colors[0]} />
      {Array.from({ length: dots }, (_, i) => (
        <circle
          key={i}
          cx={(rng() - 0.5) * r * 2.2}
          cy={-r * (0.3 + rng() * 1.1)}
          r={blossoms ? vary(rng, 0.9) : 0.7}
          fill={pickFrom(dotColors, rng)}
        />
      ))}
    </>
  );
}

/** Рябина: стройная, крона вытянута вверх и светлая, ягоды — оранжево-красными гроздьями. */
function Rowan({ h, rng }: { h: number; rng: Rng }) {
  const colors = pickFrom(
    [
      ['#93ba68', '#80a95a', '#a2c678'],
      ['#9cbf6c', '#88ae5e', '#aacb7c'],
    ],
    rng,
  );
  const w = Math.max(1.4, h * 0.06);
  const lean = (rng() - 0.5) * h * 0.06;
  const berry = Math.max(0.65, h * 0.026);
  // Гроздь — щиток из ягод, свисает с края кроны.
  const cluster = (cx: number, cy: number, key: number) => (
    <g key={key}>
      {[
        [0, 0],
        [-1.1, 0.5],
        [1.1, 0.5],
        [-0.55, 1.3],
        [0.55, 1.3],
        [0, 2.1],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={cx + dx! * berry * 1.5} cy={cy + dy! * berry * 1.4} r={berry} fill={i % 2 ? '#c2421f' : '#e65a2a'} />
      ))}
    </g>
  );
  return (
    <>
      <rect x={-w / 2} y={-h * 0.52} width={w} height={h * 0.52} fill={TRUNK} />
      <ellipse cx={lean - h * 0.13} cy={-h * 0.58} rx={h * vary(rng, 0.12)} ry={h * 0.2} fill={colors[1]} />
      <ellipse cx={lean + h * 0.13} cy={-h * 0.6} rx={h * vary(rng, 0.12)} ry={h * 0.21} fill={colors[2]} />
      <ellipse cx={lean} cy={-h * 0.7} rx={h * vary(rng, 0.17, 0.08)} ry={h * 0.29} fill={colors[0]} />
      {cluster(lean - h * 0.15, -h * 0.5, 0)}
      {cluster(lean + h * 0.14, -h * 0.56, 1)}
      {cluster(lean + h * 0.02, -h * 0.8, 2)}
      {h > 20 && cluster(lean - h * 0.06, -h * 0.64, 3)}
    </>
  );
}

/** Яблоня: низкая и раскидистая, кривой ствол, тёмная плоская крона, крупные яблоки с бликом. */
function AppleTree({ h, rng }: { h: number; rng: Rng }) {
  const colors = pickFrom(
    [
      ['#5f9450', '#4f8344', '#6ea25b'],
      ['#669a55', '#568a48', '#76a860'],
    ],
    rng,
  );
  const w = Math.max(2, h * 0.11);
  const rx = h * vary(rng, 0.44, 0.06);
  const cy = -h * 0.62;
  const fruit = Math.max(1.2, h * 0.05);
  const apples = [
    [-0.55, 0.35],
    [-0.2, 0.55],
    [0.25, 0.45],
    [0.6, 0.2],
    [0.05, -0.15],
    [-0.4, -0.3],
  ];
  return (
    <>
      <path
        d={`M0 0 Q${-w * 0.6} ${-h * 0.2} ${w * 0.2} ${-h * 0.42} M${w * 0.1} ${-h * 0.32} L${h * 0.16} ${-h * 0.5} M${-w * 0.1} ${-h * 0.3} L${-h * 0.15} ${-h * 0.48}`}
        stroke={TRUNK}
        stroke-width={w}
        stroke-linecap="round"
        fill="none"
      />
      <circle cx={-rx * 0.45} cy={cy - h * 0.14} r={h * 0.2} fill={colors[1]} />
      <circle cx={rx * 0.4} cy={cy - h * 0.16} r={h * vary(rng, 0.19)} fill={colors[2]} />
      <ellipse cx={0} cy={cy} rx={rx} ry={h * 0.24} fill={colors[0]} />
      {apples.map(([ax, ay], i) => {
        const x = ax! * rx * 0.85 + (rng() - 0.5) * fruit;
        const y = cy + ay! * h * 0.24;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={fruit} fill={i === 3 ? '#e9a23b' : '#d8403a'} />
            <circle cx={x - fruit * 0.35} cy={y - fruit * 0.35} r={fruit * 0.3} fill="#ffffff" opacity="0.55" />
          </g>
        );
      })}
    </>
  );
}

function Sunflower({ size, rng }: { size: PlantSize; rng: Rng }) {
  const n = size === 'large' ? 3 : 2;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const x = (i - (n - 1) / 2) * 4 + (rng() - 0.5);
        const h = vary(rng, 14, 0.15);
        return (
          <g key={i}>
            <line x1={x} y1={0} x2={x} y2={-h} stroke="#5a8758" stroke-width="0.9" />
            <ellipse cx={x + 1.6} cy={-h * 0.45} rx={1.8} ry={0.8} fill="#6c9c5e" transform={`rotate(-25 ${x + 1.6} ${-h * 0.45})`} />
            <circle cx={x} cy={-h} r={2.6} fill="#f2c14e" />
            <circle cx={x} cy={-h} r={1.2} fill="#7a4e2d" />
          </g>
        );
      })}
    </>
  );
}

/** Рисунок растения. Масштаб по глубине и место задаёт долина. */
export function PlantArt({ kind, size, seed }: { kind: PlantKind; size: PlantSize; seed: number }) {
  const rng = createRng(seed);
  const h = vary(rng, TREE_HEIGHT[size]);
  switch (kind) {
    case 'pine':
      return <Pine h={h * 1.1} rng={rng} />;
    case 'oak':
      return <RoundCrown h={h} rng={rng} colors={pickFrom(OAK_COLORS, rng)} trunkW={Math.max(2, h * 0.11)} />;
    case 'birch':
      return <Birch h={h * 1.05} rng={rng} />;
    case 'willow':
      return <Willow h={h} rng={rng} />;
    case 'flowers':
      return <Flowers size={size} rng={rng} />;
    case 'bush':
      return <Bush size={size} rng={rng} blossoms={null} />;
    case 'lilac':
      return <Bush size="large" rng={rng} blossoms={['#b58bd1', '#9b72c0', '#c9a0dc']} />;
    case 'rowan':
      return <Rowan h={h} rng={rng} />;
    case 'apple':
      return <AppleTree h={h * 0.85} rng={rng} />;
    case 'sunflower':
      return <Sunflower size={size} rng={rng} />;
  }
}
