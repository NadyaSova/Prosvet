// Строка «Семя рябины и ещё 2 — Посадить» (для редкостей — «Добавить в долину»): на главном экране под панорамой
// и на экране «Долина». Семя или саженец сажается на место, которое выбирает пользователь (onChoose);
// редкость встаёт на своё место сама (onPlant). Нечего сажать — строки нет.

import { canPlantItem, isPlantItem } from '../../logic/valley';
import type { ValleyState } from '../../model/types';
import { itemName } from '../labels';

interface Props {
  valley: ValleyState;
  inventory: readonly string[];
  /** Поставить редкость. */
  onPlant: (item: string) => void;
  /** Выбрать место для семени или саженца. */
  onChoose: (item: string) => void;
  class?: string;
}

export function PlantRow({ valley, inventory, onPlant, onChoose, class: cls }: Props) {
  const plantable = inventory.find((item) => canPlantItem(valley, item));
  if (!plantable) return null;
  const waiting = inventory.length - 1;
  const plant = isPlantItem(plantable);
  return (
    <div class={cls ? `plant-row ${cls}` : 'plant-row'}>
      <span class="small">
        {itemName(plantable)}
        {waiting > 0 && <span class="muted"> и ещё {waiting}</span>}
      </span>
      <button type="button" class="link-button" onClick={() => (plant ? onChoose(plantable) : onPlant(plantable))}>
        {plant ? 'Посадить' : 'Добавить в долину'}
      </button>
    </div>
  );
}
