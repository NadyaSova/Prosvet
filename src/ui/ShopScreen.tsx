// Лавка (#/shop, #/shop/stars). SPEC.md §9.3, §9.5.
// За золото — саженцы, редкости и вещи лагеря. За звёзды — призы, которые пользователь заводит сама,
// «свой купон» и история купонов.

import { useState } from 'preact/hooks';
import { couponHistory, GOODS, goodStatus, type Good, type GoodStatus } from '../logic/shop';
import type { Coupon, PlayerState, ShopState, ValleyState } from '../model/types';
import { BackBar } from './common';
import { dateText, plural } from './format';
import { goodLabel } from './labels';
import { go, replaceRoute } from './router';
import { GoodArt } from './shop-art';

interface Props {
  tab: 'gold' | 'stars';
  player: PlayerState;
  valley: ValleyState;
  shop: ShopState;
  /** Купить за золото. Возвращает false, если не вышло. */
  onBuyGood: (good: Good) => boolean;
  onBuyPrize: (prizeId: string) => void;
}

const SECTIONS: { kind: Good['kind']; title: string; hint: string }[] = [
  { kind: 'plant', title: 'Саженцы', hint: 'Ждут в запасе, пока не посадишь. Место выбираешь сама.' },
  { kind: 'decor', title: 'Редкости', hint: 'Сразу появляются в долине, на своих местах.' },
  { kind: 'camp', title: 'Лагерь', hint: 'Вещи у костра, каждая — одна.' },
];

function statusText(status: GoodStatus, good: Good, gold: number): string | null {
  switch (status) {
    case 'ok':
      return null;
    case 'gold':
      return `Не хватает ${good.price - gold} золота`;
    case 'full':
      return 'Долина полна: растению негде расти';
    case 'max':
      return 'Все места для них уже заняты';
    case 'owned':
      return 'Уже стоит в лагере';
  }
}

const starsText = (n: number) => `${n} ${plural(n, ['звезда', 'звезды', 'звёзд'])}`;

function CouponRow({ c }: { c: Coupon }) {
  return (
    <button type="button" class={`coupon-row ${c.status === 'given' ? 'coupon-row--given' : ''}`} onClick={() => go(`coupon/${encodeURIComponent(c.id)}`)}>
      <span class="coupon-row__icon" aria-hidden="true">
        {c.icon ?? '★'}
      </span>
      <span class="coupon-row__body">
        <span class="coupon-row__title">{c.title}</span>
        <span class="muted small">
          {c.status === 'given' ? `выдан ${dateText(c.givenAt ?? c.boughtAt)}` : `куплен ${dateText(c.boughtAt)} · ждёт выдачи`}
        </span>
      </span>
      <span class="coupon-row__price">{c.price} ★</span>
    </button>
  );
}

