// Галерея: семь веток фазы 2 — цвета (чипы и записки) и растения новых веток в трёх размерах.

import { BRANCHES, type PlantKind, type PlantSize } from '../model/types';
import { BranchChip } from '../ui/common';
import { BRANCH_NAMES } from '../ui/labels';
import { PlantArt } from '../ui/valley/plant-art';

const SIZES: PlantSize[] = ['small', 'medium', 'large'];
const SIZE_NAMES: Record<PlantSize, string> = { small: 'короткое', medium: '10–15 мин', large: '25+ мин' };

const NEW_PLANTS: { kind: PlantKind; label: string }[] = [
  { kind: 'birch', label: 'Зов — берёза' },
  { kind: 'flax', label: 'Нити — лён' },
  { kind: 'hazel', label: 'Ремесло — орешник' },
];

/** Растение на кусочке травы, как в долине; крупнее, чем в долине. */
function PlantTile({ kind, size, seed }: { kind: PlantKind; size: PlantSize; seed: number }) {
  return (
    <svg class="gallery__tree" viewBox="-24 -46 48 50" aria-hidden="true">
      <rect x="-24" y="-46" width="48" height="46" fill="var(--color-sky)" />
      <rect x="-24" y="0" width="48" height="4" fill="var(--color-hill-mid)" />
      <PlantArt kind={kind} size={size} seed={seed} />
    </svg>
  );
}

export function BranchesSection() {
  return (
    <section class="card">
      <h2>Семь веток</h2>
      <div class="gallery__chips">
        {BRANCHES.map((b) => (
          <BranchChip key={b} branch={b} />
        ))}
      </div>
      <div class="gallery__inks">
        {BRANCHES.map((b) => (
          <span key={b} class={`task--${b} gallery__ink`}>
            <i class="gallery__pin" />
            {BRANCH_NAMES[b]}
          </span>
        ))}
      </div>
      {NEW_PLANTS.map(({ kind, label }) => (
        <div key={kind}>
          <h3 class="gallery__row-title">{label}</h3>
          <div class="gallery__grid gallery__grid--three">
            {SIZES.map((size, i) => (
              <figure key={size}>
                <PlantTile kind={kind} size={size} seed={[11, 47, 2026][i]!} />
                <figcaption class="muted small">{SIZE_NAMES[size]}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
