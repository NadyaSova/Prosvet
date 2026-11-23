// Галерея: олень у воды. Прежний рисунок (копия, для сравнения) и новый из src/ui/valley/decor-art.tsx —
// крупно и в размере долины рядом со средней яблоней.

import { PlantArt } from '../ui/valley/plant-art';
import { DEER_SCALE, DeerArt } from '../ui/valley/decor-art';

/** Олень до правки — овал на палочках, пьёт из реки. */
function OldDeer() {
  return (
    <g>
      <g stroke="#7d5638" stroke-width="1.4" stroke-linecap="round">
        <path d="M-6 -1 L-6.5 -8 M-3.5 -1 L-3.5 -8 M4 -1 L4.5 -8 M6.5 -1 L6 -8" />
      </g>
      <ellipse cx="0" cy="-10" rx="9" ry="4.2" fill="#a0704a" />
      <path d="M6 -11 Q10 -10 12 -4" stroke="#a0704a" stroke-width="3.2" fill="none" stroke-linecap="round" />
      <ellipse cx="12.6" cy="-3" rx="2.6" ry="1.7" fill="#a0704a" />
      <path d="M10.5 -5 l-1.5 -3.5 M11.5 -5.2 l0.5 -3.6" stroke="#7d5638" stroke-width="0.8" stroke-linecap="round" />
      <circle cx="-8.6" cy="-11.5" r="1.4" fill="#f4ede0" />
    </g>
  );
}

/** Кусочек долины: трава, справа река, средняя яблоня и олень. */
function ValleyTile({ old = false, mirror = false }: { old?: boolean; mirror?: boolean }) {
  const s = old ? 1 : DEER_SCALE;
  return (
    <svg class="gallery__tree" viewBox="-30 -48 60 52" aria-hidden="true">
      <rect x="-30" y="-48" width="60" height="48" fill="var(--color-sky)" />
      <rect x="-30" y="0" width="60" height="4" fill="var(--color-hill-mid)" />
      <rect x="18" y="-1" width="12" height="5" fill="var(--color-river)" />
      <g transform="translate(-18 0)">
        <PlantArt kind="apple" size="medium" seed={11} />
      </g>
      <g transform={`translate(${mirror ? 12 : 2} 0) scale(${mirror ? -s : s} ${s})`}>{old ? <OldDeer /> : <DeerArt />}</g>
    </svg>
  );
}

export function DeerSection() {
  return (
    <section class="card">
      <h2>Олень у воды: было и стало</h2>
      <div class="gallery__deer-big">
        <figure>
          <svg viewBox="-14 -50 34 52" aria-hidden="true">
            <OldDeer />
          </svg>
          <figcaption class="muted small">было</figcaption>
        </figure>
        <figure>
          <svg viewBox="-14 -50 34 52" aria-hidden="true">
            <DeerArt />
          </svg>
          <figcaption class="muted small">стало</figcaption>
        </figure>
      </div>
      <h3 class="gallery__row-title">В размере долины, рядом со средней яблоней</h3>
      <div class="gallery__deer-row">
        <figure>
          <ValleyTile old />
          <figcaption class="muted small">было</figcaption>
        </figure>
        <figure>
          <ValleyTile />
          <figcaption class="muted small">стало</figcaption>
        </figure>
        <figure>
          <ValleyTile mirror />
          <figcaption class="muted small">стало, смотрит влево</figcaption>
        </figure>
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-deer-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-deer-style' });
style.textContent = `
  .gallery__deer-big { display: grid; grid-template-columns: repeat(2, minmax(120px, 240px)); gap: 16px; margin-bottom: 12px; }
  .gallery__deer-row { display: grid; grid-template-columns: repeat(3, minmax(100px, 200px)); gap: 8px; }
`;
document.head.append(style);
