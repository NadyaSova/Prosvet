// Вещи лагеря из лавки: палатка позади странницы, фонарь на шесте, котелок на треноге над костром.
// Рисуются в координатах долины: начало — на земле под вещью. Места — CAMP_SPOTS в logic/valley-district.ts.

import type { SceneCamp } from '../../logic/valley';
import { PALETTE } from '../palette';

function Tent() {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="19" ry="2.6" fill={PALETTE.shadowGreen} opacity="0.25" />
      <polygon points="-17,0 0,-27 17,0" fill={PALETTE.canvas} />
      <polygon points="0,-27 17,0 6,0" fill="#c4a274" />
      {/* вход */}
      <polygon points="-5,0 0,-15 5,0" fill={PALETTE.bark} />
      <path d="M0 -15 L-4 0" stroke="#e8d2ac" stroke-width="0.8" />
      <path d="M0 -27 L0 -31" stroke="#7d5638" stroke-width="1.2" stroke-linecap="round" />
      <path d="M0 -31 L5 -29.5 L0 -28" fill={PALETTE.fire} />
      <path d="M-17 0 L-21 1.5 M17 0 L21 1.5" stroke="#7d5638" stroke-width="0.8" stroke-linecap="round" />
    </g>
  );
}

function Lantern() {
  return (
    <g>
      <circle cx="6" cy="-27" r="7" fill={PALETTE.glow} opacity="0.3" class="lantern__glow" />
      <circle cx="6" cy="-27" r="4.5" fill={PALETTE.glow} opacity="0.35" />
      <path d="M0 1 L0 -34 L6 -34" stroke={PALETTE.bark} stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6 -34 L6 -31" stroke={PALETTE.barkDark} stroke-width="0.7" />
      <rect x="3" y="-31" width="6" height="7.5" rx="1.2" fill="#ffe6a0" stroke={PALETTE.barkDark} stroke-width="0.8" />
      <path d="M2.5 -31 L9.5 -31 M3.5 -23.5 L8.5 -23.5" stroke={PALETTE.barkDark} stroke-width="1.1" stroke-linecap="round" />
      <ellipse cx="6" cy="-27.2" rx="1.3" ry="2" fill={PALETTE.sun} />
    </g>
  );
}

function Kettle() {
  return (
    <g>
      {/* тренога */}
      <path d="M-12 2.5 L0 -32 M12 2.5 L0 -32 M3 4 L0 -32" stroke={PALETTE.bark} stroke-width="1.3" stroke-linecap="round" fill="none" />
      <path d="M0 -32 L0 -27" stroke="#5a5550" stroke-width="0.6" />
      {/* котелок */}
      <path d="M-4.5 -24.5 Q0 -30 4.5 -24.5" stroke="#4a4642" stroke-width="0.8" fill="none" />
      <path d="M-5 -24.5 L5 -24.5 L4 -19.5 Q0 -17.8 -4 -19.5 Z" fill="#4a4642" />
      <path d="M-5 -24.5 L5 -24.5" stroke="#6e6862" stroke-width="1.2" stroke-linecap="round" />
      <path class="kettle__steam" d="M-1 -26 c-2 -3 2 -4 0 -7 M2 -26 c-2 -3 2 -4 0 -7" stroke="#f4f2ee" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8" />
    </g>
  );
}

export function CampArt({ item }: { item: SceneCamp }) {
  return (
    <g transform={`translate(${item.x} ${item.y})`} role="img" aria-label={CAMP_LABELS[item.kind]}>
      {item.kind === 'tent' ? <Tent /> : item.kind === 'lantern' ? <Lantern /> : <Kettle />}
    </g>
  );
}

const CAMP_LABELS: Record<SceneCamp['kind'], string> = {
  tent: 'Палатка',
  lantern: 'Фонарь',
  kettle: 'Котелок над костром',
};
