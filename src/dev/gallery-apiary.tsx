// Галерея: пасека (место бесконечного босса) — на рассмотрении у пользователя.
// Как она выглядит сейчас: по числу подходов, по сиду, крупно, на холмах, ульи и пчёлы по отдельности.

import type { ComponentChildren } from 'preact';
import { gardenView } from '../logic/bosses';
import type { Boss } from '../model/types';
import { BeeSample, GardenArt, HIVE_KINDS, HiveSample, SkepSample } from '../ui/valley/garden-art';
import { PlantArt } from '../ui/valley/plant-art';

/** Высота рамки места на ближней полосе долины; на холмах — около 60. */
const SIZE = 80;
const STAGES = [0, 1, 3, 5, 8, 12, 30, 45, 60];
const EARLY = [1, 3, 5, 6, 8];
const HIVE_COLOR_NAMES = ['голубой', 'жёлтый', 'белый', 'зелёный', 'розовый'];
const ROOF_NAMES = ['коричневая крыша', 'серая крыша', 'красная крыша'];

/** count, special, bloom — те же, что даст долине gardenView после n подходов. */
function viewOf(n: number) {
  const v = gardenView({ sessions: Array.from({ length: n }, () => ({ startedAt: 0, minutes: 10 })) } as Boss);
  return { count: v.elements, special: v.specials, bloom: v.bloom };
}

const approaches = (n: number) => (n === 0 ? 'пустая' : `${n} ${n === 1 ? 'подход' : n < 5 ? 'подхода' : 'подходов'}`);

/** Кусочек долины: пасека между большим дубом и средней сосной, как пруд, луг и цветник. */
function Tile({ n, seed = 1, size = SIZE, still = true }: { n: number; seed?: number; size?: number; still?: boolean }) {
  return (
    <svg class="gallery__garden" viewBox="-125 -72 250 76" aria-hidden="true">
      <rect x="-125" y="-72" width="250" height="76" fill="var(--color-sky)" />
      <rect x="-125" y="-46" width="250" height="50" fill="var(--color-hill-mid)" />
      <g transform="translate(-104 0)">
        <PlantArt kind="oak" size="large" seed={11} />
      </g>
      <GardenArt kind="apiary" seed={seed} size={size} still={still} {...viewOf(n)} />
      <g transform="translate(106 0)">
        <PlantArt kind="pine" size="medium" seed={5} />
      </g>
    </svg>
  );
}

/** Пасека крупно, без деревьев: рамка места 120 × 60 с небольшим полем. */
function Big({ n, seed = 1 }: { n: number; seed?: number }) {
  return (
    <svg class="gallery__garden" viewBox="-66 -46 132 50" aria-hidden="true">
      <rect x="-66" y="-46" width="132" height="50" fill="var(--color-hill-mid)" />
      <GardenArt kind="apiary" seed={seed} size={60} still {...viewOf(n)} />
    </svg>
  );
}

function Sample({ label, viewBox, children }: { label: string; viewBox: string; children: ComponentChildren }) {
  const [x, y, w, h] = viewBox.split(' ');
  return (
    <figure>
      <svg viewBox={viewBox} class="gallery__apiary-pic" aria-hidden="true">
        <rect x={x} y={y} width={w} height={h} fill="var(--color-hill-mid)" />
        {children}
      </svg>
      <figcaption class="muted small">{label}</figcaption>
    </figure>
  );
}

const HIVE_BOX = '-9 -20 18 21.5';
const BEE_BOX = '-3.5 -3.5 7 6';

