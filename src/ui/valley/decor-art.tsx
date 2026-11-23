// Редкости из карты добычи: олень у воды, светлячки, радуга над рекой.

import { createRng } from '../../logic/rng';
import type { SceneDecor } from '../../logic/valley';
import { depthScale, riverX } from '../../logic/valley-district';

/** Рисунок оленя: копыта в (0, 0), смотрит вправо. Благородный олень с ветвистыми рогами, голова поднята. */
export function DeerArt() {
  const coat = '#a8693f';
  const light = '#d1a477';
  return (
    <g>
      {/* дальние ноги */}
      <g stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M5.4 -14 L5.9 -7 M-4.8 -14 L-6.2 -6" stroke="#7e4b2f" stroke-width="1.6" />
        <path d="M5.9 -7.4 L6.3 -0.4 M-6.2 -6 L-5.1 -0.4" stroke="#3a281b" stroke-width="1.05" />
      </g>
      {/* туловище, бедро, светлое брюхо, хвост */}
      <path
        d="M-9.6 -16.6 C-10 -20.6 -6.6 -21.6 -2 -21.2 L4 -21.6 C7.4 -22 9.6 -19.6 9.2 -16.2 C8.8 -13.6 7 -12.8 5 -12.9 L-2.5 -12.6 C-6 -12.4 -9.2 -13.2 -9.6 -16.6 Z"
        fill={coat}
      />
      <ellipse cx="-6.6" cy="-16" rx="3.4" ry="4.8" fill={coat} />
      <path d="M-3.4 -12.8 C-0.6 -13.8 2.6 -13.8 5.4 -13.1 C2.6 -12.5 -0.6 -12.5 -3.4 -12.8 Z" fill={light} />
      <path d="M-9.2 -19.6 C-10.6 -19 -10.6 -16.8 -9.6 -16 C-9 -17.2 -9 -18.4 -9.2 -19.6 Z" fill="#efe0c4" />
      {/* шея и светлая лохматая грудь */}
      <path d="M2.8 -20.8 C4.6 -25 6.4 -28.4 8 -31 L11.6 -30.6 C12 -26 11.6 -20.5 9.2 -15.8 Z" fill={coat} />
      <path d="M11.4 -28.8 C11.7 -24.5 11.2 -20 9.2 -16 L8.5 -17 L9 -19 L8.4 -20.8 L9.2 -22.8 L8.8 -25 L9.8 -26.8 Z" fill={light} />
      {/* ближние ноги: светлее, голени тёмные */}
      <g stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M7.6 -14.4 L7.9 -7 M-7.2 -14 L-8.8 -6" stroke="#94593a" stroke-width="1.8" />
        <path d="M7.9 -7.4 L7.6 -0.4 M-8.8 -6 L-7.8 -0.4" stroke="#4a3222" stroke-width="1.15" />
      </g>
      {/* голова с рогами */}
      <g transform="translate(0 -3.4)">
        <g stroke="#cfae84" stroke-linecap="round" fill="none">
          <path d="M9.2 -30.2 C7 -33 4.6 -35 3 -41 M10.6 -30.4 C12.2 -33.4 13.6 -36.6 14.4 -41.4" stroke-width="0.9" />
          <path
            d="M8 -31.8 L10 -33.6 M6 -33.9 L3.6 -35.2 M4.4 -36.6 L6.2 -39.4 M3 -41 L1.6 -42.8 M3 -41 L4 -43.4 M12.4 -34.2 L15.2 -35.2 M13.4 -36.6 L11.6 -39 M14 -38.8 L16.2 -40.6 M14.4 -41.4 L13.6 -43.6 M14.4 -41.4 L15.6 -43.2"
            stroke-width="0.65"
          />
        </g>
        <path d="M10.6 -29.6 Q12.4 -32.6 13.6 -32.4 Q13 -30.6 11.4 -29 Z" fill="#8f5733" />
        <path d="M7.6 -28.2 C8 -30.4 10.6 -30.8 12 -29.6 L15.2 -27.4 C15.8 -26.8 15.4 -26 14.6 -25.9 L12 -25.7 C10.4 -25.6 9 -26 8 -26.8 Z" fill={coat} />
        <path d="M12.4 -26 C13.4 -25.6 14.4 -25.6 14.8 -26.1 L12.2 -26.4 Z" fill={light} />
        <path d="M9 -29.2 Q6.4 -32.6 5.4 -31.6 Q6.6 -29.6 8.4 -28.4 Z" fill="#9a5e38" />
        <circle cx="15" cy="-26.9" r="0.7" fill="#2b1d14" />
        <circle cx="11.2" cy="-28.5" r="0.5" fill="#2b1d14" />
      </g>
    </g>
  );
}

/** Олень в долине мельче рисунка: холка — примерно треть средней яблони. */
export const DEER_SCALE = 0.6;

function Deer({ d }: { d: SceneDecor }) {
  const rng = createRng(d.seed);
  // Второй олень на том же месте встаёт рядом.
  const x = d.x + d.layer * (10 + rng() * 6) * (d.layer % 2 ? 1 : -1);
  const y = d.y + d.layer * 2;
  // Стоит у воды и смотрит в сторону реки.
  const face = riverX(y) < x ? -1 : 1;
  const k = depthScale(y) * DEER_SCALE;
  return (
    <g transform={`translate(${x} ${y}) scale(${face * k} ${k})`}>
      <DeerArt />
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
