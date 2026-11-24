// Сооружения конечных боссов (docs/phase2-plan.md §5.2). Плоский стиль эскиза docs/reference-valley.svg.
// Рисуется только само сооружение, без тумана: туман, силуэт и анимацию победы делает долина (шаг 7 фазы 2).
//
// Координаты: начало — на земле под серединой сооружения, рисунок растёт вверх (отрицательный y).
// Каждое сооружение нарисовано в рамке 120 × 100 (x от −60 до 60, y от −100 до 0) и умножено на size / 100:
// size — высота рамки в единицах долины. Высокие сооружения (мельница) занимают рамку по высоте,
// низкие и широкие (мост) — по ширине. Сид даёт разброс: оттенок камня, цвет крыши, наклон крыльев мельницы.

import { createRng, pickFrom, type Rng } from '../../logic/rng';
import type { LandmarkKind } from '../../model/types';
import { PALETTE } from '../palette';

/** Рамка рисунка в его собственных единицах: size — её высота в единицах долины. */
export const LANDMARK_BOX = { width: 120, height: 100 } as const;

export const LANDMARK_NAMES: Record<LandmarkKind, string> = {
  bridge: 'Каменный мост',
  windmill: 'Ветряная мельница',
  observatory: 'Обсерватория',
  greenhouse: 'Оранжерея',
  rotunda: 'Ротонда',
  treehouse: 'Дом на дереве',
  aqueduct: 'Акведук',
  pagoda: 'Пагода',
  stones: 'Каменный круг',
  waterfall: 'Водопад с радугой',
  balloon: 'Причал с воздушным шаром',
};

/** Камень: основной цвет, светлый (кладка арки, парапет) и тёмный (тени, проёмы). */
const STONES = [
  { body: '#b3a898', light: '#cbc1b3', dark: '#8a7f73' }, // тёплый серый
  { body: '#aca9a3', light: '#c7c4bd', dark: '#85827c' }, // холодный серый
  { body: '#bca78d', light: '#d3c2a8', dark: '#94806a' }, // песчаник
];

const LEAVES = [PALETTE.leaf, PALETTE.leafDark, PALETTE.leafLight];

/** Тень сооружения на траве. */
function Shadow({ rx }: { rx: number }) {
  return <ellipse cx="0" cy="0.5" rx={rx} ry={rx * 0.09} fill={PALETTE.shadowGreen} opacity="0.22" />;
}

// ---------- 1. Каменный арочный мост через реку ----------

/** Точка на верхнем крае парапета: t от 0 (левый край) до 1 (правый). */
function parapetAt(t: number): [number, number] {
  const x = -55 + 110 * t;
  const y = (1 - t) ** 2 * -16.5 + 2 * t * (1 - t) * -67.5 + t ** 2 * -16.5;
  return [x, y];
}