export function ApiarySection() {
  return (
    <section class="card">
      <h2>Пасека</h2>
      <p class="muted small">
        Поляна, обнесённая плетнём, клевер и лаванда, пень сбоку. Ульев на поляне не больше шести: улей — на 1-м подходе (с пчелой над ним) и на
        каждом 6-м (6, 12, 18, 24, 30), остальные подходы — пчёлы. Ульи ставятся от середины к краям, сначала дальний ряд из четырёх, потом ближний
        из двух. Особые (каждый 5-й подход) — золотые пчёлы со звёздочкой; 30-й подход — и улей, и особый, поэтому шестой улей — соломенный
        колпак. После 30 подходов элементы не прибавляются: ульи ярче, больше цветов и пчёл; полностью — к 60. Пчёлы летают по очереди, как бабочки
        машут крыльями: каждая следующая облетает петлю через 1,5 секунды после предыдущей, остальное время висит на месте.
      </p>

      <h3 class="gallery__row-title">1, 3, 5, 6, 8 подходов крупно (на 6-м — второй улей)</h3>
      <div class="gallery__gardens gallery__gardens--big">
        {EARLY.map((n) => (
          <figure key={n}>
            <Big n={n} />
            <figcaption class="muted small">{approaches(n)}</figcaption>
          </figure>
        ))}
      </div>

      <h3 class="gallery__row-title">По числу подходов (в размере долины, рядом дуб и сосна)</h3>
      <div class="gallery__gardens">
        {STAGES.map((n) => (
          <figure key={n}>
            <Tile n={n} />
            <figcaption class="muted small">
              {approaches(n)}
              {n > 30 && ` · пышность ${Math.round(((n - 30) / 30) * 100)} %`}
            </figcaption>
          </figure>
        ))}
        <figure>
          <Tile n={30} still={false} />
          <figcaption class="muted small">30 подходов · с движением (пчёлы, звёздочки)</figcaption>
        </figure>
      </div>

      <h3 class="gallery__row-title">Разные пасеки (по сиду), 12 подходов</h3>
      <div class="gallery__gardens">
        {[2, 3, 4].map((seed) => (
          <figure key={seed}>
            <Tile n={12} seed={seed} />
            <figcaption class="muted small">сид {seed}</figcaption>
          </figure>
        ))}
      </div>

      <h3 class="gallery__row-title">Крупно: 12 и 30 подходов</h3>
      <div class="gallery__gardens gallery__gardens--big">
        {[12, 30].map((n) => (
          <figure key={n}>
            <Big n={n} />
            <figcaption class="muted small">{n} подходов</figcaption>
          </figure>
        ))}
      </div>

      <h3 class="gallery__row-title">На средних холмах (размер 60), 12 и 30 подходов</h3>
      <div class="gallery__gardens">
        {[12, 30].map((n) => (
          <figure key={n}>
            <Tile n={n} size={60} />
            <figcaption class="muted small">{n} подходов</figcaption>
          </figure>
        ))}
      </div>

      <h3 class="gallery__row-title">Ульи по отдельности</h3>
      <div class="gallery__apiary-items">
        {Array.from({ length: HIVE_KINDS.colors }, (_, color) => (
          <Sample key={color} label={`${HIVE_COLOR_NAMES[color]} · ${ROOF_NAMES[color % HIVE_KINDS.roofs]}`} viewBox={HIVE_BOX}>
            <HiveSample color={color} roof={color % HIVE_KINDS.roofs} boxes={color % 2 === 0 ? 2 : 3} />
          </Sample>
        ))}
        <Sample label="голубой · пышность (ярче)" viewBox={HIVE_BOX}>
          <HiveSample color={0} roof={0} boxes={2} bright />
        </Sample>
        <Sample label="улей-колпак — особый" viewBox={HIVE_BOX}>
          <SkepSample />
        </Sample>
      </div>

      <h3 class="gallery__row-title">Пчёлы</h3>
      <div class="gallery__apiary-items">
        <Sample label="пчела" viewBox={BEE_BOX}>
          <BeeSample />
        </Sample>
        <Sample label="золотая — особая (после 30 подходов)" viewBox={BEE_BOX}>
          <BeeSample gold />
        </Sample>
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-apiary-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-apiary-style' });
style.textContent = `
  .gallery__gardens { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .gallery__gardens--big { grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); }
  .gallery__garden { border-radius: 10px; }
  .gallery__apiary-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 8px; }
  .gallery .gallery__apiary-pic { width: 180px; border-radius: 8px; margin: 0 auto; }
`;
document.head.append(style);
