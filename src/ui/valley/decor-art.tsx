// Редкости из карты добычи: олень у воды, светлячки, радуга над рекой.

import { createRng } from '../../logic/rng';
import type { SceneDecor } from '../../logic/valley';
import { depthScale, riverX } from '../../logic/valley-district';

function Deer({ d }: { d: SceneDecor }) {
  const rng = createRng(d.seed);
  // Второй олень на том же месте встаёт рядом.
  const x = d.x + d.layer * (10 + rng() * 6) * (d.layer % 2 ? 1 : -1);
  const y = d.y + d.layer * 2;
  // Смотрит в сторону реки и пьёт.
  const face = riverX(y) < x ? -1 : 1;
  const k = depthScale(y);
  return (
    <g transform={`translate(${x} ${y}) scale(${face * k} ${k})`}>
      <g stroke="#7d5638" stroke-width="1.4" stroke-linecap="round">
        <path d="M-6 -1 L-6.5 -8 M-3.5 -1 L-3.5 -8 M4 -1 L4.5 -8 M6.5 -1 L6 -8" />
      </g>
      <ellipse cx="0" cy="-10" rx="9" ry="4.2" fill="#a0704a" />
      <path d="M6 -11 Q10 -10 12 -4" stroke="#a0704a" stroke-width="3.2" fill="none" stroke-linecap="round" />
      <ellipse cx="12.6" cy="-3" rx="2.6" ry="1.7" fill="#a0704a" />
      <path d="M10.5 -5 l-1.5 -3.5 M11.5 -5.2 l0.5 -3.6" stroke="#7d5638" stroke-width="0.8" stroke-linecap="round" />
      <circle cx="-8.6" cy="-11.5" r="1.4" fill="#f4ede0" />
      <g fill="#f4ede0" opacity="0.8">
        <circle cx="-2" cy="-11.6" r="0.7" />
        <circle cx="1.5" cy="-12" r="0.7" />
        <circle cx="-0.5" cy="-9.8" r="0.6" />
      </g>
    </g>
  );
}

function Fireflies({ d }: { d: SceneDecor }) {
  const rng = createRng(d.seed);
  const n = 6;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = d.x + (rng() - 0.5) * 50 + d.layer * 8;
        const y = d.y - 6 - rng() * 22;
        return (
          <g key={i} class="firefly" style={{ animationDelay: `${-rng() * 4}s` }}>
            <circle cx={x} cy={y} r="2.4" fill="#fff3b0" opacity="0.35" />
            <circle cx={x} cy={y} r="0.9" fill="#fff8d0" />
          </g>
        );
      })}
    </g>
  );
}

const RAINBOW = ['#f2a7b5', '#f6c177', '#fff3b0', '#bcd1b3', '#9cc9db', '#c9a0dc'];

/** Радуга; вторая — внешняя дуга, двойная радуга. */
export function Rainbow({ d }: { d: SceneDecor }) {
  if (d.layer > 1) return null;
  const r0 = d.layer === 0 ? 70 : 88;
  return (
    <g opacity={d.layer === 0 ? 0.55 : 0.35} fill="none" stroke-width="3">
      {RAINBOW.map((c, i) => {
        // Во второй дуге цвета идут в обратном порядке — как у настоящей двойной радуги.
        const r = r0 - (d.layer === 0 ? i : RAINBOW.length - 1 - i) * 3;
        return <path key={c} d={`M${d.x - r} ${d.y} A${r} ${r} 0 0 1 ${d.x + r} ${d.y}`} stroke={c} />;
      })}
    </g>
  );
}

export function DecorArt({ d }: { d: SceneDecor }) {
  switch (d.kind) {
    case 'deer':
      return <Deer d={d} />;
    case 'fireflies':
      return <Fireflies d={d} />;
    case 'rainbow':
      return <Rainbow d={d} />;
  }
}