function Bridge({ rng }: { rng: Rng }) {
  const s = pickFrom(STONES, rng);
  // Плющ: два-три пучка на парапете, по сиду.
  const ivy = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => {
    const t = 0.12 + rng() * 0.76;
    const [x, y] = parapetAt(t);
    const hang = 4 + rng() * 7;
    return { x, y, hang, leaves: Array.from({ length: 5 }, () => [x + (rng() - 0.5) * 6, y + rng() * hang, 1.3 + rng() * 1.1] as const) };
  });
  return (
    <g>
      {/* река под мостом */}
      <path d="M-48 -10 L48 -10 L56 0 L-56 0 Z" fill={PALETTE.river} />
      {/* отражение арки */}
      <path d="M-24.5 -10 A24.5 8 0 0 0 24.5 -10" stroke={s.light} stroke-width="3.5" fill="none" opacity="0.5" />
      <path d="M-34 -4.5 h9 M-7 -2.5 h13 M20 -6 h8 M-47 -1.5 h8 M36 -2 h9" stroke="#e3f1f6" stroke-width="0.9" stroke-linecap="round" />

      {/* тело моста с аркой */}
      <path
        d="M-57 -4 L-55 -15 Q0 -66 55 -15 L57 -4 L40 -4 L36 -10 L22 -10 A22 22 0 0 0 -22 -10 L-36 -10 L-40 -4 Z"
        fill={s.body}
      />
      {/* кладка: ряды камней */}
      <path
        d="M-46 -14 h8 M-30 -24 h9 M24 -24 h8 M36 -15 h9 M-50 -8 h6 M43 -8 h7 M-14 -36 h6 M8 -36 h6"
        stroke={s.dark}
        stroke-width="0.7"
        opacity="0.35"
      />
      {/* проёмы над опорами */}
      <circle cx="-37" cy="-19" r="3.2" fill={s.dark} />
      <circle cx="37" cy="-19" r="3.2" fill={s.dark} />
      {/* свод: тень внутри и камни арки */}
      <path d="M-21 -10 A21 21 0 0 1 21 -10" stroke={s.dark} stroke-width="1.8" fill="none" opacity="0.55" />
      <path d="M-24.5 -10 A24.5 24.5 0 0 1 24.5 -10" stroke={s.light} stroke-width="5" fill="none" stroke-dasharray="6.2 0.8" />
      <rect x="-3.2" y="-38" width="6.4" height="6.5" rx="0.6" fill={s.light} />
      {/* парапет */}
      <path d="M-55 -16.5 Q0 -67.5 55 -16.5" stroke={s.light} stroke-width="3.4" fill="none" stroke-linecap="round" />

      {/* плющ */}
      {ivy.map((p, i) => (
        <g key={i}>
          <path d={`M${p.x} ${p.y} q1 ${p.hang * 0.5} -0.5 ${p.hang}`} stroke={PALETTE.leafDark} stroke-width="0.6" fill="none" />
          {p.leaves.map(([x, y, r], j) => (
            <circle key={j} cx={x} cy={y} r={r} fill={LEAVES[j % 3]} />
          ))}
        </g>
      ))}

      {/* берега: трава прикрывает концы моста */}
      <path d="M-61 0 L-61 -6.5 Q-52 -8 -46 -4.5 Q-42.5 -1.5 -39 0 Z" fill={PALETTE.hillNear} />
      <path d="M61 0 L61 -6.5 Q52 -8 46 -4.5 Q42.5 -1.5 39 0 Z" fill={PALETTE.hillNear} />
      <path d="M-56 -6.5 l-1 -2.6 M-54.5 -6.8 l0.4 -2.8 M53 -7 l1 -2.6 M55 -6.8 l-0.3 -2.8" stroke={PALETTE.hillNear} stroke-width="0.9" stroke-linecap="round" />
    </g>
  );
}

// ---------- 2. Ветряная мельница ----------

const MILL_WALLS = [
  { wall: '#eee6d9', shade: '#dbd0bf' }, // белёная
  { wall: '#d8c7ad', shade: '#c4b194' }, // камень
  { wall: '#d6a88b', shade: '#c39275' }, // терракотовая штукатурка
];
const MILL_CAPS = ['#7d5638', '#66707a', '#8f4f3c'];

/** Оборот крыльев мельницы, секунд. */
const MILL_TURN_SECONDS = 20;

