// Галерея: сооружения конечных боссов из src/ui/valley/landmark-art.tsx — крупно по три сида
// и в размере долины рядом с деревьями.

import { LANDMARK_KINDS, type LandmarkKind } from '../model/types';
import { DRAWN_LANDMARKS, LANDMARK_NAMES, LandmarkArt } from '../ui/valley/landmark-art';
import { PlantArt } from '../ui/valley/plant-art';

/** Сиды, у которых все три варианта цвета разные: камень, стены и крыша мельницы, купол обсерватории. */
const SEEDS = [1, 5, 8];

/** Сооружение крупно на кусочке неба и травы. */
function BigTile({ kind, seed }: { kind: LandmarkKind; seed: number }) {
  return (
    <svg class="gallery__landmark" viewBox="-66 -104 132 110" aria-hidden="true">
      <rect x="-66" y="-104" width="132" height="104" fill="var(--color-sky)" />
      <rect x="-66" y="0" width="132" height="6" fill="var(--color-hill-mid)" />
      <LandmarkArt kind={kind} seed={seed} size={100} />
    </svg>
  );
}

/** Кусочек долины: сооружение высотой 60 между большим дубом и средней сосной. */
function ValleyTile({ kind, size }: { kind: LandmarkKind; size: number }) {
  return (
    <svg class="gallery__landmark" viewBox="-80 -66 160 70" aria-hidden="true">
      <rect x="-80" y="-66" width="160" height="66" fill="var(--color-sky)" />
      <rect x="-80" y="0" width="160" height="4" fill="var(--color-hill-mid)" />
      <g transform="translate(-60 0)">
        <PlantArt kind="oak" size="large" seed={11} />
      </g>
      <LandmarkArt kind={kind} seed={SEEDS[0]!} size={size} />
      <g transform="translate(62 0)">
        <PlantArt kind="pine" size="medium" seed={5} />
      </g>
    </svg>
  );
}

export function LandmarksSection() {
  const waiting = LANDMARK_KINDS.filter((k) => !DRAWN_LANDMARKS.includes(k));
  return (
    <section class="card">
      <h2>Сооружения боссов</h2>
      <p class="muted small">
        Рисунок — только само сооружение, без тумана. Новые — сверху. Ещё не нарисованы: {waiting.map((k) => LANDMARK_NAMES[k].toLowerCase()).join(', ')}.
      </p>
      {[...DRAWN_LANDMARKS].reverse().map((kind) => (
        <div key={kind}>
          <h3 class="gallery__row-title">{LANDMARK_NAMES[kind]}: три сида</h3>
          <div class="gallery__landmarks">
            {SEEDS.map((seed) => (
              <figure key={seed}>
                <BigTile kind={kind} seed={seed} />
                <figcaption class="muted small">сид {seed}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
      <h3 class="gallery__row-title">В размере долины: рамка высотой 60, рядом большой дуб (42) и средняя сосна (29)</h3>
      <div class="gallery__landmarks">
        {DRAWN_LANDMARKS.map((kind) => (
          <figure key={kind}>
            <ValleyTile kind={kind} size={60} />
            <figcaption class="muted small">{LANDMARK_NAMES[kind]}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-landmarks-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-landmarks-style' });
style.textContent = `
  .gallery__landmarks { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .gallery__landmark { border-radius: 10px; }
`;
document.head.append(style);
