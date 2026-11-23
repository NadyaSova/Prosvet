// Долина крупно (#/valley): во весь экран, листается во все стороны, увеличивается щипком двумя пальцами
// или кнопками «+» и «−». Открывается вдвое крупнее карточки на главном экране, там, где выросло последнее.
// Если картина ниже окна, она стоит внизу, а сверху — то же небо.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Feather } from '../logic/pigeons';
import type { FireLevel } from '../logic/streak';
import { CAPACITY, sceneOf } from '../logic/valley';
import { VIEW_WIDTH, WORLD } from '../logic/valley-district';
import type { ValleyState } from '../model/types';
import { BackBar } from './common';
import { plural } from './format';
import { focusX, SCENE_HEIGHT, ValleyScene } from './valley/ValleyView';

interface Props {
  valley: ValleyState;
  fire: FireLevel;
  feathers: readonly Feather[];
  cloakStage: number;
}

/** Шаг кнопок «+» и «−». */
const STEP = 1.5;

/** Масштабы (пикселей на единицу мира) для окна такого размера. */
function limits(el: HTMLElement) {
  const fit = el.clientHeight / SCENE_HEIGHT; // картина ровно по высоте окна
  const whole = el.clientWidth / WORLD.width; // видна вся панорама
  const card = el.clientWidth / VIEW_WIDTH; // как в карточке на главном экране
  return { start: Math.min(card * 2, fit), min: Math.min(whole, fit), max: Math.max(fit, card * 4) };
}

export function ValleyScreen({ valley, fire, feathers, cloakStage }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  // Точка окна, которая должна остаться на месте при смене масштаба (центр или середина между пальцами).
  const anchor = useRef<{ x: number; y: number; from: number } | null>(null);
  const scaleRef = useRef<number | null>(null);
  scaleRef.current = scale;

  function zoomTo(next: number, x?: number, y?: number) {
    const el = boxRef.current;
    const from = scaleRef.current;
    if (!el || from === null) return;
    const { min, max } = limits(el);
    const to = Math.min(max, Math.max(min, next));
    if (Math.abs(to - from) < 1e-4) return;
    anchor.current = { x: x ?? el.clientWidth / 2, y: y ?? el.clientHeight / 2, from: anchor.current?.from ?? from };
    scaleRef.current = to;
    setScale(to);
  }

  // Первый показ — на последнем выросшем.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el) setScale(limits(el).start);
  }, []);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || scale === null) return;
    const a = anchor.current;
    anchor.current = null;
    if (!a) {
      el.scrollLeft = Math.max(0, focusX(valley, null) * scale - el.clientWidth / 2);
      el.scrollTop = el.scrollHeight;
      return;
    }
    const k = scale / a.from;
    el.scrollLeft = (el.scrollLeft + a.x) * k - a.x;
    el.scrollTop = (el.scrollTop + a.y) * k - a.y;
  }, [scale]);

  // Щипок двумя пальцами. Слушатели — не пассивные: иначе браузер увеличит всю страницу.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let pinch: { dist: number; scale: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2 || scaleRef.current === null) return;
      e.preventDefault();
      pinch = { dist: dist(e.touches), scale: scaleRef.current };
    };
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - r.left;
      const my = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - r.top;
      zoomTo((pinch.scale * dist(e.touches)) / pinch.dist, mx, my);
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, []);

  const lim = boxRef.current && scale !== null ? limits(boxRef.current) : null;

  const zoom = (
    <>
      <button
        type="button"
        class="icon-button"
        aria-label="Мельче"
        disabled={!lim || scale! <= lim.min + 1e-4}
        onClick={() => zoomTo(scale! / STEP)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <path d="M6 12h12" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label="Крупнее"
        disabled={!lim || scale! >= lim.max - 1e-4}
        onClick={() => zoomTo(scale! * STEP)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <path d="M6 12h12M12 6v12" />
        </svg>
      </button>
    </>
  );

  const scene = useMemo(() => sceneOf(valley), [valley]);
  const n = scene.plants.length;
  const grown = `${n} ${plural(n, ['растение', 'растения', 'растений'])}`;

  return (
    <main class="screen valley-screen">
      <BackBar title="Долина">{zoom}</BackBar>
      <p class="muted small valley-screen__note">
        {scene.open ? `Выросло ${grown}. Хмари больше нет.` : `Выросло ${grown} из ${CAPACITY}.`} Размер — двумя
        пальцами или кнопками.
      </p>
      <div class="valley-big" ref={boxRef}>
        {scale !== null && (
          <ValleyScene
            valley={valley}
            fire={fire}
            feathers={feathers}
            cloakStage={cloakStage}
            fresh={null}
            style={{ width: `${WORLD.width * scale}px`, height: `${SCENE_HEIGHT * scale}px` }}
          />
        )}
      </div>
    </main>
  );
}