/** Крылья вращаются, если в настройках телефона не включено «уменьшить движение». Анимация SVG, а не CSS: её не выключить правилом в styles.css. */
function turns(): boolean {
  return typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Одно крыло мельницы: торчит вверх от оси, полотно с решёткой — справа от махового бруса. */
function Sail({ angle, cloth }: { angle: number; cloth: string }) {
  const rungs = Array.from({ length: 9 }, (_, k) => -35 + k * 3.375);
  return (
    <g transform={`rotate(${angle})`}>
      <rect x="0.6" y="-35" width="7" height="27" fill={cloth} opacity="0.92" />
      <path
        d={`${rungs.map((y) => `M0.6 ${y} H7.6`).join(' ')} M4.1 -35 V-8 M7.6 -35 V-8`}
        stroke={PALETTE.bark}
        stroke-width="0.5"
      />
      <path d="M0 -2 V-36" stroke={PALETTE.barkDark} stroke-width="1.5" stroke-linecap="round" />
    </g>
  );
}

function Windmill({ rng }: { rng: Rng }) {
  const w = pickFrom(MILL_WALLS, rng);
  const cap = pickFrom(MILL_CAPS, rng);
  const tilt = 45 + (rng() - 0.5) * 36;
  const cloth = pickFrom(['#f6efe2', PALETTE.canvas, '#efe0cf'], rng);
  const balusters = Array.from({ length: 14 }, (_, k) => -19.5 + k * 3);
  return (
    <g>
      <Shadow rx={24} />
      {/* башня: светлая и теневая стороны */}
      <path d="M-17 0 L-11 -62 L11 -62 L17 0 Z" fill={w.wall} />
      <path d="M4 0 L3 -62 L11 -62 L17 0 Z" fill={w.shade} />
      {/* дверь и окна */}
      <path d="M-4.5 0 V-8 A4.5 4.5 0 0 1 4.5 -8 V0 Z" fill={PALETTE.bark} />
      <path d="M-1.5 0 V-9" stroke={PALETTE.barkDark} stroke-width="0.6" />
      <path d="M-9 -18 V-22 A1.8 1.8 0 0 1 -5.4 -22 V-18 Z" fill="#5b5149" />
      <path d="M0.8 -44 V-48.5 A1.7 1.7 0 0 1 4.2 -48.5 V-44 Z" fill="#5b5149" />
      {/* галерея вокруг башни */}
      <path d="M-20 -29 L-14.6 -22 M20 -29 L14.6 -22" stroke={PALETTE.bark} stroke-width="1" />
      <path d={balusters.map((x) => `M${x} -30 V-35.5`).join(' ')} stroke={PALETTE.bark} stroke-width="0.6" />
      <rect x="-21.5" y="-31" width="43" height="2" fill={PALETTE.bark} />
      <path d="M-21 -35.8 H21" stroke={PALETTE.bark} stroke-width="0.9" stroke-linecap="round" />
      {/* шатёр */}
      <path d="M-13 -60.5 C-13 -70 -6 -77 0 -78 C6 -77 13 -70 13 -60.5 Z" fill={cap} />
      <path d="M2 -77.6 C7 -75 12 -69 12.4 -61 L13 -60.5 L5 -60.5 C5 -68 4 -74 2 -77.6 Z" fill="#000" opacity="0.12" />
      <rect x="-14" y="-62" width="28" height="2.2" rx="0.6" fill={PALETTE.barkDark} />
      <path d="M0 -78 V-82" stroke={PALETTE.barkDark} stroke-width="0.9" stroke-linecap="round" />
      {/* крылья: медленно вращаются против часовой стрелки, полотно — позади махового бруса */}
      <g transform="translate(0 -66)">
        <g transform={`rotate(${tilt})`}>
          {[0, 90, 180, 270].map((a) => (
            <Sail key={a} angle={a} cloth={cloth} />
          ))}
          {turns() && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`${tilt} 0 0`}
              to={`${tilt - 360} 0 0`}
              dur={`${MILL_TURN_SECONDS}s`}
              repeatCount="indefinite"
            />
          )}
        </g>
        <circle r="2.6" fill={PALETTE.barkDark} />
        <circle r="1" fill={PALETTE.bark} />
      </g>
    </g>
  );
}

// ---------- 3. Обсерватория с куполом ----------

const DOMES = [
  { dome: '#8fbcae', shade: '#76a596' }, // позеленевшая медь
  { dome: '#b4bfcc', shade: '#97a4b4' }, // серебристый
  { dome: '#c99366', shade: '#ad7a51' }, // медь
];

