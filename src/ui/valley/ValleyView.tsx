// Долина — панорама на 2,5 экрана, листается вбок. Рисует только то, что дала модель (sceneOf):
// рельеф и места — из logic/valley-district.ts, растения и редкости — из состояния долины.
// Графику можно заменить (например, спрайтами), не трогая игровую логику. SPEC.md §12.3.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Feather } from '../../logic/pigeons';
import { createRng } from '../../logic/rng';
import type { FireLevel } from '../../logic/streak';
import { CAPACITY, latestPlant, mistFrontier, sceneOf } from '../../logic/valley';
import {
  BANDS,
  CAMP,
  hillTop,
  RIVER,
  riverWidth,
  riverX,
  SLOTS,
  VIEW_WIDTH,
  WORLD,
  type Band,
} from '../../logic/valley-district';
import type { ValleyState } from '../../model/types';
import { plural } from '../format';
import { CampfireArt } from './campfire-art';
import { DecorArt } from './decor-art';
import { PlantArt, sways } from './plant-art';
import { WandererArt } from './wanderer-art';

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

/** Засохшие деревья в хмари — постоянные места по всей панораме. */
const DEAD_TREES = (() => {
  const rng = createRng(31);
  const list: { x: number; y: number; h: number }[] = [];
  for (let x = 320; x < W - 6; x += 44 + rng() * 14) {
    const band = BANDS[1 + Math.floor(rng() * 3)]!;
    list.push({ x, y: hillTop(band, x) + 6 + rng() * 10, h: 14 + rng() * 14 });
  }
  return list;
})();

/** Облачка хмари вдоль её края и сверху. Координаты — от границы хмари. */
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

interface Props {
  valley: ValleyState;
  fire: FireLevel;
  feathers: readonly Feather[];
  cloakStage: number;
  /** Только что посаженное растение или редкость — для анимации роста. */
  fresh: string | null;
}

export function ValleyView({ valley, fire, feathers, cloakStage, fresh }: Props) {
  const scene = useMemo(() => sceneOf(valley), [valley]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Хмарь отходит медленно: сначала там, где была до нового растения, потом на новом месте.
  const before = useMemo(
    () => (fresh ? mistFrontier({ ...valley, plants: valley.plants.filter((p) => p.id !== fresh) }) : scene.mistX),
    [valley, fresh, scene.mistX],
  );
  const [mistX, setMistX] = useState(before);
  useEffect(() => {
    if (mistX === scene.mistX) return;
    const id = setTimeout(() => setMistX(scene.mistX), 600);
    return () => clearTimeout(id);
  }, [mistX, scene.mistX]);

  // Панорама открывается там, где выросло последнее.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const freshPlant = fresh ? scene.plants.find((p) => p.id === fresh) : undefined;
    const freshDecor = fresh ? scene.decor.find((d) => d.id === fresh) : undefined;
    const latest = latestPlant(valley);
    const x = freshPlant?.x ?? freshDecor?.x ?? (latest ? SLOTS[latest.slot]!.x : 0);
    const k = el.clientWidth / VIEW_WIDTH;
    el.scrollLeft = Math.max(0, x * k - el.clientWidth / 2);
  }, [fresh]);

  const n = scene.plants.length;
  const plants = `${n} ${plural(n, ['растение', 'растения', 'растений'])}`;
  const label = scene.open
    ? `Долина открыта: ${plants}, хмари больше нет`
    : `Долина: ${plants} из ${CAPACITY}, остальное пока в хмари`;

  return (
    <div class="valley" ref={scrollRef}>
      <svg class="valley__scene" viewBox={`0 ${VIEW_TOP} ${W} ${H - VIEW_TOP}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id="mist-edge" gradientUnits="userSpaceOnUse" x1="-60" y1="0" x2="12" y2="0">
            <stop offset="0" stop-color="#cfcfd3" stop-opacity="0" />
            <stop offset="1" stop-color="#cfcfd3" stop-opacity="0.9" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="var(--color-sky)" />
        <circle cx="292" cy="50" r="22" fill="var(--color-sun)" />
        <g fill="#fffaf2" opacity="0.7" aria-hidden="true">
          <ellipse cx="470" cy="58" rx="26" ry="7" />
          <ellipse cx="488" cy="53" rx="14" ry="7" />
          <ellipse cx="690" cy="72" rx="30" ry="8" />
          <ellipse cx="708" cy="66" rx="16" ry="8" />
          <ellipse cx="880" cy="50" rx="22" ry="6" />
        </g>
        <g fill="none" stroke="#7a6e62" stroke-width="1.2">
          <path d="M250 36 q5 -5 10 0 q5 -5 10 0" />
          <path d="M60 46 q4 -4 8 0 q4 -4 8 0" />
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

        {scene.plants.map((p) => (
          <g key={p.id} transform={`translate(${p.x} ${p.y}) scale(${p.scale.toFixed(3)})`}>
            <g class={p.id === fresh ? 'plant plant--new' : 'plant'}>
              <g
                class={sways(p.kind, p.size) ? 'plant__sway' : undefined}
                style={{ animationDelay: `${-((p.seed % 6000) / 1000).toFixed(2)}s` }}
              >
                <PlantArt kind={p.kind} size={p.size} seed={p.seed} />
              </g>
            </g>
          </g>
        ))}
        {scene.decor.filter((d) => d.kind === 'deer').map((d) => (
          <g key={d.id} class={d.id === fresh ? 'decor--new' : undefined}>
            <DecorArt d={d} />
          </g>
        ))}

        <WandererArt feathers={feathers} stage={cloakStage} x={CAMP.wandererX} y={CAMP.y} />
        <CampfireArt level={fire} x={CAMP.fireX} y={CAMP.y} />

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
      </svg>
    </div>
  );
}
