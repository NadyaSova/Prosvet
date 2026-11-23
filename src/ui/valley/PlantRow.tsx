// Строка «Семя рябины и ещё 2 — Посадить» (для редкостей — «Добавить в долину»): на главном экране под панорамой
// и на экране «Долина». Место выбирает приложение. Нечего сажать — строки нет.

import { BALANCE } from '../../config/balance';
import { canPlantItem } from '../../logic/valley';
import type { ValleyState } from '../../model/types';
import { itemName } from '../labels';

interface Props {
  valley: ValleyState;
  inventory: readonly string[];
  onPlant: (item: string) => void;
  class?: string;
}

export function PlantRow({ valley, inventory, onPlant, class: cls }: Props) {
  const plantable = inventory.find((item) => canPlantItem(valley, item));
  if (!plantable) return null;
  const waiting = inventory.length - 1;
  return (
    <div class={cls ? `plant-row ${cls}` : 'plant-row'}>
      <span class="small">
        {itemName(plantable)}
        {waiting > 0 && <span class="muted"> и ещё {waiting}</span>}
      </span>
      <button type="button" class="link-button" onClick={() => onPlant(plantable)}>
        {(BALANCE.loot.seeds as readonly string[]).includes(plantable) ? 'Посадить' : 'Добавить в долину'}
      </button>
    </div>
  );
}
