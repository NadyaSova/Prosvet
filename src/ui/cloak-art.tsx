// Героиня в плаще из перьев (вид со спины — странница смотрит на долину). SPEC.md §9.4.
// Стадия плаща — по числу пройденных порогов; каждое перо вшито в плащ своим цветом и величиной.
// Места перьев стабильны между запусками: порядок мест — постоянный сид, небольшой разброс — сид от id голубя.

import { useId } from 'preact/hooks';
import type { Feather } from '../logic/pigeons';
import { createRng, shuffled } from '../logic/rng';
import { FeatherShape } from './pigeon-art';

interface CloakShape {
  /** Полуширина подола. */
  w: number;
  /** Где подол. */
  hem: number;
}

/** Стадии: 0 — короткая накидка, дальше плащ длиннее и шире. Индекс — число пройденных порогов. */
const STAGES: CloakShape[] = [
  { w: 30, hem: 116 },
  { w: 36, hem: 142 },
  { w: 42, hem: 176 },
  { w: 48, hem: 210 },
  { w: 52, hem: 212 },
  { w: 56, hem: 214 },
  { w: 60, hem: 214 },
];

/** Цвета героини — общие для плаща в голубятне и странницы у костра в долине. */
export const HEROINE = {
  hair: '#e3c48a',
  hairLine: '#bf9a5a',
  bun: '#cfa968',
  ribbon: '#b9473d',
  cloak: '#cdbfa8',
  cloakLine: '#a8977c',
  collar: '#e2b04a',
} as const;

const CX = 100;
const TOP = 64;
const SHOULDER = 21;

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const STEP = 10;

/**
 * Места для перьев — сетка по всему плащу. Порядок мест перемешан постоянным сидом:
 * перья рассыпаны по всему плащу, и с каждым новым он заметно гуще. На порогах 100 перьев плащ почти полон.
 */
function featherSlots({ w, hem }: CloakShape): { x: number; y: number }[] {
  const slots: { x: number; y: number }[] = [];
  let row = 0;
  for (let y = TOP + 4; y <= hem - 16; y += STEP, row++) {
    const half = SHOULDER + ((w - SHOULDER) * (y - TOP)) / (hem - TOP) - 5;
    for (let dx = row % 2 ? STEP / 2 : 0; dx <= half; dx += STEP) {
      slots.push({ x: CX + dx, y });
      if (dx > 0) slots.push({ x: CX - dx, y });
    }
  }
  return shuffled(slots, createRng(20261123));
}

function cloakPath({ w, hem }: CloakShape, train: boolean): string {
  const right = CX + w;
  const left = CX - w;
  const hemPart = train
    ? // Шлейф лежит на земле за спиной и расходится в обе стороны поровну — вид со спины.
      `L${right} ${hem} Q${right + 4} ${hem + 7} ${right + 16} ${hem + 10} Q${CX} ${hem + 16} ${left - 16} ${hem + 10} Q${left - 4} ${hem + 7} ${left} ${hem}`
    : `L${right} ${hem} Q${CX} ${hem + 8} ${left} ${hem}`;
  return `M${CX - SHOULDER} ${TOP + 2} Q${CX} ${TOP - 10} ${CX + SHOULDER} ${TOP + 2} ${hemPart} Z`;
}

export function CloakArt({ feathers, stage, class: className }: { feathers: readonly Feather[]; stage: number; class?: string }) {
  const shape = STAGES[Math.min(stage, STAGES.length - 1)]!;
  const slots = featherSlots(shape);
  const train = stage >= 6;
  const shimmer = stage >= 5;
  const collar = stage >= 4;

  const placed = feathers.map((f, i) => {
    const slot = slots[i % slots.length]!;
    const layer = Math.floor(i / slots.length);
    const rng = createRng(hashSeed(f.pigeonId));
    return {
      f,
      x: slot.x + (rng() - 0.5) * 3 + layer * 4,
      y: slot.y + (rng() - 0.5) * 2 + layer * 3,
      rotate: (rng() - 0.5) * 24 + (slot.x - CX) * 0.35,
    };
  });
  // Нижние ряды рисуются первыми, верхние ложатся на них — как черепица.
  const drawOrder = [...placed].sort((a, b) => b.y - a.y);
  const path = cloakPath(shape, train);
  // id обрезки и блика — свои у каждого плаща: в галерее плащи разных стадий стоят на одной странице,
  // и с общим id браузер обрезал бы все перья по первому, самому короткому плащу.
  const uid = useId();
  const clipId = `cloak-clip-${uid}`;
  const shimmerId = `cloak-shimmer-${uid}`;

  return (
    <svg class={className} viewBox="0 0 200 236" role="img" aria-label="Странница в плаще из перьев">
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
        <linearGradient id={shimmerId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.45" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      </defs>

      {/* земля */}
      <ellipse cx={CX} cy="226" rx={shape.w + (train ? 26 : 18)} ry="7" fill="#94b98f" opacity="0.5" />
      {/* платье и ноги видны под короткой накидкой */}
      <path d={`M${CX - 20} 96 L${CX - 26} 220 L${CX + 26} 220 L${CX + 20} 96 Z`} fill="#6f8f6a" />
      <ellipse cx={CX - 10} cy="223" rx="7" ry="4" fill="#6b4a36" />
      <ellipse cx={CX + 10} cy="223" rx="7" ry="4" fill="#6b4a36" />

      {/* плащ */}
      <path d={path} fill={HEROINE.cloak} />
      <g clip-path={`url(#${clipId})`}>
        {drawOrder.map(({ f, x, y, rotate }, i) => (
          <FeatherShape key={`${f.pigeonId}-${i}`} color={f.color} size={f.size} x={x} y={y} rotate={rotate} scale={0.95} />
        ))}
        {shimmer && <rect class="cloak__shimmer" x="0" y="0" width="200" height="236" fill={`url(#${shimmerId})`} />}
      </g>
      <path d={path} fill="none" stroke={HEROINE.cloakLine} stroke-width="1.5" />

      {/* воротник из перьев на поздних стадиях */}
      {collar && (
        <path
          d={`M${CX - 24} ${TOP + 4} Q${CX} ${TOP - 12} ${CX + 24} ${TOP + 4} Q${CX} ${TOP + 12} ${CX - 24} ${TOP + 4} Z`}
          fill={HEROINE.collar}
          opacity="0.85"
        />
      )}

      {/* голова: волосы с пучком */}
      <circle cx={CX} cy="44" r="17" fill={HEROINE.hair} stroke={HEROINE.hairLine} stroke-width="1" />
      <circle cx={CX} cy="25" r="8" fill={HEROINE.bun} stroke={HEROINE.hairLine} stroke-width="1" />
      <path d={`M${CX - 8} 30 Q${CX} 34 ${CX + 8} 30`} stroke={HEROINE.ribbon} stroke-width="2.5" fill="none" stroke-linecap="round" />
    </svg>
  );
}
