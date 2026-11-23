// Галерея: иконки разделов главного экрана — крупно и ряд плиток, как на главном (с числами и без).

import { SectionTiles } from '../ui/SectionTiles';
import { ChronicleIcon, LoftIcon, ShopIcon } from '../ui/section-icons';

export function SectionIconsSection() {
  return (
    <section class="card">
      <h2>Иконки разделов</h2>
      <div class="gallery__shop">
        {[
          { Icon: ChronicleIcon, name: 'Летопись' },
          { Icon: LoftIcon, name: 'Голубятня' },
          { Icon: ShopIcon, name: 'Лавка' },
        ].map(({ Icon, name }) => (
          <figure key={name}>
            <Icon class="gallery__icon" />
            <figcaption class="muted small">{name}</figcaption>
          </figure>
        ))}
      </div>
      <h3 class="gallery__row-title">На главном экране (ширина телефона)</h3>
      <div class="gallery__phone">
        <SectionTiles pigeonsInFlight={0} coupons={0} />
      </div>
      <h3 class="gallery__row-title">С числами: 3 голубя в пути, 1 купон ждёт выдачи</h3>
      <div class="gallery__phone">
        <SectionTiles pigeonsInFlight={3} coupons={1} />
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-sections-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-sections-style' });
style.textContent = `
  .gallery .gallery__icon { width: 120px; height: 120px; }
  .gallery__phone { width: 380px; max-width: 100%; padding: 12px 16px; background: var(--color-sky); border-radius: 12px; }
  .gallery__phone svg.section-tile__icon { width: 60px; height: 60px; }
`;
document.head.append(style);
