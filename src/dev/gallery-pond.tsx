// Галерея: пруд с рыбками (место бесконечного босса) — переделка одобрена пользователем 25.11.2026.
// Виды кои крупно и пруд в размере долины рядом с деревьями: 1, 12 и 30 рыб.

import { gardenView } from '../logic/bosses';
import type { Boss } from '../model/types';
import { GardenArt, KOI, KoiSample } from '../ui/valley/garden-art';
import { PlantArt } from '../ui/valley/plant-art';

/** Высота рамки места в долине (одобрено пользователем). */
const SIZE = 80;
const COUNTS = [1, 12, 20, 30];
/** Вода для образцов — середина пруда. */
const WATER = '#80b4ca';

/** count, special, bloom — те же, что даст долине gardenView после n подходов. */
function viewOf(n: number) {
  const v = gardenView({ sessions: Array.from({ length: n }, () => ({ startedAt: 0, minutes: 10 })) } as Boss);
  return { count: v.elements, special: v.specials, bloom: v.bloom };
}

/** Кусочек долины: пруд между большим дубом и средней сосной, как луг. */
function Tile({ n, still }: { n: number; still: boolean }) {
  return (
    <svg class="gallery__garden" viewBox="-125 -72 250 76" aria-hidden="true">
      <rect x="-125" y="-72" width="250" height="76" fill="var(--color-sky)" />
      <rect x="-125" y="-46" width="250" height="50" fill="var(--color-hill-mid)" />
      <g transform="translate(-104 0)">
        <PlantArt kind="oak" size="large" seed={11} />
      </g>
      <GardenArt kind="pond" seed={1} size={SIZE} still={still} {...viewOf(n)} />
      <g transform="translate(106 0)">
        <PlantArt kind="pine" size="medium" seed={5} />
      </g>
    </svg>
  );
}

export function PondSection() {
  return (
    <section class="card">
      <h2>Пруд с рыбками</h2>
      <p class="muted small">
        Кои сверху: тело-капля, слегка изогнутое буквой S, два грудных плавника, хвост-веер, пятна на спине, без обводки. Изгиб и направление — у
        каждой рыбы свои. Пруд неровный, у каждого сида свой; вода темнее к середине. Подход — одна рыба; особые (каждый 5-й подход) — по очереди
        кувшинка с цветком и золотая огон. Рыбы по очереди дрейфуют по дуге; при «уменьшить движение» стоят.
      </p>

      <h3 class="gallery__row-title">Виды кои крупно</h3>
      <div class="gallery__koi">
        {Object.entries(KOI).map(([key, k]) => (
          <figure key={key}>
            <svg viewBox="-7.5 -4.5 14 9" class="gallery__koi-pic" aria-hidden="true">
              <rect x="-7.5" y="-4.5" width="14" height="9" fill={WATER} />
              <KoiSample kind={key} />
            </svg>
            <figcaption class="muted small">{k.name}</figcaption>
          </figure>
        ))}
        <figure>
          <svg viewBox="-7.5 -4.5 14 9" class="gallery__koi-pic" aria-hidden="true">
            <rect x="-7.5" y="-4.5" width="14" height="9" fill={WATER} />
            <KoiSample gold />
          </svg>
          <figcaption class="muted small">Огон — золотая, особая (каждый 10-й подход)</figcaption>
        </figure>
      </div>

      <h3 class="gallery__row-title">Пруд в размере долины: 1, 12, 20 и 30 рыб (после 12 рыбы мельчают)</h3>
      <div class="gallery__gardens">
        {COUNTS.map((n) => (
          <figure key={n}>
            <Tile n={n} still={false} />
            <figcaption class="muted small">
              {n} {n === 1 ? 'рыба' : 'рыб'}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-pond-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-pond-style' });
style.textContent = `
  .gallery__gardens { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .gallery__garden { border-radius: 10px; }
  .gallery__koi { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .gallery .gallery__koi-pic { width: 200px; border-radius: 8px; margin: 0 auto; }
`;
document.head.append(style);