function Observatory({ rng }: { rng: Rng }) {
  const s = pickFrom(STONES, rng);
  const d = pickFrom(DOMES, rng);
  const plaster = '#e9e1d3';
  const plasterShade = '#d6ccbb';
  const sky = '#3d4862';
  // Телескоп смотрит вправо или влево, под разным углом.
  const side = rng() < 0.5 ? 1 : -1;
  const tilt = side * (25 + rng() * 15);
  return (
    <g>
      <Shadow rx={34} />
      {/* нижний зал */}
      <rect x="-30" y="-22" width="60" height="22" fill={s.body} />
      <rect x="12" y="-22" width="18" height="22" fill={s.dark} opacity="0.25" />
      <path d="M-26 -8 h8 M-12 -15 h7 M18 -6 h7 M6 -18 h6" stroke={s.dark} stroke-width="0.7" opacity="0.4" />
      {/* дверь со ступенями, окна */}
      <path d="M-4.5 -1.5 V-11 A4.5 4.5 0 0 1 4.5 -11 V-1.5 Z" fill={PALETTE.bark} />
      <rect x="-7" y="-1.6" width="14" height="1.6" fill={s.light} />
      {[-21, -13, 13, 21].map((x) => (
        <path key={x} d={`M${x - 2.4} -7 V-13 A2.4 2.4 0 0 1 ${x + 2.4} -13 V-7 Z`} fill={sky} />
      ))}
      <rect x="-32" y="-24.5" width="64" height="3" fill={s.light} />
      {/* барабан под куполом */}
      <rect x="-21" y="-46" width="42" height="21.5" fill={plaster} />
      <rect x="8" y="-46" width="13" height="21.5" fill={plasterShade} />
      <circle cx="-10" cy="-35" r="2.8" fill={sky} />
      <circle cx="-10" cy="-35" r="2.8" fill="none" stroke={s.light} stroke-width="0.8" />
      <path d="M3 -30 V-38 A1.6 1.6 0 0 1 6.2 -38 V-30 Z" fill={sky} />
      <rect x="-23" y="-48.5" width="46" height="2.8" fill={s.light} />
      {/* открытая щель, телескоп за ней; две половины купола закрывают телескоп по бокам от щели */}
      <path d="M-3.2 -48.5 V-70.5 H3.2 V-48.5 Z" fill={sky} />
      <g transform={`translate(0 -54) rotate(${tilt})`}>
        <rect x="-1.9" y="-27" width="3.8" height="27" rx="0.6" fill="#c8a052" />
        <rect x="-2.5" y="-27" width="5" height="2.2" rx="0.5" fill="#8f6c2c" />
        <rect x="-2.2" y="-12" width="4.4" height="1.6" fill="#8f6c2c" />
      </g>
      <path d="M-22 -48.5 A22 22 0 0 1 -3 -70.3 V-48.5 Z" fill={d.dome} />
      <path d="M3 -70.3 A22 22 0 0 1 22 -48.5 H3 Z" fill={d.dome} />
      <path d="M3 -70.3 A22 22 0 0 1 22 -48.5 H11 Q10 -62 3 -70.3 Z" fill={d.shade} />
      <path d="M-4.5 -69.8 Q-11 -63 -12 -48.5" stroke={d.shade} stroke-width="0.6" fill="none" />
      <path d="M-15 -61 A20 20 0 0 1 -7 -67.5" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.35" />
      {/* шпиль со звездой */}
      <path d="M0 -70.5 V-77" stroke={PALETTE.barkDark} stroke-width="0.8" />
      <path
        d="M0 -82 L1.1 -79.3 L4 -79.1 L1.8 -77.3 L2.5 -74.5 L0 -76 L-2.5 -74.5 L-1.8 -77.3 L-4 -79.1 L-1.1 -79.3 Z"
        fill={PALETTE.gold}
      />
    </g>
  );
}

// ---------- Заглушка для ещё не нарисованных ----------

/** Пирамидка камней — пока рисунка сооружения нет. */
function Cairn() {
  const s = STONES[1]!;
  return (
    <g>
      <Shadow rx={14} />
      <ellipse cx="0" cy="-5" rx="13" ry="5.5" fill={s.body} />
      <ellipse cx="1" cy="-14" rx="9.5" ry="4.5" fill={s.light} />
      <ellipse cx="-0.5" cy="-21.5" rx="6.5" ry="3.5" fill={s.body} />
      <ellipse cx="0.5" cy="-27" rx="3.8" ry="2.5" fill={s.light} />
    </g>
  );
}

/** Сооружения, у которых уже есть рисунок. Остальные пока рисуются пирамидкой камней. */
export const DRAWN_LANDMARKS: readonly LandmarkKind[] = ['bridge', 'windmill', 'observatory'];

export function LandmarkArt({ kind, seed, size }: { kind: LandmarkKind; seed: number; size: number }) {
  const rng = createRng(seed);
  const k = size / LANDMARK_BOX.height;
  const art = (() => {
    switch (kind) {
      case 'bridge':
        return <Bridge rng={rng} />;
      case 'windmill':
        return <Windmill rng={rng} />;
      case 'observatory':
        return <Observatory rng={rng} />;
      default:
        return <Cairn />;
    }
  })();
  return (
    <g transform={`scale(${k})`} role="img" aria-label={LANDMARK_NAMES[kind]}>
      {art}
    </g>
  );
}
