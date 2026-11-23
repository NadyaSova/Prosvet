// Приз за звёзды (#/shop/prize/new, #/shop/prize/<id>) и «свой купон» (#/shop/coupon): название, цена, значок.
// Приз — шаблон: его можно покупать сколько угодно раз. Свой купон покупается сразу и в призы не попадает.

import { useEffect, useRef, useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import { cleanPrizeInput, type PrizeInput } from '../logic/shop';
import type { Prize } from '../model/types';
import { BackBar } from './common';
import { ask } from './confirm';
import { plural } from './format';

/** Значки на выбор. Необязательны. */
export const PRIZE_ICONS = ['💆', '🍽️', '🛋️', '🛁', '☕', '🍰', '🎬', '📚', '🌸', '🎁', '🌙', '🧺'];

interface Props {
  mode: 'prize' | 'own';
  /** Правка приза; нет — новый. */
  prize?: Prize;
  stars: number;
  onSave: (input: PrizeInput) => void;
  onDelete?: () => void;
}

export function PrizeScreen({ mode, prize, stars, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(prize?.title ?? '');
  const [price, setPrice] = useState(prize?.price ?? 2);
  const [icon, setIcon] = useState<string | undefined>(prize?.icon);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!prize) titleRef.current?.focus();
  }, []);

  const input = cleanPrizeInput({ title, price, icon });
  const own = mode === 'own';
  const short = own ? price - stars : 0;

  async function submit(e: Event) {
    e.preventDefault();
    if (!input || short > 0) return;
    // Сначала отпустить поле: клавиатура Android дописывает слово и закрывается до смены экрана.
    titleRef.current?.blur();
    if (own && !(await ask(`Купить «${input.title}» за ${input.price} ★?`, { ok: 'Купить', cancel: 'Не сейчас' }))) return;
    onSave(input);
  }

  const heading = own ? 'Свой купон' : prize ? 'Приз' : 'Новый приз';

  return (
    <main class="screen">
      <BackBar title={heading} />
      <form class="form" onSubmit={submit}>
        <label class="field">
          <span class="field__label">{own ? 'На что купон' : 'Что за приз'}</span>
          <input
            ref={titleRef}
            class="input"
            value={title}
            maxLength={80}
            placeholder={own ? 'Например: прогулка у моря вдвоём' : 'Например: массаж от мужа'}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </label>

        <div class="field">
          <span class="field__label">Цена в звёздах</span>
          <div class="stepper">
            <button type="button" class="icon-button" aria-label="Дешевле" disabled={price <= 1} onClick={() => setPrice(price - 1)}>
              −
            </button>
            <span class="stepper__value" aria-live="polite">
              {price} ★
            </span>
            <button
              type="button"
              class="icon-button"
              aria-label="Дороже"
              disabled={price >= BALANCE.shop.maxStars}
              onClick={() => setPrice(price + 1)}
            >
              +
            </button>
          </div>
          <span class="muted small">
            Сейчас у тебя {stars} {plural(stars, ['звезда', 'звезды', 'звёзд'])}.
            {own && short > 0 && ` Не хватает ${short}.`}
          </span>
        </div>

        <fieldset class="field">
          <legend class="field__label">Значок — если хочется</legend>
          <div class="icons">
            <button type="button" class={icon === undefined ? 'icon-pick icon-pick--on' : 'icon-pick'} aria-pressed={icon === undefined} onClick={() => setIcon(undefined)}>
              ★
            </button>
            {PRIZE_ICONS.map((i) => (
              <button type="button" key={i} class={icon === i ? 'icon-pick icon-pick--on' : 'icon-pick'} aria-pressed={icon === i} onClick={() => setIcon(i)}>
                {i}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="submit" class="button" disabled={!input || short > 0}>
          {own ? `Купить за ${price} ★` : 'Сохранить'}
        </button>
        {onDelete && (
          <button
            type="button"
            class="link-button entry-delete"
            onClick={async () => {
              if (await ask('Удалить приз? Купленные купоны останутся.', { ok: 'Удалить', cancel: 'Оставить', danger: true })) onDelete();
            }}
          >
            Удалить приз
          </button>
        )}
      </form>
    </main>
  );
}
