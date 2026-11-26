// Галерея: цветник (место бесконечного босса) — переделка на рассмотрении у пользователя (docs/tasks/flowerbed-redesign.md).
// По числу подходов, бортики и середина, цветовые схемы, крупно, на холмах, цветы и кусты по отдельности.

import type { ComponentChildren } from 'preact';
import { gardenView } from '../logic/bosses';
import type { Boss } from '../model/types';
import {
  BLOOMS,
  BushSample,
  FLOWERBED_SCHEMES,
  FlowerSample,
  flowerbedLook,
  GardenArt,
  type BedFlowerKind,
  type Planting,
  type SchemeKey,
} from '../ui/valley/garden-art';
import { PlantArt } from '../ui/valley/plant-art';

/** Высота рамки места на ближней полосе долины; на холмах — около 60. */
const SIZE = 80;
const STAGES = [0, 1, 5, 12, 30, 45, 60];
const EDGE_NAMES = ['доски', 'камень', 'кирпич'];
const KIND_NAMES: Record<BedFlowerKind, string> = { tulip: 'тюльпан', aster: 'астра', daisy: 'ромашка', bell: 'колокольчик', spike: 'колосок' };
const RARE_NAMES = ['роза', 'ирис', 'лилия'];

/** count, special, bloom — те же, что даст долине gardenView после n подходов. */
function viewOf(n: number) {
  const v = gardenView({ sessions: Array.from({ length: n }, () => ({ startedAt: 0, minutes: 10 })) } as Boss);
  return { count: v.elements, special: v.specials, bloom: v.bloom };
}

/** Первый сид для каждого сочетания бортика и середины. */
function seedsByLook() {
  const found: { seed: number; edge: number; fountain: boolean }[] = [];
  for (let seed = 1; seed < 500 && found.length < 6; seed++) {
    const look = flowerbedLook(seed);
    if (!found.some((f) => f.edge === look.edge && f.fountain === look.fountain)) found.push({ seed, ...look });
  }
  return found.sort((a, b) => a.edge - b.edge || Number(b.fountain) - Number(a.fountain));
}

/** Кусочек долины: цветник между большим дубом и средней сосной, как пруд и луг. */
function Tile({ n, seed = 1, size = SIZE, still = true }: { n: number; seed?: number; size?: number; still?: boolean }) {
  return (
    <svg class="gallery__garden" viewBox="-125 -72 250 76" aria-hidden="true">
      <rect x="-125" y="-72" width="250" height="76" fill="var(--color-sky)" />
      <rect x="-125" y="-46" width="250" height="50" fill="var(--color-hill-mid)" />
      <g transform="translate(-104 0)">
        <PlantArt kind="oak" size="large" seed={11} />
      </g>
      <GardenArt kind="flowerbed" seed={seed} size={size} still={still} {...viewOf(n)} />
      <g transform="translate(106 0)">
        <PlantArt kind="pine" size="medium" seed={5} />
      </g>
    </svg>
  );
}

/** Цветник крупно, без деревьев: рамка места 120 × 60 (или её часть — viewBox) с небольшим полем. */
function Big({ n, seed = 1, viewBox = '-66 -42 132 46' }: { n: number; seed?: number; viewBox?: string }) {
  const [x, y, w, h] = viewBox.split(' ');
  return (
    <svg class="gallery__garden" viewBox={viewBox} aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} fill="var(--color-hill-mid)" />
      <GardenArt kind="flowerbed" seed={seed} size={60} still {...viewOf(n)} />
    </svg>
  );
}

function Sample({ label, viewBox, children }: { label: string; viewBox: string; children: ComponentChildren }) {
  const [x, y, w, h] = viewBox.split(' ');
  return (
    <figure>
      <svg viewBox={viewBox} class="gallery__flower-pic" aria-hidden="true">
        <rect x={x} y={y} width={w} height={h} fill="var(--color-hill-mid)" />
        {children}
      </svg>
      <figcaption class="muted small">{label}</figcaption>
    </figure>
  );
}

const FLOWER_BOX = '-3.2 -3.4 6.4 6.4';
const BUSH_BOX = '-6.5 -10.5 13 11.5';
const EARLY = [1, 3, 5, 8];

/** Все посадки схемы по полосам, без повторов. */
function plantings(key: SchemeKey): Planting[] {
  const s = FLOWERBED_SCHEMES[key];
  const all = [...s.inner, ...s.mid, ...s.border];
  return all.filter((p, i) => all.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i);
}
const plantName = ([kind, color]: Planting) => `${KIND_NAMES[kind]} · ${BLOOMS[color].name}`;

