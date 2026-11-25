// Разделы на главном экране: четыре плитки в ряд — иконка и под ней название.
// Число в кружке: боссы в работе, голуби в пути, купоны ждут выдачи. «Записать» — только на экране Летописи.

import { go } from './router';
import { BossesIcon, ChronicleIcon, LoftIcon, ShopIcon } from './section-icons';

function Badge({ n, label }: { n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span class="section-tile__badge" aria-label={label}>
      {n}
    </span>
  );
}

export function SectionTiles({ bosses, pigeonsInFlight, coupons }: { bosses: number; pigeonsInFlight: number; coupons: number }) {
  return (
    <nav class="sections" aria-label="Разделы">
      <div class="section-tile section-tile--chronicle">
        <button type="button" class="section-tile__open" onClick={() => go('journal')}>
          <ChronicleIcon class="section-tile__icon" />
          <span class="section-tile__name">Летопись</span>
        </button>
      </div>
      <div class="section-tile section-tile--bosses">
        <button type="button" class="section-tile__open" onClick={() => go('bosses')}>
          <BossesIcon class="section-tile__icon" />
          <span class="section-tile__name">Боссы</span>
        </button>
        <Badge n={bosses} label={`В работе: ${bosses}`} />
      </div>
      <div class="section-tile section-tile--loft">
        <button type="button" class="section-tile__open" onClick={() => go('loft')}>
          <LoftIcon class="section-tile__icon" />
          <span class="section-tile__name">Голубятня</span>
        </button>
        <Badge n={pigeonsInFlight} label={`В пути: ${pigeonsInFlight}`} />
      </div>
      <div class="section-tile section-tile--shop">
        <button type="button" class="section-tile__open" onClick={() => go('shop')}>
          <ShopIcon class="section-tile__icon" />
          <span class="section-tile__name">Лавка</span>
        </button>
        <Badge n={coupons} label={`Купонов ждут выдачи: ${coupons}`} />
      </div>
    </nav>
  );
}
