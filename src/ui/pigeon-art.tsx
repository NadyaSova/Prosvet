// Рисунок голубя и пера по виду (PigeonLook). Только отрисовка: модель голубя о ней не знает,
// рисунок можно заменить, не трогая игровую логику (SPEC.md §12.3). Стиль — плоский, как docs/reference-valley.svg.

import type { PigeonColor, PigeonLook, PigeonSize } from '../model/types';

interface Palette {
  body: string;
  wing: string;
  bars: string;
  neck: string;
  /** Обводка — чтобы белый голубь не терялся на светлом фоне. */
  line: string;
}

export const PIGEON_PALETTE: Record<PigeonColor, Palette> = {
  slate: { body: '#9aa6b8', wing: '#808ca3', bars: '#56617a', neck: '#8db3a6', line: '#6c7890' },
  white: { body: '#fbf8f2', wing: '#ebe5da', bars: '#cdc4b5', neck: '#efe3ee', line: '#c9bfae' },
  rose: { body: '#dcb7b6', wing: '#c79fa2', bars: '#9b7176', neck: '#e8cbcd', line: '#ad8589' },
  lilac: { body: '#bcaad2', wing: '#a28fbd', bars: '#76659b', neck: '#d0c3e3', line: '#8b79ab' },
};

export const FEATHER_COLORS: Record<PigeonColor | 'gold', { fill: string; vein: string }> = {
  slate: { fill: '#8e9ab0', vein: '#5d6880' },
  white: { fill: '#f6f2ea', vein: '#bfb5a4' },
  rose: { fill: '#d4a9ad', vein: '#9b7176' },
  lilac: { fill: '#ad9bc8', vein: '#76659b' },
  gold: { fill: '#e2b04a', vein: '#a87a22' },
};

export const SIZE_SCALE: Record<PigeonSize, number> = { small: 0.78, medium: 0.9, large: 1 };

const FEET = { x: 49, y: 84 };
const EYE = '#3b2f2a';
const BEAK = '#d8a48f';
const LEGS = '#d9776b';

/** Голова в разных позах: центр, клюв, глаз. */
function head(pose: PigeonLook['pose'], p: Palette) {
  switch (pose) {
    case 'sit':
      return (
        <g>
          <ellipse cx="66" cy="46" rx="11" ry="13" fill={p.neck} />
          <circle cx="72" cy="31" r="11" fill={p.body} stroke={p.line} stroke-width="1" />
          <path d="M82 29 L91 33 L82 36 Z" fill={BEAK} />
          <circle cx="81.5" cy="29.5" r="1.6" fill="#fff" />
          <circle cx="75" cy="29" r="2.4" fill="#e9925a" />
          <circle cx="75" cy="29" r="1.2" fill={EYE} />
        </g>
      );
    case 'look':
      // Оглядывается назад, через плечо.
      return (
        <g>
          <ellipse cx="64" cy="45" rx="11" ry="13" fill={p.neck} />
          <circle cx="62" cy="30" r="11" fill={p.body} stroke={p.line} stroke-width="1" />
          <path d="M52 28 L43 32 L52 35 Z" fill={BEAK} />
          <circle cx="52.5" cy="28.5" r="1.6" fill="#fff" />
          <circle cx="58" cy="28" r="2.4" fill="#e9925a" />
          <circle cx="58" cy="28" r="1.2" fill={EYE} />
        </g>
      );
    case 'preen':
      // Чистит перо: голова опущена к крылу.
      return (
        <g>
          <ellipse cx="62" cy="47" rx="11" ry="11" fill={p.neck} />
          <circle cx="57" cy="40" r="10.5" fill={p.body} stroke={p.line} stroke-width="1" />
          <path d="M49 44 L43 51 L51 49 Z" fill={BEAK} />
          <circle cx="54" cy="38" r="2.2" fill="#e9925a" />
          <circle cx="54" cy="38" r="1.1" fill={EYE} />
        </g>
      );
  }
}

export function PigeonArt({ look, class: className }: { look: PigeonLook; class?: string }) {
  const p = PIGEON_PALETTE[look.color];
  const s = SIZE_SCALE[look.size];
  return (
    <svg class={className} viewBox="0 0 100 90" aria-hidden="true">
      <g transform={`translate(${FEET.x} ${FEET.y}) scale(${s}) translate(${-FEET.x} ${-FEET.y})`}>
        {/* хвост */}
        <path d="M27 52 L6 59 L8 67 L30 61 Z" fill={p.wing} stroke={p.line} stroke-width="1" />
        <path d="M7 62 L9 67 L14 65.5 L12 60.5 Z" fill={p.bars} />
        {/* лапы */}
        <path d="M44 70 L42 83 M54 70 L56 83 M38 83 h8 M52 83 h8" stroke={LEGS} stroke-width="2.4" stroke-linecap="round" fill="none" />
        {/* тело */}
        <ellipse cx="48" cy="55" rx="26" ry="18" fill={p.body} stroke={p.line} stroke-width="1" />
        {/* крыло с полосками */}
        <path d="M28 49 Q48 36 66 50 Q57 66 30 61 Z" fill={p.wing} />
        <path d="M36 53 Q42 50 48 53 M34 57.5 Q41 54.5 47 57.5" stroke={p.bars} stroke-width="2.4" stroke-linecap="round" fill="none" />
        {head(look.pose, p)}
      </g>
    </svg>
  );
}

/** Перо в своих координатах: остриё вверху в (0, 0), длина 20, смотрит вниз. */
export function FeatherShape({ color, size, x = 0, y = 0, rotate = 0, scale = 1 }: {
  color: PigeonColor | 'gold';
  size: PigeonSize;
  x?: number;
  y?: number;
  rotate?: number;
  scale?: number;
}) {
  const c = FEATHER_COLORS[color];
  const k = SIZE_SCALE[size] * scale;
  // Опахало чуть несимметричное, с бородками; сверху торчит очин.
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${k})`}>
      <path
        d="M0 2 C4.5 4 5.5 11 3.6 16 C2.6 18.6 1.2 20.4 0.2 21.5 C-2.6 19 -4.4 14 -4.2 9 C-4 5.5 -2.4 3 0 2 Z"
        fill={c.fill}
        stroke={c.vein}
        stroke-width="0.7"
      />
      <path d="M0 7 L3.6 5.6 M0 11 L4.4 9.4 M0 15 L3.4 13.8 M0 9 L-3.6 7.4 M0 13.5 L-3.8 12" stroke={c.vein} stroke-width="0.5" opacity="0.7" />
      <path d="M0 -3 L0 20.5" stroke={c.vein} stroke-width="1.1" stroke-linecap="round" />
    </g>
  );
}

/** Отдельное перо — для экрана пера и списков. Величина — как у голубя. */
export function FeatherArt({ color, size, class: className }: { color: PigeonColor | 'gold'; size: PigeonSize; class?: string }) {
  return (
    <svg class={className} viewBox="-14 -6 28 32" aria-hidden="true">
      <FeatherShape color={color} size={size} x={2} y={0} rotate={-18} scale={1.2} />
    </svg>
  );
}
