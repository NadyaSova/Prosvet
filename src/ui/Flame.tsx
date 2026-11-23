// Простой значок костра для индикатора серии. Настоящий костёр в долине — шаг 6.

import type { FireLevel } from '../logic/streak';

const FLAME_SCALE: Record<FireLevel, number> = { full: 1, medium: 0.8, low: 0.58, embers: 0, out: 0 };

export function Flame({ level }: { level: FireLevel }) {
  const scale = FLAME_SCALE[level];
  return (
    <svg class={`flame flame--${level}`} viewBox="0 0 48 48" aria-hidden="true">
      <g fill="var(--color-log)">
        <rect x="9" y="38" width="30" height="5" rx="2.5" transform="rotate(-12 24 40.5)" />
        <rect x="9" y="38" width="30" height="5" rx="2.5" transform="rotate(12 24 40.5)" />
      </g>
      {scale > 0 && (
        <g class="flame__fire" transform={`translate(24 39) scale(${scale}) translate(-24 -39)`}>
          <path
            fill="var(--color-fire)"
            d="M24 5c5 9 13 14 13 24a13 13 0 0 1-26 0c0-6 3-10 6-14 1 4 3 6 5 7 0-6 0-11 2-17z"
          />
          <path fill="var(--color-sun)" d="M24 20c3 5 7 8 7 12a7 7 0 0 1-14 0c0-4 4-7 7-12z" />
        </g>
      )}
      {level === 'embers' && (
        <g fill="var(--color-fire)">
          <circle cx="19" cy="36" r="2.2" />
          <circle cx="25" cy="35" r="2.6" />
          <circle cx="30" cy="36.5" r="1.8" />
        </g>
      )}
      {level === 'out' && (
        <path
          d="M24 34c-3-4 3-6 0-11s3-7 0-12"
          fill="none"
          stroke="var(--color-mist)"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      )}
    </svg>
  );
}
