// Костёр в лагере — серия (SPEC.md §8). Яркость по тому, сколько дней осталось:
// день действия — полный огонь, дальше меньше, потом угли; серия прервалась — погасший костёр с дымком.

import type { FireLevel } from '../../logic/streak';

const FLAME_SCALE: Record<FireLevel, number> = { full: 1, medium: 0.78, low: 0.55, embers: 0, out: 0 };

export function CampfireArt({ level, x, y }: { level: FireLevel; x: number; y: number }) {
  const scale = FLAME_SCALE[level];
  const burning = scale > 0;
  return (
    <g transform={`translate(${x} ${y})`} role="img" aria-label="Костёр">
      {burning && <ellipse cx="0" cy="1" rx={9 * scale + 5} ry={2.4 * scale + 1.2} fill="#ffe2a0" opacity="0.5" />}
      {/* камни вокруг */}
      <g fill="#9a948a">
        <ellipse cx="-9" cy="1.5" rx="2.6" ry="1.6" />
        <ellipse cx="9" cy="1.5" rx="2.6" ry="1.6" />
        <ellipse cx="0" cy="3" rx="2.8" ry="1.5" />
      </g>
      <line x1="-9" y1="2" x2="9" y2="-2" stroke="#6b4a35" stroke-width="3" stroke-linecap="round" />
      <line x1="-9" y1="-2" x2="9" y2="2" stroke="#5a3d2b" stroke-width="3" stroke-linecap="round" />
      {burning && (
        <g transform={`scale(${scale})`}>
          <g class="campfire__flame">
            <polygon points="0,-22 -7,-1 7,-1" fill="#e8833a" />
            <polygon points="-4,-13 -8,-1 0,-1" fill="#e8833a" />
            <polygon points="1,-14 -3,-1 5,-1" fill="#f6c177" />
          </g>
        </g>
      )}
      {level === 'embers' && (
        <g fill="#e8833a">
          <circle cx="-3" cy="-1.5" r="1.4" />
          <circle cx="1.5" cy="-2.2" r="1.7" />
          <circle cx="4.5" cy="-1" r="1.1" />
        </g>
      )}
      {level === 'out' && (
        <path class="campfire__smoke" d="M0 -3 c-3 -4 3 -6 0 -10 s3 -6 0 -10" fill="none" stroke="#b9b9be" stroke-width="1.6" stroke-linecap="round" />
      )}
    </g>
  );
}
