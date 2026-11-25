// Долина — панорама на 2,5 экрана, листается вбок. Крупно, с увеличением — ValleyScreen. Рисует только то, что дала модель (sceneOf):
// рельеф и места — из logic/valley-district.ts, растения и редкости — из состояния долины.
// Графику можно заменить (например, спрайтами), не трогая игровую логику. SPEC.md §12.3.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Feather } from '../../logic/pigeons';
import { createRng } from '../../logic/rng';
import type { FireLevel } from '../../logic/streak';
import {
  districtCapacity,
  landmarkSite,
  latestPlant,
  mistFrontier,
  sceneOf,
  type SceneLandmark,
  type ScenePlant,
} from '../../logic/valley';
import {
  BANDS,
  CAMP,
  depthScale,
  hillTop,
  RIVER,
  riverWidth,
  riverX,
  SLOTS,
  VIEW_WIDTH,
  WORLD,
  type Band,
} from '../../logic/valley-district';
import type { Boss, ValleyState } from '../../model/types';
import { plural } from '../format';
import { CampArt } from './camp-art';
import { CampfireArt } from './campfire-art';
import { DecorArt } from './decor-art';
import { LandmarkMistGradient, ValleyLandmarkArt } from './landmark-scene';
import { PlantArt, sways } from './plant-art';
import { WandererArt } from './wanderer-art';
import { PALETTE } from '../palette';

const { width: W, height: H } = WORLD;
/** Верх неба обрезан: в кадре от этой высоты. Пропорции кадра — в .valley (styles.css). */
const VIEW_TOP = 24;

const HILL_COLORS: Record<Band, string> = {
  far: 'var(--color-hill-far)',
  mid: 'var(--color-hill-mid)',
  near: '#74a270',
  front: 'var(--color-hill-near)',
};

function hillPath(band: Band): string {
  let d = `M0 ${H} L0 ${hillTop(band, 0).toFixed(1)}`;
  for (let x = 16; x <= W; x += 16) d += ` L${x} ${hillTop(band, x).toFixed(1)}`;
  return `${d} L${W} ${H} Z`;
}

function riverPath(): string {
  const start = hillTop('far', riverX(RIVER.fromY)) + 3;
  const left: string[] = [];
  const right: string[] = [];
  for (let y = start; y <= H + 4; y += 4) {
    const x = riverX(y);
    const half = riverWidth(y) / 2;
    left.push(`${(x - half).toFixed(1)} ${y.toFixed(1)}`);
    right.unshift(`${(x + half).toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M${riverX(start).toFixed(1)} ${(start - 1).toFixed(1)} L${left.join(' L')} L${right.join(' L')} Z`;
}

/** Засохшие деревья в тумане — постоянные места по всей панораме. */
const DEAD_TREES = (() => {
  const rng = createRng(31);
  const list: { x: number; y: number; h: number }[] = [];
  for (let x = 320; x < W - 6; x += 44 + rng() * 14) {
    const band = BANDS[1 + Math.floor(rng() * 3)]!;
    list.push({ x, y: hillTop(band, x) + 6 + rng() * 10, h: 14 + rng() * 14 });
  }
  return list;
})();

/** Облачка тумана вдоль его края и сверху. Координаты — от границы тумана. */
const MIST_PUFFS = Array.from({ length: 18 }, (_, i) => ({
  cx: i * 62 + (i % 3) * 9 + 20,
  cy: 104 + (i % 4) * 5,
  rx: 46 + (i % 2) * 10,
  ry: 17 + (i % 3) * 3,
}));

const STATIC_LAYERS = {
  hills: BANDS.map((b) => ({ band: b, d: hillPath(b) })),
  river: riverPath(),
};

export interface SceneProps {
  valley: ValleyState;
  /** Боссы — для сооружений в долине: вид, сид, туман. */
  bosses?: readonly Boss[];
  fire: FireLevel;
  feathers: readonly Feather[];
  cloakStage: number;
  /** Только что посаженное растение или редкость — для анимации роста. */
  fresh: string | null;
}

const NO_BOSSES: readonly Boss[] = [];

/** Растение или сооружение — для рисования по глубине. */
interface DepthItem {
  y: number;
  plant?: ScenePlant;
  landmark?: SceneLandmark;
}

/** Высота кадра в единицах мира (верх неба обрезан). */
export const SCENE_HEIGHT = H - VIEW_TOP;

/**
 * Куда смотреть в панораме: на только что выросшее, иначе на последнее растение, иначе на лагерь.
 * Координаты мира; y — от верха кадра (обрезанное небо уже вычтено), у растения — его основание.
 */
export function focusOf(valley: ValleyState, fresh: string | null): { x: number; y: number } {
  const scene = sceneOf(valley);
  const latest = latestPlant(valley);
  const p =
    (fresh
      ? (scene.plants.find((q) => q.id === fresh) ?? scene.decor.find((d) => d.id === fresh) ?? landmarkSite(valley, fresh))
      : undefined) ?? (latest ? SLOTS[latest.slot]! : { x: 0, y: CAMP.y });
  return { x: p.x, y: p.y - VIEW_TOP };
}

/** Панорама в карточке главного экрана: видно VIEW_WIDTH единиц, остальное листается вбок. */
export function ValleyView(props: SceneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Панорама открывается там, где выросло последнее.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const k = el.clientWidth / VIEW_WIDTH;
    el.scrollLeft = Math.max(0, focusOf(props.valley, props.fresh).x * k - el.clientWidth / 2);
  }, [props.fresh]);

  return (
    <div class="valley" ref={scrollRef}>
      <ValleyScene {...props} />
    </div>
  );
}

