// Странница сидит у костра, спиной к нам, и смотрит на огонь и долину. Плащ — тот же, что в голубятне
// (src/ui/cloak-art.tsx): чем больше порогов пройдено, тем шире он стелется по земле; на поздних стадиях —
// воротник и переливы, на последней — шлейф. Каждое перо вшито своим цветом и величиной.
// Рисуется в координатах долины: начало — на земле под страницей.

import type { Feather } from '../../logic/pigeons';
import { createRng, shuffled } from '../../logic/rng';
import { hashSeed, HEROINE } from '../cloak-art';
import { FeatherShape } from '../pigeon-art';

/** Полуширина плаща у земли по стадии. */
const SPREAD = [12, 14, 16, 18, 19, 20, 21];
const SHOULDER = 6.5;
const NECK_Y = -27;
const STEP = 3.1;

function cloakPath(w: number, train: boolean): string {
  const side = `C${w * 0.7} -18 ${w} -8 ${w} -1`;
  const back = `C${-w} -8 ${-w * 0.7} -18 ${-SHOULDER} ${NECK_Y}`;
  // Шлейф лежит на земле за спиной и расходится в обе стороны поровну — как у плаща в голубятне.
  const hem = train ? `Q${w + 3} 1 ${w + 8} 2 Q0 4.5 ${-w - 8} 2 Q${-w - 3} 1 ${-w} -1` : `Q0 3 ${-w} -1`;
  return `M${-SHOULDER} ${NECK_Y} Q0 ${NECK_Y - 4} ${SHOULDER} ${NECK_Y} ${side} ${hem} ${back} Z`;
}

/** Места перьев — сетка по плащу, порядок перемешан постоянным сидом: перья рассыпаны по всему плащу. */
function featherSlots(w: number): { x: number; y: number }[] {
  const slots: { x: number; y: number }[] = [];
  let row = 0;
  for (let y = NECK_Y + 2; y <= -2; y += STEP, row++) {
    const t = (y - NECK_Y) / -NECK_Y;
    const half = SHOULDER + (w - SHOULDER) * Math.pow(t, 0.8) - 1.6;
    for (let dx = row % 2 ? STEP / 2 : 0; dx <= half; dx += STEP) {
      slots.push({ x: dx, y });
      if (dx > 0) slots.push({ x: -dx, y });
    }
  }
  return shuffled(slots, createRng(20261124));
}

export function WandererArt({ feathers, stage, x, y }: { feathers: readonly Feather[]; stage: number; x: number; y: number }) {
  const s = Math.min(Math.max(stage, 0), SPREAD.length - 1);
  const w = SPREAD[s]!;
  const train = s >= 6;
  const shimmer = s >= 5;
  const collar = s >= 4;
  const path = cloakPath(w, train);
  const slots = featherSlots(w);
  const placed = feathers.map((f, i) => {
    const slot = slots[i % slots.length]!;
    const layer = Math.floor(i / slots.length);
    const rng = createRng(hashSeed(f.pigeonId));
    return {
      f,
      x: slot.x + (rng() - 0.5) * 0.8 + layer * 1.1,
      y: slot.y + (rng() - 0.5) * 0.6 + layer * 0.8,
      rotate: (rng() - 0.5) * 24 + slot.x * 1.6,
    };
  });
  const drawOrder = [...placed].sort((a, b) => b.y - a.y);

  return (
    <g transform={`translate(${x} ${y})`} role="img" aria-label="Странница у костра">
      <defs>
        <clipPath id="wanderer-clip">
          <path d={path} />
        </clipPath>
        <linearGradient id="wanderer-shimmer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.5" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="0" cy="1.5" rx={w + (train ? 10 : 4)} ry="3" fill="#3f6b4a" opacity="0.28" />
      <path d={path} fill={HEROINE.cloak} />
      <g clip-path="url(#wanderer-clip)">
        {drawOrder.map(({ f, x: fx, y: fy, rotate }, i) => (
          <FeatherShape key={`${f.pigeonId}-${i}`} color={f.color} size={f.size} x={fx} y={fy} rotate={rotate} scale={0.15} />
        ))}
        {shimmer && <rect class="cloak__shimmer" x={-w - 10} y={NECK_Y - 4} width={2 * w + 20} height={34} fill="url(#wanderer-shimmer)" />}
      </g>
      <path d={path} fill="none" stroke={HEROINE.cloakLine} stroke-width="0.6" />
      {collar && (
        <path
          d={`M${-SHOULDER - 2} ${NECK_Y + 1} Q0 ${NECK_Y - 4.5} ${SHOULDER + 2} ${NECK_Y + 1} Q0 ${NECK_Y + 4} ${-SHOULDER - 2} ${NECK_Y + 1} Z`}
          fill={HEROINE.collar}
          opacity="0.85"
        />
      )}
      {/* Голова чуть повёрнута к огню (он справа). */}
      <circle cx="0.6" cy="-32.5" r="6" fill={HEROINE.hair} stroke={HEROINE.hairLine} stroke-width="0.5" />
      <circle cx="0.9" cy="-39.6" r="2.9" fill={HEROINE.bun} stroke={HEROINE.hairLine} stroke-width="0.5" />
      <path d="M-2.2 -37.2 Q0.8 -35.6 3.8 -37.2" stroke={HEROINE.ribbon} stroke-width="1.1" fill="none" stroke-linecap="round" />
    </g>
  );
}
