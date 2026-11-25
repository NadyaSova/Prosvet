// Экраны по адресу после #: #/settings, #/custom, #/loft, #/hero (героиня и ветки), #/journal (Летопись), #/valley (долина крупно), #/shop (лавка),
// #/bosses (боссы),
// #/note/<id> (записка, снятая с доски, поверх главного экрана).
// Главный экран — без #.
// Переход вперёд добавляет запись в историю, поэтому системная кнопка «Назад» на Android возвращает на главный.

import { useEffect, useState } from 'preact/hooks';

const EVENT = 'prosvet-route';

function current(): string {
  return location.hash.replace(/^#\/?/, '');
}

export function useRoute(): string {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const update = () => setRoute(current());
    addEventListener('hashchange', update);
    addEventListener('popstate', update);
    addEventListener(EVENT, update);
    return () => {
      removeEventListener('hashchange', update);
      removeEventListener('popstate', update);
      removeEventListener(EVENT, update);
    };
  }, []);
  return route;
}

/**
 * Экраны Летописи: #/journal — список, #/journal/drafts — список черновиков,
 * #/journal/new — новая запись, #/journal/edit/<id> — правка записи.
 */
export type JournalRoute = { view: 'list'; drafts: boolean } | { view: 'new' } | { view: 'edit'; id: string };

export function journalRoute(route: string): JournalRoute | null {
  if (route === 'journal') return { view: 'list', drafts: false };
  if (route === 'journal/drafts') return { view: 'list', drafts: true };
  if (route === 'journal/new') return { view: 'new' };
  if (route.startsWith('journal/edit/')) return { view: 'edit', id: decodeURIComponent(route.slice('journal/edit/'.length)) };
  return null;
}

/**
 * Лавка: #/shop — за золото, #/shop/stars — призы за звёзды и купоны, #/shop/prize/new — новый приз,
 * #/shop/prize/<id> — правка приза, #/shop/coupon — свой купон, #/coupon/<id> — купон во весь экран.
 */
export type ShopRoute =
  | { view: 'gold' }
  | { view: 'stars' }
  | { view: 'prize'; id: string | null }
  | { view: 'own' }
  | { view: 'coupon'; id: string };

export function shopRoute(route: string): ShopRoute | null {
  if (route === 'shop') return { view: 'gold' };
  if (route === 'shop/stars') return { view: 'stars' };
  if (route === 'shop/prize/new') return { view: 'prize', id: null };
  if (route.startsWith('shop/prize/')) return { view: 'prize', id: decodeURIComponent(route.slice('shop/prize/'.length)) };
  if (route === 'shop/coupon') return { view: 'own' };
  if (route.startsWith('coupon/')) return { view: 'coupon', id: decodeURIComponent(route.slice('coupon/'.length)) };
  return null;
}

/**
 * Боссы: #/bosses — список, #/bosses/new — новый босс: свой или шаблон, #/bosses/new/own — свой,
 * #/bosses/new/<шаблон> — из шаблона, #/boss/<id> — босс (во время подхода — секундомер).
 */
export type BossRoute = { view: 'list' } | { view: 'new' } | { view: 'form'; template: string | null } | { view: 'boss'; id: string };

export function bossRoute(route: string): BossRoute | null {
  if (route === 'bosses') return { view: 'list' };
  if (route === 'bosses/new') return { view: 'new' };
  if (route === 'bosses/new/own') return { view: 'form', template: null };
  if (route.startsWith('bosses/new/')) return { view: 'form', template: decodeURIComponent(route.slice('bosses/new/'.length)) };
  if (route.startsWith('boss/')) return { view: 'boss', id: decodeURIComponent(route.slice('boss/'.length)) };
  return null;
}

/** Долина крупно: #/valley; #/valley/plant/<семя> — сразу выбор места для этого семени. */
export function valleyRoute(route: string): { choosing?: string } | null {
  if (route === 'valley') return {};
  if (route.startsWith('valley/plant/')) return { choosing: decodeURIComponent(route.slice('valley/plant/'.length)) };
  return null;
}

export function go(path: string): void {
  history.pushState({ prosvet: true }, '', `#/${path}`);
  dispatchEvent(new Event(EVENT));
}

/** Сменить экран без новой записи в истории — например, вкладку лавки: «Назад» всё равно ведёт на главный. */
export function replaceRoute(path: string): void {
  history.replaceState(history.state, '', `#/${path}`);
  dispatchEvent(new Event(EVENT));
}

/** Записка, снятая с доски: #/note/<id задания>. Под ней — главный экран. */
export function noteRoute(route: string): string | null {
  return route.startsWith('note/') ? decodeURIComponent(route.slice('note/'.length)) : null;
}

/**
 * На главный экран, и уже там — fn. Шаг назад по истории идёт не сразу, поэтому fn ждёт его:
 * иначе переход, который сделает fn (например, в Летопись), отменился бы этим шагом назад.
 */
export function goHomeThen(fn: () => void): void {
  if (!current()) {
    fn();
  } else if ((history.state as { prosvet?: boolean } | null)?.prosvet) {
    addEventListener('popstate', () => fn(), { once: true });
    history.back();
  } else {
    history.replaceState(null, '', location.pathname + location.search);
    dispatchEvent(new Event(EVENT));
    fn();
  }
}

/** На главный экран. Если пришли сюда переходом внутри приложения — шаг назад по истории. */
export function goHome(): void {
  if (!current()) return;
  if ((history.state as { prosvet?: boolean } | null)?.prosvet) {
    history.back();
  } else {
    history.replaceState(null, '', location.pathname + location.search);
    dispatchEvent(new Event(EVENT));
  }
}
