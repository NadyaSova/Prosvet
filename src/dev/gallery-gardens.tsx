// Галерея: места бесконечных боссов из src/ui/valley/garden-art.tsx в размере долины рядом с деревьями.
// Сейчас — луг с бабочками на 1, 12 и 30 подходах.

import { gardenView } from '../logic/bosses';
import type { Boss, GardenKind } from '../model/types';
import { GARDEN_NAMES, GardenArt } from '../ui/valley/garden-art';
import { PlantArt } from '../ui/valley/plant-art';

/** Высота рамки места в единицах долины (ширина — вдвое больше). Размер одобрен пользователем на пруде. */
const SIZE = 80;
const KIND: GardenKind = 'meadow';
const COUNTS = [1, 12, 30];

/** count, special, bloom — те же, что даст долине gardenView после n подходов. */
function viewOf(n: number) {
  const v = gardenView({ sessions: Array.from({ length: n }, () => ({ startedAt: 0, minutes: 10 })) } as Boss);
  return { count: v.elements, special: v.specials, bloom: v.bloom };
}

/** Кусочек долины: место между большим дубом и средней сосной. */
function ValleyTile({ n, still = true }: { n: number; still?: boolean }) {
  return (
    <svg class="gallery__garden" viewBox="-125 -72 250 76" aria-hidden="true">
      <rect x="-125" y="-72" width="250" height="76" fill="var(--color-sky)" />
      <rect x="-125" y="-46" width="250" height="50" fill="var(--color-hill-mid)" />
      <g transform="translate(-104 0)">
        <PlantArt kind="oak" size="large" seed={11} />
      </g>
      <GardenArt kind={KIND} seed={1} size={SIZE} still={still} {...viewOf(n)} />
      <g transform="translate(106 0)">
        <PlantArt kind="pine" size="medium" seed={5} />
      </g>
    </svg>
  );
}

export function GardensSection() {
  return (
    <section class="card">
      <h2>Места бесконечных боссов: {GARDEN_NAMES[KIND].toLowerCase()}</h2>
      <p class="muted small">
        Место шириной {SIZE * 2}, рядом большой дуб (42) и средняя сосна (29). Подход — одна бабочка, каждая 5-я — голубая. Движение — только
        на картинке «30»: в долине место одно, а здесь их несколько.
      </p>
      <div class="gallery__gardens">
        {COUNTS.map((n) => (
          <figure key={n}>
            <ValleyTile n={n} still={n !== 30} />
            <figcaption class="muted small">
              {n} {n === 1 ? 'подход' : 'подходов'}
              {n === 30 && ' · с движением'}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-gardens-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-gardens-style' });
style.textContent = `
  .gallery__gardens { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .gallery__garden { border-radius: 10px; }
`;
document.head.append(style);
