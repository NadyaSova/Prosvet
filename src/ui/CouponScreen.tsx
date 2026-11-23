// Купон во весь экран (#/coupon/<id>) — его показывают мужу. SPEC.md §9.5.
// Статус отмечает пользователь: «куплен» → «выдан»; отметку можно снять, если нажала по ошибке.

import type { Coupon } from '../model/types';
import { dateText, plural } from './format';
import { goHome } from './router';

interface Props {
  coupon: Coupon;
  onGiven: (given: boolean) => void;
}

export function CouponScreen({ coupon, onGiven }: Props) {
  const given = coupon.status === 'given';
  return (
    <main class={`screen coupon ${given ? 'coupon--given' : ''}`}>
      <button type="button" class="icon-button coupon__close" aria-label="Закрыть" onClick={goHome}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <article class="coupon__ticket">
        <div class="coupon__kicker">Купон</div>
        <div class="coupon__icon" aria-hidden="true">
          {coupon.icon ?? '★'}
        </div>
        <h1 class="coupon__title">{coupon.title}</h1>
        <div class="coupon__price">
          {Array.from({ length: Math.min(coupon.price, 10) }, (_, i) => (
            <span key={i} aria-hidden="true">
              ★
            </span>
          ))}
          {coupon.price > 10 && <span> ×{coupon.price}</span>}
          <span class="visually-hidden">
            {coupon.price} {plural(coupon.price, ['звезда', 'звезды', 'звёзд'])}
          </span>
        </div>
        <p class="coupon__note">Заработано в долине. Предъявителю — выдать.</p>
        <div class="coupon__date">куплен {dateText(coupon.boughtAt)}</div>
        {given && <div class="coupon__stamp">Выдан {dateText(coupon.givenAt ?? coupon.boughtAt)}</div>}
      </article>

      {given ? (
        <button type="button" class="link-button" onClick={() => onGiven(false)}>
          Ещё не выдан — снять отметку
        </button>
      ) : (
        <button type="button" class="button coupon__give" onClick={() => onGiven(true)}>
          Отметить: выдан
        </button>
      )}
    </main>
  );
}
