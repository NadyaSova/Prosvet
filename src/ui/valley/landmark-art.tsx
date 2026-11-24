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

// ---------- 4. Стеклянная оранжерея ----------

/** Рамы оранжереи: белые, зелёные, тёмное железо. */
const GREENHOUSE_FRAMES = ['#f3efe6', '#4f7a64', '#47525b'];
const GLASS = '#d6ecee';

/** Левое крыло оранжереи; правое — то же, отражённое. Внутри — кусты с цветами. */
function GreenhouseWing({ frame, flower }: { frame: string; flower: string }) {
  const roofY = (x: number) => -26 - (x + 50) * (10 / 33);
  const mullions = [-44.5, -39, -33.5, -28, -22.5];
  return (
    <g>
      {/* растения за стеклом */}
      <circle cx="-41" cy="-12" r="7" fill={PALETTE.leafDark} />
      <circle cx="-31" cy="-14" r="8.5" fill={PALETTE.leaf} />
      <circle cx="-22" cy="-11" r="6" fill={PALETTE.leafLight} />
      {[[-43, -16], [-33, -20], [-28, -12], [-37, -9], [-21, -14]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.4" fill={flower} />
      ))}
      {/* стекло */}
      <path d="M-50 -6 V-26 L-17 -36 V-6 Z" fill={GLASS} opacity="0.4" />
      <path d="M-46 -10 l5 -7 M-30 -13 l4 -6 M-41 -29 l6 -2" stroke="#fff" stroke-width="0.9" stroke-linecap="round" opacity="0.6" />
      {/* рамы */}
      <g stroke={frame} stroke-width="1" fill="none" stroke-linecap="round">
        <path d="M-50 -6 V-26 L-17 -36 V-6" stroke-width="1.4" />
        <path d={mullions.map((x) => `M${x} -6 V${roofY(x)}`).join(' ')} />
        <path d="M-50 -17 H-17" />
      </g>
    </g>
  );
}

function Greenhouse({ rng }: { rng: Rng }) {
  const frame = pickFrom(GREENHOUSE_FRAMES, rng);
  const flower = pickFrom([PALETTE.petalPink, PALETTE.sun, PALETTE.petalLilac], rng);
  const s = STONES[0]!;
  return (
    <g>
      <Shadow rx={52} />
      <GreenhouseWing frame={frame} flower={flower} />
      <g transform="scale(-1 1)">
        <GreenhouseWing frame={frame} flower={flower} />
      </g>

      {/* пальма в середине, за стеклом */}
      <path d="M0 -6 Q-1.5 -17 0.8 -27" stroke={PALETTE.bark} stroke-width="1.8" fill="none" />
      <g stroke={PALETTE.leaf} stroke-width="2" fill="none" stroke-linecap="round">
        <path d="M0.8 -27 q-6 -4.5 -10.5 0.8 M0.8 -27 q6 -4.5 10.5 0.8 M0.8 -27 q-3.8 -5 -6.8 -6.5 M0.8 -27 q3.8 -5 7.5 -6" />
        <path d="M0.8 -27 q-6.8 -0.8 -9 5.2 M0.8 -27 q6.8 -0.8 9 5.2" stroke={PALETTE.leafDark} />
      </g>
      <circle cx="-10" cy="-10" r="4.5" fill={PALETTE.leafDark} />
      <circle cx="11" cy="-11" r="5" fill={PALETTE.leafLight} />

      {/* средний павильон: стекло, купол, фонарик наверху */}
      <path d="M-17 -6 V-36 H17 V-6 Z" fill={GLASS} opacity="0.4" />
      <path d="M-17 -36 A17 18 0 0 1 17 -36 Z" fill={GLASS} opacity="0.45" />
      <path d="M-12 -44 A15 15 0 0 1 -4 -51" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.7" />
      <path d="M8 -14 l4 -6 M-14 -26 l3 -5" stroke="#fff" stroke-width="0.9" stroke-linecap="round" opacity="0.6" />
      <rect x="-4" y="-20" width="8" height="14" fill={GLASS} />
      <rect x="-3.5" y="-58.5" width="7" height="5" fill={GLASS} />
      <g stroke={frame} stroke-width="1" fill="none" stroke-linecap="round">
        <path d="M-17 -6 V-36 M17 -6 V-36" stroke-width="1.4" />
        <path d="M-11.3 -6 V-36 M11.3 -6 V-36 M-5.7 -20 V-36 M5.7 -20 V-36 M-17 -21 H-4 M4 -21 H17" />
        <path d="M-4 -6 V-20 H4 V-6 M0 -6 V-20" />
        <path d="M-17 -36 A17 18 0 0 1 17 -36" stroke-width="1.4" />
        <path d="M0 -54 A6 18 0 0 0 -6 -36 M0 -54 A6 18 0 0 1 6 -36 M0 -54 A12 18 0 0 0 -12 -36 M0 -54 A12 18 0 0 1 12 -36 M-14.1 -46 H14.1" />
        <path d="M-3.5 -53.5 V-58.5 H3.5 V-53.5 M0 -53.5 V-58.5" />
      </g>
      <rect x="-18.5" y="-37.5" width="37" height="2.2" fill={frame} />
      <path d="M-4.6 -58.5 Q0 -63.5 4.6 -58.5 Z" fill={frame} />
      <path d="M0 -62 V-66" stroke={frame} stroke-width="0.9" />
      <circle cx="0" cy="-66.5" r="1.1" fill={PALETTE.gold} />

      {/* каменный цоколь */}
      <rect x="-51.5" y="-6.5" width="103" height="6.5" fill={s.body} />
      <path d="M-51.5 -6.5 H51.5" stroke={s.light} stroke-width="1.2" />
      <path d="M-44 -3 h8 M-24 -3 h8 M18 -3 h8 M38 -3 h8" stroke={s.dark} stroke-width="0.7" opacity="0.4" />
      <rect x="-6" y="-1.6" width="12" height="1.6" fill={s.light} />
    </g>
  );
}