export function ShopScreen({ tab, player, valley, shop, onBuyGood, onBuyPrize }: Props) {
  // Что только что купили — строка «Рябина в запасе — Посадить» или «Олень уже у воды — Посмотреть».
  const [bought, setBought] = useState<Good | null>(null);
  const history = couponHistory(shop.coupons);

  function buy(good: Good) {
    const name = goodLabel(good).name;
    if (!confirm(`Купить «${name}» за ${good.price} золота?`)) return;
    if (onBuyGood(good)) setBought(good);
  }

  function buyPrize(id: string, title: string, price: number) {
    if (confirm(`Купить «${title}» за ${starsText(price)}?`)) onBuyPrize(id);
  }

  return (
    <main class="screen shop">
      <BackBar title="Лавка" />

      <div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'gold'} class={tab === 'gold' ? 'tab tab--on' : 'tab'} onClick={() => replaceRoute('shop')}>
          За золото
        </button>
        <button type="button" role="tab" aria-selected={tab === 'stars'} class={tab === 'stars' ? 'tab tab--on' : 'tab'} onClick={() => replaceRoute('shop/stars')}>
          За звёзды
        </button>
      </div>

      <div class="wallet shop__wallet">
        <span class="wallet__item">
          <span class="wallet__gold" aria-hidden="true" /> {player.gold} золота
        </span>
        <span class="wallet__item">
          <span class="wallet__star" aria-hidden="true">★</span> {starsText(player.stars)}
        </span>
      </div>

      {tab === 'gold' ? (
        <>
          {bought && (
            <div class="notice" role="status">
              {bought.kind === 'plant' ? (
                <>
                  <p>{goodLabel(bought).name} — в запасе.</p>
                  <button type="button" class="link-button" onClick={() => go(`valley/plant/${bought.id}`)}>
                    Посадить
                  </button>
                </>
              ) : (
                <>
                  <p>{goodLabel(bought).name} — уже в долине.</p>
                  <button type="button" class="link-button" onClick={() => go('valley')}>
                    Посмотреть
                  </button>
                </>
              )}
            </div>
          )}
          {SECTIONS.map((s) => (
            <section class="card goods" key={s.kind}>
              <h2>{s.title}</h2>
              <p class="muted small goods__hint">{s.hint}</p>
              {GOODS.filter((g) => g.kind === s.kind).map((g) => {
                const status = goodStatus({ player, valley }, g);
                const label = goodLabel(g);
                const why = statusText(status, g, player.gold);
                return (
                  <div class="good" key={g.id}>
                    <GoodArt good={g} />
                    <div class="good__body">
                      <div class="good__name">{label.name}</div>
                      <div class="muted small">{why ?? label.note}</div>
                    </div>
                    <button
                      type="button"
                      class="button good__buy"
                      disabled={status !== 'ok'}
                      aria-label={`Купить: ${label.name}, ${g.price} золота`}
                      onClick={() => buy(g)}
                    >
                      <span class="wallet__gold" aria-hidden="true" /> {g.price}
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
        </>
      ) : (
        <>
          <section class="card prizes">
            <h2>Призы</h2>
            {shop.prizes.length === 0 ? (
              <p class="muted small">
                Придумай, чем себя порадовать, и назначь цену в звёздах. Например: «Массаж от мужа — 3 ★», «Вечер без домашних
                дел — 4 ★».
              </p>
            ) : (
              shop.prizes.map((p) => {
                const short = p.price - player.stars;
                return (
                  <div class="prize" key={p.id}>
                    <span class="prize__icon" aria-hidden="true">
                      {p.icon ?? '★'}
                    </span>
                    <div class="prize__body">
                      <div class="prize__title">{p.title}</div>
                      <div class="muted small">
                        {p.price} ★{short > 0 && ` · не хватает ${starsText(short)}`}
                        {' · '}
                        <button type="button" class="link-button prize__edit" onClick={() => go(`shop/prize/${encodeURIComponent(p.id)}`)}>
                          изменить
                        </button>
                      </div>
                    </div>
                    <button type="button" class="button prize__buy" disabled={short > 0} onClick={() => buyPrize(p.id, p.title, p.price)}>
                      Купить
                    </button>
                  </div>
                );
              })
            )}
            <div class="prizes__buttons">
              <button type="button" class="button button--secondary" onClick={() => go('shop/prize/new')}>
                Новый приз
              </button>
              <button type="button" class="button button--secondary" onClick={() => go('shop/coupon')}>
                Свой купон
              </button>
            </div>
            <p class="muted small prizes__hint">Свой купон — разовый: вписываешь, на что он, ставишь цену и сразу покупаешь.</p>
          </section>

          <section class="card coupons">
            <h2>Купоны</h2>
            {history.waiting.length === 0 && history.given.length === 0 && (
              <p class="muted small">Купленные купоны появятся здесь. Купон можно открыть во весь экран и показать мужу.</p>
            )}
            {history.waiting.map((c) => (
              <CouponRow key={c.id} c={c} />
            ))}
            {history.given.length > 0 && (
              <details class="coupons__given">
                <summary class="muted small">Выданные: {history.given.length}</summary>
                {history.given.map((c) => (
                  <CouponRow key={c.id} c={c} />
                ))}
              </details>
            )}
          </section>
        </>
      )}
    </main>
  );
}