export function FlowerbedSection() {
  const looks = seedsByLook();
  // У сида 1: ближняя правая клумба — схемы diagonal, ближняя левая — другой.
  const diagonal = flowerbedLook(1).diagonal;
  const other: SchemeKey = diagonal === 'blue' ? 'red' : 'blue';
  return (
    <section class="card">
      <h2>Цветник</h2>
      <p class="muted small">
        Переделка. Одна сине-красно-фиолетовая палитра: малиновый, розово-сиреневый, сиреневый, фиолетовый, васильковый, светло-голубой и белый;
        жёлтый — только серединки. Все цветы видны сбоку и чуть сверху и построены одинаково: заливка, тень того же цвета, светлая середина. Подход —
        куст: горка листвы и 2–3 цветка одного вида и цвета. Клумбы по диагонали засажены одной схемой — сине-сиреневой или красно-фиолетовой (какая
        пара какой — по сиду); у изгороди — белый бордюр из ромашек, ближе к середине — крупные цветы и колоски, виды чередуются пятнами. Каждый 5-й
        подход — редкий куст: роза, ирис, лилия по очереди, со звёздочкой. После 30 подходов кусты крупнее и ярче, между ними зелень с цветочками, на
        бортике — два вазона; полностью — к 60. Земля, песок и бортик светлее, лейка крашеная.
      </p>
      <p class="muted small">
        Правка 26.11: куст — букет, цвета примерно вдвое больше, чем зелени; головки вдвое крупнее, над низкой оборкой листвы, сверху — светлый
        блик. Малиновый, фиолетовый и васильковый светлее. До 6 кустов — полный размер, дальше постепенно мельче. Кусты появляются вразброс по всем
        четырём клумбам.
      </p>

      <h3 class="gallery__row-title">1, 3, 5, 8 подходов крупно</h3>
      <div class="gallery__gardens gallery__gardens--big">
        {EARLY.map((n) => (
          <figure key={n}>
            <Big n={n} />
            <figcaption class="muted small">
              {n} {n === 1 ? 'подход' : n < 5 ? 'подхода' : 'подходов'}
            </figcaption>
          </figure>
        ))}
      </div>

      <h3 class="gallery__row-title">По числу подходов (в размере долины, рядом дуб и сосна)</h3>
      <div class="gallery__gardens">
        {STAGES.map((n) => (
          <figure key={n}>
            <Tile n={n} />
            <figcaption class="muted small">
              {n === 0 ? 'пустой' : `${n} ${n === 1 ? 'подход' : n < 5 ? 'подхода' : 'подходов'}`}
              {n > 30 && ` · пышность ${Math.round(((n - 30) / 30) * 100)} %`}
            </figcaption>
          </figure>
        ))}
        <figure>
          <Tile n={30} still={false} />
          <figcaption class="muted small">30 подходов · с движением (фонтанчик, звёздочки)</figcaption>
        </figure>
      </div>

      <h3 class="gallery__row-title">Бортики и середина (у каждого цветника — по сиду), 12 подходов</h3>
      <div class="gallery__gardens">
        {looks.map((l) => (
          <figure key={l.seed}>
            <Tile n={12} seed={l.seed} />
            <figcaption class="muted small">
              {EDGE_NAMES[l.edge]} · {l.fountain ? 'фонтанчик' : 'солнечные часы'}
            </figcaption>
          </figure>
        ))}
      </div>

      <h3 class="gallery__row-title">Цветовые схемы: ближние клумбы крупно, 30 подходов</h3>
      <div class="gallery__gardens gallery__gardens--big">
        <figure>
          <Big n={30} viewBox="-53 -31 53 33" />
          <figcaption class="muted small">{FLOWERBED_SCHEMES[other].name}</figcaption>
        </figure>
        <figure>
          <Big n={30} viewBox="0 -31 53 33" />
          <figcaption class="muted small">{FLOWERBED_SCHEMES[diagonal].name}</figcaption>
        </figure>
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

      <h3 class="gallery__row-title">Цветы по отдельности</h3>
      {(['blue', 'red'] as const).map((key) => (
        <div key={key}>
          <p class="muted small">{FLOWERBED_SCHEMES[key].name} схема</p>
          <div class="gallery__flowers">
            {plantings(key).map((p) => (
              <Sample key={p.join()} label={plantName(p)} viewBox={FLOWER_BOX}>
                <FlowerSample kind={p[0]} color={p[1]} />
              </Sample>
            ))}
          </div>
        </div>
      ))}
      <p class="muted small">Редкие</p>
      <div class="gallery__flowers">
        {RARE_NAMES.map((name, i) => (
          <Sample key={name} label={name} viewBox={FLOWER_BOX}>
            <FlowerSample rare={i} />
          </Sample>
        ))}
      </div>

      <h3 class="gallery__row-title">Кусты</h3>
      {(['blue', 'red'] as const).map((key) => (
        <div key={key}>
          <p class="muted small">{FLOWERBED_SCHEMES[key].name} схема</p>
          <div class="gallery__flowers">
            {plantings(key).map((p) => (
              <Sample key={p.join()} label={plantName(p)} viewBox={BUSH_BOX}>
                <BushSample plant={p} />
              </Sample>
            ))}
          </div>
        </div>
      ))}
      <p class="muted small">Редкие</p>
      <div class="gallery__flowers">
        {RARE_NAMES.map((name, i) => (
          <Sample key={name} label={name} viewBox={BUSH_BOX}>
            <BushSample plant={['aster', 'white']} rare={i} />
          </Sample>
        ))}
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-flowerbed-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-flowerbed-style' });
style.textContent = `
  .gallery__gardens { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .gallery__gardens--big { grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); }
  .gallery__garden { border-radius: 10px; }
  .gallery__flowers { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 8px; }
  .gallery .gallery__flower-pic { width: 180px; border-radius: 8px; margin: 0 auto; }
`;
document.head.append(style);