/** Сама картина долины. Размер задаёт обёртка (style или CSS класса valley__scene). */
export function ValleyScene({
  valley,
  bosses = NO_BOSSES,
  fire,
  feathers,
  cloakStage,
  fresh,
  style,
  pick,
}: SceneProps & {
  style?: Record<string, string>;
  /** Выбор места для семени или саженца: свободные места кружками, нажатие — посадить сюда. */
  pick?: { slots: readonly number[]; onPick: (slot: number) => void };
}) {
  const scene = useMemo(() => sceneOf(valley, bosses), [valley, bosses]);

  // Туман отходит медленно: сначала там, где был до нового растения или нового сооружения босса, потом на новом месте.
  const before = useMemo(() => {
    if (!fresh) return scene.mistX;
    const newLandmark = scene.landmarks.some((l) => l.bossId === fresh && !l.won && l.sessions === 0);
    return mistFrontier({
      ...valley,
      plants: valley.plants.filter((p) => p.id !== fresh),
      landmarks: newLandmark ? valley.landmarks.filter((l) => l.bossId !== fresh) : valley.landmarks,
    });
  }, [valley, fresh, scene]);

  // Растения и сооружения — вперемешку по глубине: дальние раньше ближних.
  const objects = useMemo(
    () =>
      [
        ...scene.plants.map((p): DepthItem => ({ y: p.y, plant: p })),
        ...scene.landmarks.map((l): DepthItem => ({ y: l.y, landmark: l })),
      ].sort((a, b) => a.y - b.y),
    [scene],
  );
  const [mistX, setMistX] = useState(before);
  useEffect(() => {
    if (mistX === scene.mistX) return;
    const id = setTimeout(() => setMistX(scene.mistX), 600);
    return () => clearTimeout(id);
  }, [mistX, scene.mistX]);

  const n = scene.plants.length;
  const plants = `${n} ${plural(n, ['растение', 'растения', 'растений'])}`;
  const label = scene.open
    ? `Долина открыта: ${plants}, тумана больше нет`
    : `Долина: ${plants} из ${districtCapacity(valley)}, остальное пока в тумане`;

  return (
    <svg
      class="valley__scene"
      viewBox={`0 ${VIEW_TOP} ${W} ${H - VIEW_TOP}`}
      role="img"
      aria-label={label}
      style={style}
    >
      <defs>
        <linearGradient id="mist-edge" gradientUnits="userSpaceOnUse" x1="-60" y1="0" x2="12" y2="0">
          <stop offset="0" stop-color="#cfcfd3" stop-opacity="0" />
          <stop offset="1" stop-color="#cfcfd3" stop-opacity="0.9" />
        </linearGradient>
        {scene.landmarks.length > 0 && <LandmarkMistGradient />}
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="var(--color-sky)" />
      <circle cx="292" cy="50" r="22" fill="var(--color-sun)" />
      <g fill={PALETTE.paper} opacity="0.7" aria-hidden="true">
        <ellipse cx="470" cy="58" rx="26" ry="7" />
        <ellipse cx="488" cy="53" rx="14" ry="7" />
        <ellipse cx="690" cy="72" rx="30" ry="8" />
        <ellipse cx="708" cy="66" rx="16" ry="8" />
        <ellipse cx="880" cy="50" rx="22" ry="6" />
      </g>
      <g fill="none" stroke="#7a6e62" stroke-width="1.2">
        <path d="M182 34 q6 -6 12 0 q6 -6 12 0" />
        <path d="M64 58 q3.5 -3.5 7 0 q3.5 -3.5 7 0" />
        <path d="M540 40 q4 -4 8 0 q4 -4 8 0" />
        <path d="M780 30 q5 -5 10 0 q5 -5 10 0" />
      </g>
      {scene.decor.filter((d) => d.kind === 'rainbow').map((d) => (
        <g key={d.id} class={d.id === fresh ? 'decor--new' : undefined}>
          <DecorArt d={d} />
        </g>
      ))}
      {STATIC_LAYERS.hills.map((h) => (
        <path key={h.band} d={h.d} fill={HILL_COLORS[h.band]} />
      ))}
      <path d={STATIC_LAYERS.river} fill="var(--color-river)" />

      {objects.map(({ plant: p, landmark: l }) =>
        l ? (
          <ValleyLandmarkArt key={`boss-${l.bossId}`} l={l} fresh={l.bossId === fresh} />
        ) : (
          <g key={p!.id} transform={`translate(${p!.x} ${p!.y}) scale(${p!.scale.toFixed(3)})`}>
            <g class={p!.id === fresh ? 'plant plant--new' : 'plant'}>
              <g
                class={sways(p!.kind, p!.size) ? 'plant__sway' : undefined}
                style={{ animationDelay: `${-((p!.seed % 6000) / 1000).toFixed(2)}s` }}
              >
                <PlantArt kind={p!.kind} size={p!.size} seed={p!.seed} />
              </g>
            </g>
          </g>
        ),
      )}
      {scene.decor.filter((d) => d.kind === 'deer').map((d) => (
        <g key={d.id} class={d.id === fresh ? 'decor--new' : undefined}>
          <DecorArt d={d} />
        </g>
      ))}

      {scene.camp.filter((c) => c.kind === 'tent').map((c) => (
        <CampArt key={c.kind} item={c} />
      ))}
      <WandererArt feathers={feathers} stage={cloakStage} x={CAMP.wandererX} y={CAMP.y} />
      <CampfireArt level={fire} x={CAMP.fireX} y={CAMP.y} />
      {scene.camp.filter((c) => c.kind !== 'tent').map((c) => (
        <CampArt key={c.kind} item={c} />
      ))}

      {scene.decor.filter((d) => d.kind === 'fireflies').map((d) => (
        <g key={d.id} class={d.id === fresh ? 'decor--new' : undefined}>
          <DecorArt d={d} />
        </g>
      ))}

      <g class="valley__mist" style={{ transform: `translateX(${mistX}px)` }} aria-hidden="true">
        <rect x="-60" y="112" width={W + 400} height={H - 112} fill="url(#mist-edge)" />
        {MIST_PUFFS.map((m, i) => (
          <ellipse key={i} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill="#d3d3d6" opacity="0.9" />
        ))}
        <ellipse cx="-4" cy="150" rx="30" ry="26" fill="#d0d0d3" opacity="0.75" />
        <ellipse cx="-8" cy="196" rx="34" ry="28" fill="#cbcbcf" opacity="0.75" />
        <ellipse cx="-2" cy="232" rx="30" ry="18" fill="#d0d0d3" opacity="0.75" />
      </g>
      <g stroke="#a3a3a8" stroke-width="2" stroke-linecap="round" fill="none" aria-hidden="true">
        {DEAD_TREES.filter((t) => t.x > mistX + 14).map((t) => (
          <path
            key={t.x}
            d={`M${t.x} ${t.y} l0 ${-t.h} M${t.x} ${t.y - t.h * 0.55} l-7 -7 M${t.x} ${t.y - t.h * 0.75} l7 -8`}
          />
        ))}
      </g>

      {pick && (
        <g class="valley__pick">
          {pick.slots.map((i) => {
            const s = SLOTS[i]!;
            const k = depthScale(s.y);
            return (
              <g
                key={i}
                class="pick-spot"
                transform={`translate(${s.x} ${s.y})`}
                role="button"
                aria-label={`Место ${i + 1}`}
                onClick={() => pick.onPick(i)}
              >
                {/* Зона нажатия больше видимого кружка. */}
                <circle r={11 * k} fill="transparent" />
                <circle class="pick-spot__ring" r={4.5 * k} fill={PALETTE.paper} fill-opacity="0.55" stroke={PALETTE.paper} stroke-width="1.2" />
                <circle r={1.4 * k} fill={PALETTE.barkDark} opacity="0.6" />
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
