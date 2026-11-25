// Рисунок босса на его экранах (docs/phase2-plan.md §5): конечный — сооружение под туманом, бесконечный — место,
// которое наполняется. Здесь — картинка для списка и экрана босса; в долине сооружение рисует valley/landmark-scene.tsx.
// Сами сооружения и места рисует дорожка «Рисунки» (valley/landmark-art.tsx, valley/garden-art.tsx).

import { useId } from 'preact/hooks';
import { fogDensity, gardenView } from '../logic/bosses';
import type { Boss } from '../model/types';
import { PALETTE } from './palette';
import { GardenArt } from './valley/garden-art';
import { LandmarkArt } from './valley/landmark-art';

/**
 * Насколько видно сооружение сквозь туман плотности density: сплошной туман — не видно совсем,
 * после 3–4 подходов проступает силуэт (docs/phase2-plan.md §5.2), у самого тонкого тумана — почти целиком.
 */
export function landmarkVisibility(density: number): number {
  if (density >= 1) return 0;
  return Math.min(1, ((1 - density) / 0.9) ** 1.3);
}

/** Клочья тумана: середина и радиусы, в единицах рамки сооружения (120 × 100). Те же клочья — над сооружением в долине. */
export const LANDMARK_MIST = [
  { cx: -32, cy: -62, rx: 52, ry: 40 },
  { cx: 28, cy: -48, rx: 56, ry: 42 },
  { cx: 0, cy: -18, rx: 74, ry: 30 },
  { cx: -18, cy: -88, rx: 48, ry: 26 },
  { cx: 34, cy: -86, rx: 42, ry: 24 },
];

interface Props {
  boss: Boss;
  class?: string;
  /** Без движения: в списке, где боссов много. */
  still?: boolean;
  /** Победа: туман рассеивается с анимацией, сооружение проявляется целиком. */
  reveal?: boolean;
}

export function BossArt({ boss, class: className, still = false, reveal = false }: Props) {
  const id = `boss-art-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const sky = (
    <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7ecdc" />
      <stop offset="1" stop-color="#e6ead6" />
    </linearGradient>
  );

  if (boss.kind === 'endless' && boss.place.garden) {
    const v = gardenView(boss);
    return (
      <svg class={`boss-art ${className ?? ''}`} viewBox="-64 -66 128 72" aria-hidden="true">
        <defs>{sky}</defs>
        <rect x="-64" y="-66" width="128" height="72" rx="5" fill={`url(#${id}-sky)`} />
        <ellipse cx="0" cy="-2" rx="70" ry="16" fill={PALETTE.hillFar} />
        <GardenArt kind={boss.place.garden} seed={boss.place.seed} size={60} count={v.elements} special={v.specials} bloom={v.bloom} still={still} />
      </svg>
    );
  }

  const landmark = boss.place.landmark;
  const density = reveal ? 0 : fogDensity(boss);
  // До победы — сколько видно сквозь туман; при победе проявляется от прежнего тумана.
  const before = reveal ? fogDensity({ ...boss, status: 'active' }) : density;
  const visible = boss.status === 'won' && !reveal ? 1 : landmarkVisibility(before);
  return (
    <svg class={`boss-art ${className ?? ''}`} viewBox="-66 -106 132 112" aria-hidden="true">
      <defs>
        {sky}
        <radialGradient id={`${id}-mist`}>
          <stop offset="0" stop-color="#f3f1f3" stop-opacity="1" />
          <stop offset="0.55" stop-color="#e2e1e6" stop-opacity="0.9" />
          <stop offset="1" stop-color={PALETTE.mist} stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="-66" y="-106" width="132" height="112" rx="5" fill={`url(#${id}-sky)`} />
      <ellipse cx="0" cy="2" rx="72" ry="14" fill={PALETTE.hillFar} />
      {landmark && (visible > 0.02 || reveal) && (
        <g class={reveal ? 'boss-art__show' : undefined} style={reveal ? { '--from': visible } : undefined} opacity={reveal ? undefined : visible}>
          <LandmarkArt kind={landmark} seed={boss.place.seed} size={100} />
        </g>
      )}
      {(density > 0 || reveal) && (
        <g class={reveal ? 'boss-art__lift' : undefined} style={reveal ? { '--from': before } : undefined} opacity={reveal ? 0 : density}>
          <rect x="-66" y="-106" width="132" height="112" rx="5" fill={PALETTE.mist} opacity="0.3" />
          {LANDMARK_MIST.map((m, i) => (
            <ellipse key={i} {...m} fill={`url(#${id}-mist)`} />
          ))}
        </g>
      )}
    </svg>
  );
}
