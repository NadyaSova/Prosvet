// Окно подтверждения в стиле приложения вместо confirm() браузера
// (у того в заголовке всегда адрес сайта). Вызов: `if (await ask('…')) …`.

import { useEffect, useRef, useState } from 'preact/hooks';

type Options = {
  /** Надпись на кнопке согласия. */
  ok?: string;
  /** Надпись на кнопке отказа. */
  cancel?: string;
  /** Кнопка согласия красная: действие что-то удаляет. */
  danger?: boolean;
};

type Request = Options & { text: string; resolve: (yes: boolean) => void };

let show: ((r: Request) => void) | null = null;

/** Спросить подтверждение. Промис вернёт true, если нажали кнопку согласия. */
export function ask(text: string, options: Options = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...options, text, resolve });
    else resolve(window.confirm(text)); // окно ещё не смонтировано — запасной путь
  });
}

/** Одно окно на всё приложение; монтируется рядом с <App />. */
export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    show = (r) => {
      setRequest((prev) => {
        prev?.resolve(false);
        return r;
      });
    };
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (request && !d.open) d.showModal();
    if (!request && d.open) d.close();
  }, [request]);

  function answer(yes: boolean) {
    request?.resolve(yes);
    setRequest(null);
  }

  return (
    <dialog
      ref={dialogRef}
      class="confirm"
      onCancel={(e) => {
        e.preventDefault(); // Esc или «Назад» на Android — это «нет»
        answer(false);
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) answer(false); // нажали мимо окна
      }}
    >
      {request && (
        <div class="confirm__box">
          <p class="confirm__text">{request.text}</p>
          <div class="confirm__actions">
            <button type="button" class="button button--secondary" onClick={() => answer(false)}>
              {request.cancel ?? 'Нет'}
            </button>
            <button
              type="button"
              class={`button${request.danger ? ' button--danger' : ''}`}
              autoFocus
              onClick={() => answer(true)}
            >
              {request.ok ?? 'Да'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
