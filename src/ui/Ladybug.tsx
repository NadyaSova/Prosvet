// Божья коровка на доске заданий. Сидит внизу доски слева; от нажатия перелетает на край одной из записок,
// а с записки — обратно вниз доски. Нажатие на неё не открывает записку: она лежит поверх и гасит нажатие.
// Место считается по настоящим размерам доски и записок, поэтому коровка не съезжает при смене заданий.

import type { RefObject } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';

/** Где сидит: внизу доски (hx — сдвиг от левого края) или на верхнем крае записки (fx — доля её ширины). */
type Spot = { kind: 'bottom'; hx: number } | { kind: 'note'; index: number; fx: number };

const FLIGHT_MS = 900;
const random = (min: number, max: number) => min + Math.random() * (max - min);

function pointOf(plank: HTMLElement, spot: Spot): { x: number; y: number } | null {
  if (spot.kind === 'bottom') return { x: 24 + spot.hx, y: plank.clientHeight - 30 };
  const note = plank.querySelectorAll<HTMLElement>('.task')[spot.index];
  if (!note) return null;
  return { x: note.offsetLeft + note.offsetWidth * spot.fx, y: note.offsetTop - 7 };
}

export function Ladybug({ plankRef, notes }: { plankRef: RefObject<HTMLElement | null>; notes: string }) {
  const [spot, setSpot] = useState<Spot>({ kind: 'bottom', hx: 0 });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [angle, setAngle] = useState(-20);
  const [flying, setFlying] = useState(false);

  // Пересчитать точку после каждой отрисовки: записки могли смениться или переложиться по ширине экрана.
  useLayoutEffect(() => {
    const plank = plankRef.current;
    if (!plank) return;
    const update = () => {
      const p = pointOf(plank, spot) ?? pointOf(plank, { kind: 'bottom', hx: 0 })!;
      setPos((old) => (old && Math.abs(old.x - p.x) < 0.5 && Math.abs(old.y - p.y) < 0.5 ? old : p));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(plank);
    return () => observer.disconnect();
  }, [spot, notes, plankRef]);

  function fly(e: Event) {
    // Коровка лежит поверх записки: нажатие на неё не должно дойти до записки.
    e.stopPropagation();
    const plank = plankRef.current;
    if (!plank || flying || !pos) return;
    const count = plank.querySelectorAll('.task').length;
    const next: Spot =
      spot.kind === 'bottom' && count > 0
        ? { kind: 'note', index: Math.floor(Math.random() * count), fx: random(0.6, 0.9) }
        : { kind: 'bottom', hx: random(0, 50) };
    const to = pointOf(plank, next);
    if (!to) return;
    // Летит головой вперёд (на рисунке голова смотрит вверх), а сев, разворачивается как придётся.
    setAngle((Math.atan2(to.y - pos.y, to.x - pos.x) * 180) / Math.PI + 90);
    setFlying(true);
    setSpot(next);
    setTimeout(() => {
      setFlying(false);
      setAngle(random(-40, 40));
    }, FLIGHT_MS);
  }

  if (!pos) return null;
  return (
    <button
      type="button"
      class={`ladybug${flying ? ' ladybug--flying' : ''}`}
      style={{ transform: `translate(${pos.x - 20}px, ${pos.y - 20}px)` }}
      aria-label="Божья коровка"
      onClick={fly}
    >
      <svg class="ladybug__body" viewBox="-12 -13 24 26" style={{ transform: `rotate(${angle}deg)` }} aria-hidden="true">
        {/* Лапки */}
        <g stroke="#2b2420" stroke-width="1.1" stroke-linecap="round">
          <path d="M-6 -3l-4 -2M-6.5 1.5l-4.5 0M-6 6l-4 2.5M6 -3l4 -2M6.5 1.5l4.5 0M6 6l4 2.5" />
        </g>
        {/* Крылья — видны только в полёте */}
        <g class="ladybug__wings" fill="rgba(235, 240, 245, 0.75)" stroke="rgba(120, 120, 130, 0.5)" stroke-width="0.4">
          <ellipse cx="-6" cy="3" rx="4" ry="8.5" transform="rotate(-25 -6 3)" />
          <ellipse cx="6" cy="3" rx="4" ry="8.5" transform="rotate(25 6 3)" />
        </g>
        {/* Голова: очень тонкие усики, по бокам — белые пятна */}
        <path
          d="M-1.4 -10.4 q-0.6 -1.8 -2.6 -2.6 M1.4 -10.4 q0.6 -1.8 2.6 -2.6"
          fill="none"
          stroke="#2b2420"
          stroke-width="0.45"
          stroke-linecap="round"
        />
        <ellipse cx="0" cy="-7.6" rx="4.6" ry="3.4" fill="#2b2420" />
        <ellipse cx="-3.1" cy="-7.2" rx="1.3" ry="1.9" fill="#f6efe4" transform="rotate(20 -3.1 -7.2)" />
        <ellipse cx="3.1" cy="-7.2" rx="1.3" ry="1.9" fill="#f6efe4" transform="rotate(-20 3.1 -7.2)" />
        {/* Надкрылья: две половинки, в полёте раскрываются */}
        <g class="ladybug__shell ladybug__shell--left">
          <path d="M0 -5.5 C-4 -5.5 -8 -2 -8 2.5 C-8 7 -4.5 10.5 0 10.5 Z" fill="#d2402f" />
          <circle cx="-4.2" cy="-0.5" r="1.6" fill="#2b2420" />
          <circle cx="-3.4" cy="5.6" r="1.4" fill="#2b2420" />
        </g>
        <g class="ladybug__shell ladybug__shell--right">
          <path d="M0 -5.5 C4 -5.5 8 -2 8 2.5 C8 7 4.5 10.5 0 10.5 Z" fill="#d2402f" />
          <circle cx="4.2" cy="-0.5" r="1.6" fill="#2b2420" />
          <circle cx="3.4" cy="5.6" r="1.4" fill="#2b2420" />
        </g>
        <path class="ladybug__seam" d="M0 -5.5V10.5" stroke="#2b2420" stroke-width="0.8" />
        <ellipse cx="-3.2" cy="-2.8" rx="1.6" ry="0.9" fill="rgba(255,255,255,0.22)" transform="rotate(-30 -3.2 -2.8)" />
      </svg>
    </button>
  );
}
