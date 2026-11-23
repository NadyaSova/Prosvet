// Рисунок голубя и пера по виду (PigeonLook). Только отрисовка: модель голубя о ней не знает,
// рисунок можно заменить, не трогая игровую логику (SPEC.md §12.3). Стиль — плоский, как docs/reference-valley.svg.
//
// Голубь — один силуэт-«капля», как у настоящего сизого голубя: маленькая голова сразу переходит в толстую шею,
// шея расширяется в выпуклую грудь, спина почти прямой линией уходит к длинному хвосту.
// Отлив — широкая зона по всей шее, крыло лежит вдоль бока, на нём две тёмные полосы.

import type { PigeonColor, PigeonLook, PigeonSize } from '../model/types';

interface Palette {
  body: string;
  wing: string;
  bars: string;
  /** Отлив на шее: от neck к neck2 (у сизого — зелёный в сиреневый). */
  neck: string;
  neck2: string;
  /** Обводка — чтобы белый голубь не терялся на светлом фоне. */
  line: string;
  /** Клюв; по умолчанию — общий BEAK. */
  beak?: string;
}

export const PIGEON_PALETTE: Record<PigeonColor, Palette> = {
  slate: { body: '#9aa6b8', wing: '#8592a8', bars: '#56617a', neck: '#7fb3a0', neck2: '#9a8bbf', line: '#6c7890' },
  white: { body: '#fbf8f2', wing: '#efe9df', bars: '#cdc4b5', neck: '#efe3ee', neck2: '#e3eef0', line: '#c9bfae' },
  // Клюв темнее общего: светлый терялся на розовом, особенно когда голубь чистит перо.
  rose: { body: '#dcb7b6', wing: '#cda6a8', bars: '#9b7176', neck: '#ead0d3', neck2: '#d9c3e0', line: '#ad8589', beak: '#8f5d57' },
  lilac: { body: '#bcaad2', wing: '#a997c4', bars: '#76659b', neck: '#d6c9e8', neck2: '#c4dcd6', line: '#8b79ab' },
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
/** Дальняя лапка чуть темнее — видно, что лапок две. */
const LEGS_FAR = '#bf6358';
const CLAWS = '#7a4a42';

/**
 * Лапка как у настоящего голубя: короткая цевка с чешуйками выходит из-под перьев живота,
 * два пальца вперёд веером, один назад, на кончиках — коготки. x — где лапка выходит из-под живота.
 */
function Leg({ x, color }: { x: number; color: string }) {
  const toes: [number, number][] = [
    [x + 8, 83.6],
    [x + 5.6, 84.4],
    [x - 4, 83.6],
  ];
  return (
    <g>
      <path d={`M${x - 1.4} 69 L${x + 1.4} 69 L${x + 1.9} 81 L${x + 0.1} 81.6 Z`} fill={color} />
      <path d={`M${x - 0.6} 74 h2.4 M${x - 0.3} 77.5 h2.4`} stroke={CLAWS} stroke-width="0.45" opacity="0.5" />
      <path
        d={`M${x + 1} 81.3 Q${x + 4.5} 81.9 ${toes[0]![0]} ${toes[0]![1]} M${x + 1} 81.5 Q${x + 3.4} 83 ${toes[1]![0]} ${toes[1]![1]} M${x + 0.6} 81.5 Q${x - 1.8} 82.3 ${toes[2]![0]} ${toes[2]![1]}`}
        stroke={color}
        stroke-width="1.6"
        stroke-linecap="round"
        fill="none"
      />
      {toes.map(([tx, ty]) => (
        <circle key={`${tx}`} cx={tx + (tx > x ? 0.3 : -0.3)} cy={ty + 0.1} r="0.6" fill={CLAWS} />
      ))}
    </g>
  );
}

/** Поза — это всё тело, а не только голова: свой силуэт, крыло, хвост и постановка лапок. */
interface PoseShape {
  /** Весь силуэт одной линией: голова, шея, грудь, живот, хвост, спина. */
  outline: string;
  /** Отлив на шее — широкая зона от головы до груди. */
  sheen: string;
  /** Сложенное крыло вдоль бока, тёмные полосы на нём и тёмный край хвоста. */
  wing: string;
  wingBars: string;
  tailTip: string;
  /**
   * Шея, перекрученная назад, с головой на конце — отдельная дуга поверх тела и крыла.
   * fill — открытый контур заливки: от груди по внутреннему краю дуги к голове и обратно по внешнему краю.
   * line — обводка: тот же контур, но складка начинается выше, у плеча её нет.
   * Отлив на шее идёт вдоль дуги. Если задана, обычный sheen не рисуется.
   */
  twistedNeck?: { fill: string; line: string };
  /** Где лапки выходят из-под живота: дальняя и ближняя. */
  legs: [number, number];
  beak: string;
  cere: [number, number];
  eye: [number, number];
}

/** Голова и внешний край перекрученной шеи — общая часть заливки и обводки. */
const PREEN_NECK_REST =
  'C62.5 45 58 47.5 53 49.2 C49 49.6 47 45 47.5 40.5 C48 35 52 32 56.5 31.5 ' +
  'C63 29 70 28.5 75 31 C81 34 84.5 41 84 49 C83.8 53 83 56.5 82 60';

const POSES: Record<PigeonLook['pose'], PoseShape> = {
  // Сидит: спокойно стоит, тело почти горизонтально, хвост чуть вниз.
  sit: {
    outline:
      'M63 31 C63 23 76 22 78 30 C79 34 78 37 79 41 C82 46 83 52 82 57 ' +
      'C81 63 77 67 71 70 C64 72.5 54 73 45 71.5 L15 72 L11 66 C22 59 37 50 52 47 C58 45 63 40 63 31 Z',
    sheen: 'M63.5 35 C66 39 71 41 79 41 C82 45 83 50 82 54 C73 53 63 49 57 45 C60 42 62.5 39 63.5 35 Z',
    wing: 'M54 49 C64 49 69 56 65 64 C57 69 38 69 18 65 C29 57 42 51 54 49 Z',
    wingBars: 'M42 60.5 C48 59 54 60.8 58.4 63.6 M35 63.8 C41.6 62.8 47.6 64.4 52 66.6',
    tailTip: 'M11 66 L15 72 L20.4 71.6 L16.4 64.8 Z',
    legs: [52, 60],
    beak: 'M77.6 28.6 L83.4 30.6 L77.6 32.4 Z',
    cere: [78.2, 29.2],
    eye: [72.6, 28.6],
  },
  // Оглядывается назад через плечо: настороженная, более прямая стойка — грудь выше, хвост круче вниз.
  look: {
    outline:
      'M61 28 C61 20 74 19 76 27 C77 31 76 34 77 38 C81 44 82 51 80 57 ' +
      'C78 64 74 69 67 71 C60 73 52 73 45 71 L17 78 L13 73 C24 62 38 50 50 44 C56 41 61 36 61 28 Z',
    sheen: 'M61.5 32 C64 36 69 38 77 38 C80 42 81.5 47 81 51 C72 50 62 46 55 42 C58 39 60.5 36 61.5 32 Z',
    wing: 'M52 46 C62 46 68 54 64 62 C56 68 38 69 19 72 C29 61 40 50 52 46 Z',
    wingBars: 'M41 59 C47 57.5 53 59 57.4 62 M34 63.5 C40.6 62.5 46.6 64 51 66.5',
    tailTip: 'M13 73 L17 78 L22.2 77 L18.6 71 Z',
    legs: [54, 62],
    beak: 'M62 25.6 L56.2 27.6 L62 29.4 Z',
    cere: [61.4, 26.2],
    eye: [66.6, 25.6],
  },
  // Чистит перо (как на фото): тело того же размера, что в других позах, но без шеи.
  // Шея — отдельная дуга поверх тела: от груди вверх и назад, голова — её конец, лежит на спине,
  // клюв зарылся в перья у крыла. Внутренний край дуги обведён — по нему виден изгиб.
  // Шея перекручена, поэтому отлив идёт вдоль дуги, а не сверху вниз: у груди сиреневый, выше зелёный,
  // у головы плавно переходит в серый (см. twistedNeck в PigeonArt).
  preen: {
    outline:
      'M11 68 C19 63 30 54 44 49 C52 46 60 43 68 43 C76 43 83 51 82 60 ' +
      'C81 65 77 69 71 71.5 C64 74 54 74.5 45 73 L15 74 Z',
    sheen: '',
    // Шея толстая: основание во всю грудь, от плеча до груди. Прилегает к спине — под дугой нет просвета,
    // изгиб виден складкой. Складка одной плавной линией уходит прямо к клюву, без выемки под головой,
    // чтобы голова переходила в шею без шва. Обводка складки начинается выше плеча — так она короче.
    twistedNeck: {
      fill: `M66.5 58 C68 53 68 49 65.5 47 ${PREEN_NECK_REST}`,
      line: `M67.36 50.3 C67.1 48.92 66.5 47.8 65.5 47 ${PREEN_NECK_REST}`,
    },
    wing: 'M50 50 C62 48 70 54 67 63 C59 69 40 69 18 66.5 C28 59 39 52 50 50 Z',
    wingBars: 'M42 60 C48 58.6 54 60.4 58.4 63.2 M35 63.6 C41.6 62.6 47.6 64.2 52 66.4',
    tailTip: 'M11 68 L15 74 L20.4 73.6 L16.4 66.8 Z',
    legs: [52, 60],
    beak: 'M50 45 L43.6 51.6 L52.4 47.6 Z',
    cere: [49.9, 45.6],
    eye: [52.4, 39.2],
  },
};

export function PigeonArt({ look, class: className }: { look: PigeonLook; class?: string }) {
  const p = PIGEON_PALETTE[look.color];
  const s = SIZE_SCALE[look.size];
  const pose = POSES[look.pose];
  const [ex, ey] = pose.eye;
  // Одинаковые градиенты на странице повторяются с одним id — это безопасно: содержимое у них одно.
  const sheenId = `pigeon-sheen-${look.color}`;
  const twistId = `pigeon-twist-${look.color}`;
  return (
    <svg class={className} viewBox="0 0 100 90" aria-hidden="true">
      <defs>
        <linearGradient id={sheenId} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stop-color={p.neck} />
          <stop offset="1" stop-color={p.neck2} />
        </linearGradient>
        {/* Отлив вдоль перекрученной шеи: голова серая, у головы зелёный, у груди сиреневый. */}
        <linearGradient id={twistId} gradientUnits="userSpaceOnUse" x1="48" y1="38" x2="84" y2="54">
          <stop offset="0" stop-color={p.body} />
          <stop offset="0.3" stop-color={p.body} />
          <stop offset="0.45" stop-color={p.neck} />
          <stop offset="1" stop-color={p.neck2} />
        </linearGradient>
      </defs>
      <g transform={`translate(${FEET.x} ${FEET.y}) scale(${s}) translate(${-FEET.x} ${-FEET.y})`}>
        {/* лапки под телом: дальняя, потом ближняя */}
        <Leg x={pose.legs[0]} color={LEGS_FAR} />
        <Leg x={pose.legs[1]} color={LEGS} />
        {/* силуэт целиком: голова, шея, грудь, живот, хвост, спина */}
        <path d={pose.outline} fill={p.body} stroke={p.line} stroke-width="1" stroke-linejoin="round" />
        <path d={pose.tailTip} fill={p.bars} />
        {!pose.twistedNeck && <path d={pose.sheen} fill={`url(#${sheenId})`} opacity="0.9" />}
        <path d={pose.wing} fill={p.wing} />
        <path d={pose.wingBars} stroke={p.bars} stroke-width="2.6" stroke-linecap="round" fill="none" />
        {pose.twistedNeck && (
          <>
            {/* Подложка цвета тела, чтобы полупрозрачный отлив не просвечивал крылом. */}
            {/* Нижний край заливки скруглён по груди, чтобы отлив не обрывался прямой линией. */}
            <path d={`${pose.twistedNeck.fill} C78 63 71 62 66.5 58 Z`} fill={p.body} />
            <path d={`${pose.twistedNeck.fill} C78 63 71 62 66.5 58 Z`} fill={`url(#${twistId})`} opacity="0.9" />
            <path d={pose.twistedNeck.line} fill="none" stroke={p.line} stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
          </>
        )}
        <path d={pose.beak} fill={p.beak ?? BEAK} />
        <ellipse cx={pose.cere[0]} cy={pose.cere[1]} rx="1.5" ry="1" fill="#fff" />
        {/* крупный тёмный глаз с бликом и тонким оранжевым кольцом */}
        <circle cx={ex} cy={ey} r="2.8" fill="#e9925a" />
        <circle cx={ex} cy={ey} r="2.1" fill={EYE} />
        <circle cx={ex + 0.75} cy={ey - 0.75} r="0.75" fill="#fff" />
      </g>
    </svg>
  );
}

/**
 * Свёрнутое послание с бантом — висит над выбранным голубем на жёрдочке: этот голубь понесёт отклик.
 * Свиток лежит на боку: левый торец спрятан за свитком, правый виден с завитком.
 */
export function MessageScrollArt({ class: className }: { class?: string }) {
  const paper = '#f6e7c4';
  const shade = '#e7d1a2';
  const line = '#a8875a';
  const ribbon = '#c8584b';
  const ribbonDark = '#9e3f35';
  return (
    <svg class={className} viewBox="0 0 40 26" aria-hidden="true">
      <ellipse cx="6.5" cy="12" rx="3.2" ry="6.4" fill={shade} stroke={line} stroke-width="1" />
      <path d="M6.5 5.6 H33.5 V18.4 H6.5 Z" fill={paper} />
      <path d="M6.5 15.4 H33.5 V18.4 H6.5 Z" fill={shade} />
      <path d="M6.5 5.6 H33.5 M6.5 18.4 H33.5" stroke={line} stroke-width="1" />
      <ellipse cx="33.5" cy="12" rx="3.2" ry="6.4" fill={paper} stroke={line} stroke-width="1" />
      <path d="M33.5 9 C35 9 35.3 11 34.4 12.4 C33.6 13.6 32.4 13 32.5 11.8" stroke={line} stroke-width="0.8" fill="none" stroke-linecap="round" />
      {/* лента вокруг свитка и бант */}
      <path d="M18.6 5.1 H21.4 V18.9 H18.6 Z" fill={ribbon} />
      <path d="M20 13 L17.2 22.8 M20 13 L23 22.4" stroke={ribbon} stroke-width="1.8" stroke-linecap="round" />
      <ellipse cx="16.4" cy="10.6" rx="3.4" ry="2" transform="rotate(-24 16.4 10.6)" fill={ribbon} stroke={ribbonDark} stroke-width="0.7" />
      <ellipse cx="23.6" cy="10.6" rx="3.4" ry="2" transform="rotate(24 23.6 10.6)" fill={ribbon} stroke={ribbonDark} stroke-width="0.7" />
      <circle cx="20" cy="12" r="1.7" fill={ribbonDark} />
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
