// Галерея: ива. Прежний рисунок (копия, для сравнения), четыре формы из src/ui/valley/plant-art.tsx
// и ряд ив, как в долине, где форму выбирает сид.

import { createRng, pickFrom, type Rng } from '../logic/rng';
import type { PlantSize } from '../model/types';
import { PlantArt, TREE_HEIGHT, vary, Willow, WILLOW_FORMS, type WillowForm } from '../ui/valley/plant-art';

/** Ива до правки — купол с прямыми прядями, для сравнения. */
function OldWillow({ h, rng }: { h: number; rng: Rng }) {
  const [crown, strand] = pickFrom(
    [
      ['#a9c785', '#8fb56f'],
      ['#9cbf7a', '#86ac66'],
      ['#b2cc8a', '#97ba74'],
    ],
    rng,
  );
  const rx = h * vary(rng, 0.3, 0.08);
  const top = -h;
  const base = -h * 0.66;
  const n = h > 20 ? 11 : 7;
  const w = Math.max(0.9, h * 0.05);
  const strands = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1) - 0.5;
    const sx = t * 2 * rx * 0.95;
    const ex = sx * vary(rng, 1.45, 0.1);
    const ey = -h * vary(rng, 0.14, 0.5);
    return `M${sx.toFixed(2)} ${base.toFixed(2)} Q${(sx * 1.35).toFixed(2)} ${((base + ey) / 2).toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  });
  return (
    <>
      <path d={`M0 0 L0 ${-h * 0.62} M0 ${-h * 0.4} L${-h * 0.1} ${-h * 0.6}`} stroke="#6b4a35" stroke-width={Math.max(1.4, h * 0.075)} stroke-linecap="round" />
      <path d={strands.join(' ')} stroke={strand} stroke-width={w} stroke-linecap="round" fill="none" />
      <path
        d={`M${-rx * 1.05} ${base} C${-rx * 1.05} ${top + h * 0.04} ${rx * 1.05} ${top + h * 0.04} ${rx * 1.05} ${base} Q0 ${base + h * 0.06} ${-rx * 1.05} ${base} Z`}
        fill={crown}
      />
    </>
  );
}

const SIZES: { size: PlantSize; name: string }[] = [
  { size: 'small', name: 'маленькая' },
  { size: 'medium', name: 'средняя' },
  { size: 'large', name: 'большая' },
];

/** Ива на кусочке травы, как в долине. form: 'old' — прежний рисунок, форма — она, null — форму выбирает сид. */
function WillowTile({ size, seed, form, small = false }: { size: PlantSize; seed: number; form: WillowForm | 'old' | null; small?: boolean }) {
  const rng = createRng(seed);
  const h = vary(rng, TREE_HEIGHT[size]);
  const art = form === 'old' ? <OldWillow h={h} rng={rng} /> : form ? <Willow h={h} rng={rng} form={form} /> : <PlantArt kind="willow" size={size} seed={seed} />;
  return (
    <svg class={`gallery__tree ${small ? 'gallery__willow-small' : ''}`} viewBox="-26 -48 52 52" aria-hidden="true">
      <rect x="-26" y="-48" width="52" height="48" fill="var(--color-sky)" />
      <rect x="-26" y="0" width="52" height="4" fill="var(--color-hill-mid)" />
      {art}
    </svg>
  );
}

export function WillowSection() {
  const rows: { title: string; form: WillowForm | 'old' }[] = [
    { title: 'Было', form: 'old' },
    ...WILLOW_FORMS.map((form, i) => ({ title: `Форма ${i + 1}: ${form.name}`, form })),
  ];
  return (
    <section class="card">
      <h2>Ива: было и четыре формы</h2>
      {rows.map(({ title, form }) => (
        <div key={title}>
          <h3 class="gallery__row-title">{title}</h3>
          <div class="gallery__willow-grid">
            {SIZES.map(({ size, name }) => (
              <figure key={size}>
                <WillowTile size={size} seed={47} form={form} />
                <figcaption class="muted small">{name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
      <h3 class="gallery__row-title">Как в долине: форму выбирает сид (средние, сиды 1–12)</h3>
      <div class="gallery__willow-row">
        {Array.from({ length: 12 }, (_, i) => (
          <WillowTile key={i} size="medium" seed={i + 1} form={null} small />
        ))}
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-willow-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-willow-style' });
style.textContent = `
  .gallery__willow-grid { display: grid; grid-template-columns: repeat(3, minmax(90px, 160px)); gap: 8px; margin-bottom: 12px; }
  .gallery__willow-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .gallery .gallery__willow-small { width: 64px; }
`;
document.head.append(style);
