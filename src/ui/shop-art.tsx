// Картинки товаров лавки: те же рисунки, что в долине (растения, редкости, вещи лагеря), в маленькой рамке.

import type { SceneDecor } from '../logic/valley';
import type { Good } from '../logic/shop';
import { DECOR_ANCHORS } from '../logic/valley-district';
import { CampArt } from './valley/camp-art';
import { DecorArt } from './valley/decor-art';
import { PlantArt } from './valley/plant-art';

/** Постоянный сид: картинка товара одна и та же. */
const SEED = 20261124;

function decorScene(kind: SceneDecor['kind']): SceneDecor {
  const a = DECOR_ANCHORS[kind][0];
  return { id: kind, kind, anchor: 0, seed: SEED, plantedAt: 0, x: a.x, y: a.y, layer: 0 };
}

/** Рамка вокруг рисунка в координатах долины. */
const DECOR_VIEW: Record<SceneDecor['kind'], (x: number, y: number) => string> = {
  deer: (x, y) => `${x - 17} ${y - 18} 30 21`,
  fireflies: (x, y) => `${x - 30} ${y - 34} 60 36`,
  rainbow: (x, y) => `${x - 74} ${y - 74} 148 78`,
};

export function GoodArt({ good }: { good: Good }) {
  let view: string;
  let art;
  switch (good.kind) {
    case 'plant':
      // Цветы низкие — рамка теснее, чтобы их было видно.
      view = good.id === 'flowers' ? '-9 -14 18 16' : '-15 -28 30 31';
      art = <PlantArt kind={good.id} size="medium" seed={SEED} />;
      break;
    case 'decor': {
      const d = decorScene(good.id);
      view = DECOR_VIEW[good.id](d.x, d.y);
      art = <DecorArt d={d} />;
      break;
    }
    case 'camp':
      view = '-23 -36 46 40';
      art = <CampArt item={{ kind: good.id, x: 0, y: 0 }} />;
      break;
  }
  return (
    <svg class={`good__art good__art--${good.kind}`} viewBox={view} aria-hidden="true">
      {art}
    </svg>
  );
}
