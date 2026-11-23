// Долина крупно (#/valley): во весь экран, листается во все стороны, увеличивается щипком двумя пальцами
// или кнопками «+» и «−». Открывается там, где выросло последнее. Здесь же можно посадить семена из запаса:
// экран сам подъезжает к новому растению, и оно растёт крупно. Если картина ниже окна, она стоит внизу,
// а сверху — то же небо.
//
// На телефоне, который держат вертикально, экран повёрнут на бок: верх картины — у правого края телефона.
// Телефон поворачивают против часовой стрелки, и долина во весь экран. Листание пальцем на повёрнутом экране
// считается здесь же: браузер не обязан правильно листать повёрнутый блок.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Feather } from '../logic/pigeons';
import type { FireLevel } from '../logic/streak';
import { CAPACITY, sceneOf } from '../logic/valley';
import { VIEW_WIDTH, WORLD } from '../logic/valley-district';
import type { ValleyState } from '../model/types';
import { BackBar } from './common';
import { plural } from './format';
import { PlantRow } from './valley/PlantRow';
import { focusOf, SCENE_HEIGHT, ValleyScene } from './valley/ValleyView';

interface Props {
  valley: ValleyState;
  fire: FireLevel;
  feathers: readonly Feather[];
  cloakStage: number;
  /** Только что выросшее — для анимации роста. */
  fresh: string | null;
  /** Запас семян и редкостей из карт добычи. */
  inventory: readonly string[];
  onPlant: (item: string) => void;
}

/** Шаг кнопок «+» и «−». */
const STEP = 1.5;

/** Когда поворачивать экран на бок. То же условие — у .valley-screen--turn в styles.css. */
const TURN_QUERY = '(orientation: portrait) and (pointer: coarse)';

/** Масштабы (пикселей на единицу мира). Размеры блока — без поворота. */
function limits(el: HTMLElement) {
  const fit = el.clientHeight / SCENE_HEIGHT; // картина ровно по высоте окна
  const whole = el.clientWidth / WORLD.width; // видна вся панорама
  const card = Math.min(innerWidth, innerHeight, 480) / VIEW_WIDTH; // примерно как в карточке на главном экране
  return { start: Math.min(card * 2, fit), min: Math.min(whole, fit), max: Math.max(fit, card * 4) };
}