// ---------- 5. Ротонда с колоннами ----------

const ROTUNDA_DOMES = [
  { dome: '#e6dfd3', shade: '#cdc4b6' }, // мрамор
  { dome: '#8fbcae', shade: '#76a596' }, // позеленевшая медь
  { dome: '#c98a6a', shade: '#b07457' }, // черепица
];
const MARBLE = '#f1ece3';
const MARBLE_SHADE = '#d0c4b2';

function Column({ x, w, fill, shade }: { x: number; w: number; fill: string; shade?: string }) {
  return (
    <g>
      <rect x={x - w / 2} y="-51" width={w} height="40" fill={fill} />
      {shade && <rect x={x + w * 0.15} y="-51" width={w * 0.35} height="40" fill={shade} />}
      <rect x={x - w / 2 - 1.1} y="-12" width={w + 2.2} height="2" fill={fill} />
      <rect x={x - w / 2 - 1.3} y="-52.5" width={w + 2.6} height="2" fill={fill} />
    </g>
  );
}

function Rotunda({ rng }: { rng: Rng }) {
  const d = pickFrom(ROTUNDA_DOMES, rng);
  // Роза вьётся по левой или правой крайней колонне, а иногда её нет.
  const roseX = pickFrom([-22, 22, null], rng);
  const front = [-22, -8, 8, 22];
  return (
    <g>
      <Shadow rx={38} />
      {/* ступени и пол */}
      <rect x="-37" y="-4" width="74" height="4" fill={MARBLE_SHADE} />
      <rect x="-33" y="-8" width="66" height="4" fill={MARBLE} />
      <rect x="-33" y="-4.6" width="66" height="0.8" fill={MARBLE_SHADE} />
      <rect x="-30" y="-10" width="60" height="2.2" fill={MARBLE_SHADE} />

      {/* внутри: тень под куполом, задние колонны, ваза с цветами */}
      <rect x="-26" y="-52" width="52" height="8" fill="#000" opacity="0.1" />
      <Column x={-15} w={3.6} fill={MARBLE_SHADE} />
      <Column x={15} w={3.6} fill={MARBLE_SHADE} />
      <rect x="-2.6" y="-20" width="5.2" height="10" fill={MARBLE_SHADE} />
      <path d="M-4.4 -26 Q-4.4 -20 0 -20 Q4.4 -20 4.4 -26 Z" fill={MARBLE_SHADE} />
      <circle cx="-2.6" cy="-27.6" r="2" fill={PALETTE.leafDark} />
      <circle cx="2.4" cy="-28" r="2.2" fill={PALETTE.leaf} />
      <circle cx="-1.4" cy="-28.6" r="1.1" fill={PALETTE.petalPink} />
      <circle cx="2" cy="-29.2" r="1.1" fill={PALETTE.sun} />

      {/* передние колонны */}
      {front.map((x) => (
        <Column key={x} x={x} w={4.6} fill={MARBLE} shade={MARBLE_SHADE} />
      ))}

      {/* антаблемент и карниз */}
      <rect x="-30" y="-58.5" width="60" height="6.5" fill={MARBLE} />
      <path d="M-29 -54 H29" stroke={MARBLE_SHADE} stroke-width="1.3" stroke-dasharray="1.2 1.2" />
      <rect x="-32" y="-60.5" width="64" height="2.2" fill={MARBLE} />
      <path d="M-32 -58.3 H32" stroke={MARBLE_SHADE} stroke-width="0.6" />

      {/* купол */}
      <path d="M-27 -60.5 A27 16 0 0 1 27 -60.5 Z" fill={d.dome} />
      <path d="M0 -76.5 A27 16 0 0 1 27 -60.5 H13 A13 16 0 0 0 0 -76.5 Z" fill={d.shade} />
      <path d="M0 -76.5 A14 16 0 0 0 -14 -60.5" stroke={d.shade} stroke-width="0.6" fill="none" />
      <path d="M-19 -66 A22 13 0 0 1 -9 -73" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.4" />
      <path d="M0 -76.5 V-80.5" stroke={d.shade} stroke-width="1.2" />
      <circle cx="0" cy="-81.5" r="1.8" fill={PALETTE.gold} />

      {/* роза на колонне */}
      {roseX !== null && (
        <g>
          <path
            d={`M${roseX} -11 q-3 -5 0 -10 q3 -5 0 -10 q-3 -5 0 -10 q2 -4 1 -9`}
            stroke={PALETTE.leafDark}
            stroke-width="0.9"
            fill="none"
          />
          {[[-1.8, -16], [1.8, -24], [-1.6, -33], [1.4, -41], [-0.6, -47]].map(([dx, y], i) => (
            <g key={i}>
              <ellipse cx={roseX + dx! * 1.3} cy={y! + 2} rx="1.4" ry="0.9" fill={PALETTE.leaf} />
              {i % 2 === 0 && <circle cx={roseX + dx!} cy={y} r="1.4" fill={PALETTE.petalPink} />}
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

// ---------- 6. Дом на ветвях дерева-великана ----------

const TREEHOUSE_LEAVES = [
  ['#6e9b5a', '#5e8a4e', '#7faa66'],
  ['#7fae6e', '#6c9c5e', '#89b877'],
  ['#8aa65a', '#76924c', '#9cb768'], // чуть желтее, к осени
];
const TREEHOUSE_ROOFS = ['#a0573e', '#66707a', '#7d5638'];
const PLANKS = '#c9935f';

function Treehouse({ rng }: { rng: Rng }) {
  const [leaf, leafDark, leafLight] = pickFrom(TREEHOUSE_LEAVES, rng);
  const roof = pickFrom(TREEHOUSE_ROOFS, rng);
  const swing = rng() < 0.5; // качели на левой ветке или фонарь на правой
  const rungs = Array.from({ length: 8 }, (_, k) => -33 + k * 4.4);
  return (
    <g>
      <Shadow rx={40} />
      {/* крона позади дома */}
      {[[-30, -64, 20], [30, -64, 19], [0, -80, 18], [-38, -44, 12], [38, -46, 12], [-15, -84, 13], [16, -82, 14]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={leafDark} />
      ))}
      {/* ветви уходят в листву */}
      <g stroke={PALETTE.bark} fill="none" stroke-linecap="round">
        <path d="M-3 -38 Q-10 -52 -24 -62" stroke-width="4" />
        <path d="M3 -38 Q12 -50 26 -60" stroke-width="3.5" />
        {swing ? <path d="M-5 -30 Q-20 -36 -40 -42" stroke-width="3" /> : <path d="M5 -30 Q22 -36 40 -44" stroke-width="3" />}
      </g>
      {[[-24, -70, 14], [23, -72, 13], [2, -82, 11], [-36, -52, 8]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={leaf} />
      ))}
      <path d="M-14 0 C-9 -3 -7 -9 -6.5 -18 L-5.5 -39 L5.5 -39 L6.5 -18 C7 -9 9 -3 14 0 Z" fill={PALETTE.bark} />
      <path d="M-2 -6 V-20 M2.5 -12 V-30" stroke={PALETTE.barkDark} stroke-width="0.8" stroke-linecap="round" />
      <path d="M-14 0 Q-17 0.6 -19 0.2 M14 0 Q17 0.6 19 0.2" stroke={PALETTE.bark} stroke-width="1.6" stroke-linecap="round" />

      {/* настил с подпорками и перилами */}
      <path d="M-20 -37 L-6 -27 M22 -37 L6 -27" stroke={PALETTE.bark} stroke-width="1.6" />
      <rect x="-24" y="-40" width="50" height="3" fill={PALETTE.barkDark} />
      <path d="M-23 -40 V-46 M-19 -40 V-46 M-24 -46 H-15" stroke={PALETTE.barkDark} stroke-width="0.9" stroke-linecap="round" />

      {/* домик */}
      <rect x="-15" y="-58" width="28" height="18" fill={PLANKS} />
      <rect x="5" y="-58" width="8" height="18" fill="#000" opacity="0.1" />
      <path d="M-15 -53.5 H13 M-15 -49 H13 M-15 -44.5 H13" stroke="#a87545" stroke-width="0.6" />
      <circle cx="-6" cy="-50" r="3.4" fill="#ffe6a0" />
      <path d="M-6 -53.4 V-46.6 M-9.4 -50 H-2.6" stroke={PALETTE.barkDark} stroke-width="0.7" />
      <circle cx="-6" cy="-50" r="3.4" fill="none" stroke={PALETTE.barkDark} stroke-width="0.9" />
      <path d="M4 -40 V-50 A3 3 0 0 1 10 -50 V-40 Z" fill={PALETTE.barkDark} />
      <circle cx="8.6" cy="-45" r="0.6" fill={PALETTE.gold} />
      <path d="M-19 -57.5 L-1 -71 L17 -57.5 Z" fill={roof} />
      <path d="M-1 -71 L17 -57.5 H8 Z" fill="#000" opacity="0.12" />
      <path d="M-19.5 -57.3 H17.5" stroke={PALETTE.barkDark} stroke-width="1.2" stroke-linecap="round" />

      {/* листва перед домом */}
      <circle cx="30" cy="-56" r="7" fill={leafLight} />
      <circle cx="-30" cy="-46" r="5.5" fill={leafLight} />
      <circle cx="-20" cy="-76" r="6" fill={leafLight} />
      <circle cx="12" cy="-88" r="5" fill={leafLight} />

      {/* верёвочная лестница */}
      <path d="M16 -37 Q15 -18 16.5 -1 M21 -37 Q20 -18 21.5 -1" stroke="#b08a5a" stroke-width="0.7" fill="none" />
      <path d={rungs.map((y) => `M15.8 ${y} H21`).join(' ')} stroke={PALETTE.bark} stroke-width="1" />

      {swing ? (
        <g>
          <path d="M-28 -37.5 V-12 M-36 -40.5 V-12" stroke="#b08a5a" stroke-width="0.7" />
          <rect x="-38.5" y="-12.5" width="13" height="1.8" rx="0.5" fill={PALETTE.bark} />
        </g>
      ) : (
        <g>
          <path d="M34 -41.5 V-33" stroke={PALETTE.barkDark} stroke-width="0.6" />
          <circle cx="34" cy="-29.5" r="5" fill={PALETTE.glow} opacity="0.35" />
          <rect x="31.8" y="-33" width="4.4" height="6" rx="1" fill="#ffe6a0" stroke={PALETTE.barkDark} stroke-width="0.7" />
          <ellipse cx="34" cy="-30" rx="1" ry="1.6" fill={PALETTE.sun} />
        </g>
      )}
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
export const DRAWN_LANDMARKS: readonly LandmarkKind[] = ['bridge', 'windmill', 'observatory', 'greenhouse', 'rotunda', 'treehouse'];

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
      case 'greenhouse':
        return <Greenhouse rng={rng} />;
      case 'rotunda':
        return <Rotunda rng={rng} />;
      case 'treehouse':
        return <Treehouse rng={rng} />;
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
