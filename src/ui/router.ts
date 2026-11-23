// Экраны по адресу после #: #/settings, #/custom, #/loft, #/journal (Летопись), #/valley (долина крупно). Главный экран — без #.
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

export function go(path: string): void {
  history.pushState({ prosvet: true }, '', `#/${path}`);
  dispatchEvent(new Event(EVENT));
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