function useTurned(): boolean {
  const [turned, setTurned] = useState(() => matchMedia(TURN_QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(TURN_QUERY);
    const update = () => setTurned(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return turned;
}

export function ValleyScreen({ valley, fire, feathers, cloakStage, fresh, inventory, onPlant }: Props) {
  const turned = useTurned();
  const turnedRef = useRef(turned);
  turnedRef.current = turned;
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  // Точка окна, которая должна остаться на месте при смене масштаба (центр или середина между пальцами).
  const anchor = useRef<{ x: number; y: number; from: number } | null>(null);
  const scaleRef = useRef<number | null>(null);
  scaleRef.current = scale;
  // Масштаб, при котором надо заново встать на последнее выросшее (первый показ, поворот).
  const recenterAt = useRef<number | null>(null);

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

  function recenter(el: HTMLElement, s: number) {
    el.scrollLeft = Math.max(0, focusOf(valley, fresh).x * s - el.clientWidth / 2);
    el.scrollTop = el.scrollHeight;
  }

  // Посадили здесь же — плавно подъехать к новому, чтобы рост был на виду.
  const shownFresh = useRef(fresh);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !fresh || fresh === shownFresh.current || scaleRef.current === null) return;
    shownFresh.current = fresh;
    const s = scaleRef.current;
    const p = focusOf(valley, fresh);
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({
      left: p.x * s - el.clientWidth / 2,
      // Чуть выше основания — чтобы было видно всё растение.
      top: (p.y - 16) * s - el.clientHeight / 2,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, [fresh]);

  // Первый показ и поворот: начальный масштаб, на последнем выросшем.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const start = limits(el).start;
    anchor.current = null;
    if (start === scaleRef.current) {
      recenter(el, start);
      return;
    }
    recenterAt.current = start;
    scaleRef.current = start;
    setScale(start);
  }, [turned]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || scale === null) return;
    const a = anchor.current;
    anchor.current = null;
    if (recenterAt.current === scale || !a) {
      recenterAt.current = null;
      recenter(el, scale);
      return;
    }
    const k = scale / a.from;
    el.scrollLeft = (el.scrollLeft + a.x) * k - a.x;
    el.scrollTop = (el.scrollTop + a.y) * k - a.y;
  }, [scale]);

  // Щипок двумя пальцами, а на повёрнутом экране и листание — с разгоном после того, как палец отпустили.
  // Слушатели — не пассивные: иначе браузер увеличит всю страницу.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    /** Точка экрана в координатах блока без поворота. */
    const local = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      // Повёрнут на 90° по часовой: левый верхний угол блока — в правом верхнем углу его места на экране.
      return turnedRef.current ? { x: y - r.top, y: r.right - x } : { x: x - r.left, y: y - r.top };
    };
    const point = (t: TouchList) =>
      t.length >= 2
        ? local((t[0]!.clientX + t[1]!.clientX) / 2, (t[0]!.clientY + t[1]!.clientY) / 2)
        : local(t[0]!.clientX, t[0]!.clientY);
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);

    let pinch: { dist: number; scale: number } | null = null;
    let pan: { x: number; y: number; t: number; vx: number; vy: number } | null = null;
    let glide = 0;
    const startPan = (e: TouchEvent) => {
      pan = turnedRef.current && e.touches.length > 0 ? { ...point(e.touches), t: e.timeStamp, vx: 0, vy: 0 } : null;
    };

    const start = (e: TouchEvent) => {
      cancelAnimationFrame(glide);
      if (e.touches.length === 2 && scaleRef.current !== null) {
        e.preventDefault();
        pinch = { dist: dist(e.touches), scale: scaleRef.current };
      }
      startPan(e);
    };
    const move = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const m = point(e.touches);
        zoomTo((pinch.scale * dist(e.touches)) / pinch.dist, m.x, m.y);
      }
      if (pan) {
        e.preventDefault();
        const p = point(e.touches);
        const dx = p.x - pan.x;
        const dy = p.y - pan.y;
        el.scrollLeft -= dx;
        el.scrollTop -= dy;
        const dt = Math.max(1, e.timeStamp - pan.t);
        pan = { ...p, t: e.timeStamp, vx: 0.8 * (dx / dt) + 0.2 * pan.vx, vy: 0.8 * (dy / dt) + 0.2 * pan.vy };
      }
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
      if (!pan) return;
      if (e.touches.length > 0) {
        // Один палец из двух отпустили — листаем оставшимся, без скачка.
        startPan(e);
        return;
      }
      let { vx, vy } = pan;
      pan = null;
      if (Math.hypot(vx, vy) < 0.1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      let last = performance.now();
      const step = (now: number) => {
        const dt = now - last;
        last = now;
        el.scrollLeft -= vx * dt;
        el.scrollTop -= vy * dt;
        const k = Math.pow(0.995, dt);
        vx *= k;
        vy *= k;
        if (Math.hypot(vx, vy) > 0.02) glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      cancelAnimationFrame(glide);
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
    <main class={turned ? 'screen valley-screen valley-screen--turn' : 'screen valley-screen'}>
      <BackBar title="Долина">{zoom}</BackBar>
      <div class="valley-screen__bar">
        <p class="muted small valley-screen__note">
          {scene.open ? `Выросло ${grown}. Хмари больше нет.` : `Выросло ${grown} из ${CAPACITY}.`} Размер — двумя
          пальцами или кнопками.
        </p>
        <PlantRow valley={valley} inventory={inventory} onPlant={onPlant} />
      </div>
      <div class="valley-big" ref={boxRef}>
        {scale !== null && (
          <ValleyScene
            valley={valley}
            fire={fire}
            feathers={feathers}
            cloakStage={cloakStage}
            fresh={fresh}
            style={{ width: `${WORLD.width * scale}px`, height: `${SCENE_HEIGHT * scale}px` }}
          />
        )}
      </div>
    </main>
  );
}
