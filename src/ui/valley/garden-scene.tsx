// Место бесконечного босса в долине (docs/phase2-plan.md §5.3): сам рисунок (garden-art.tsx) по числу элементов
// из модели (sceneOf, gardenView).
//
// Только что изменившееся (fresh): новый босс — пустое место проявляется; подход — новый элемент проявляется
// поверх прежнего вида (особый элемент, пышность — так же). При «уменьшить движение» — сразу конечный вид.

import { useEffect, useState } from 'preact/hooks';
import type { GardenView } from '../../logic/bosses';
import type { SceneGarden } from '../../logic/valley';
import { GardenArt } from './garden-art';
import { moves } from './landmark-art';

/** Сколько длится проявление нового элемента вместе с задержкой (.decor--new в styles.css). */
const REVEAL_MS = 2600;

function Art({ g, view }: { g: SceneGarden; view: GardenView }) {
  return <GardenArt kind={g.kind} seed={g.seed} size={g.size} count={view.elements} special={view.specials} bloom={view.bloom} />;
}

export function ValleyGardenArt({ g, fresh }: { g: SceneGarden; fresh: boolean }) {
  const appear = fresh && g.sessions === 0;
  // Прежний вид лежит снизу, пока поверх проявляется новый: элементы стоят на своих местах, поэтому видно
  // только, как появляется новый. Потом прежний убирается — два рисунка с движением тяжелы для телефона.
  const [under, setUnder] = useState(() => fresh && g.before !== null && moves());
  useEffect(() => {
    if (!under) return;
    const id = setTimeout(() => setUnder(false), REVEAL_MS);
    return () => clearTimeout(id);
  }, [under]);
  return (
    <g transform={`translate(${g.x} ${g.y})`} class={appear ? 'decor--new' : undefined}>
      {under && g.before && <Art g={g} view={g.before} />}
      <g class={under ? 'decor--new' : undefined}>
        <Art g={g} view={g.view} />
      </g>
    </g>
  );
}
