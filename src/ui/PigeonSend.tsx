// Жёрдочка с пятью голубями и отправка отклика: выбрала голубя → компания → «Отправить». SPEC.md §9.4.
// В голубятне и на экране награды Отклика («Отправила?», docs/phase2-plan.md §4.4).

import { useEffect, useRef, useState } from 'preact/hooks';
import { lookKey } from '../logic/pigeons';
import type { LoftState, PigeonLook } from '../model/types';
import { PIGEON_COLOR_NAMES, PIGEON_SIZE_NAMES } from './labels';
import { MessageScrollArt, PigeonArt } from './pigeon-art';

/**
 * Голубь в прямой позе иногда смотрит влево. Сторона выводится из места на жёрдочке и вида голубя,
 * поэтому не меняется при перерисовке и перезапуске, а у нового голубя на том же месте может быть другой.
 */
function facesLeft(look: PigeonLook, index: number): boolean {
  if (look.pose !== 'sit') return false;
  // Хэш FNV-1a. Простая сумма кодов не годится: её чётность зависит только от места.
  let h = 2166136261 ^ index;
  for (const ch of lookKey(look)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 15) & 1) === 1;
}

interface Props {
  loft: LoftState;
  onSend: (perchIndex: number, company: string) => void;
  /**
   * На записке экрана награды: всё «написано на бумаге» — поле — линия для письма, «Отмена» и
   * «Отправить голубя» — текст чернилами, а не дощечки. В голубятне — обычная форма.
   */
  inNote?: boolean;
}

export function PigeonSend({ loft, onSend, inNote = false }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const [company, setCompany] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Курсор в поле — каждый раз, когда выбран голубь. Атрибут autofocus браузер выполняет только раз за страницу.
  useEffect(() => {
    if (picked !== null) inputRef.current?.focus();
  }, [picked]);

  function send(e: Event) {
    e.preventDefault();
    if (picked === null || !company.trim()) return;
    // Сначала отпустить поле: клавиатура Android дописывает слово и закрывается. Если убрать поле с экрана,
    // пока в нём курсор и незаконченное слово, клавиатура может перестать вводить текст в следующее поле.
    inputRef.current?.blur();
    onSend(picked, company.trim());
    setPicked(null);
    setCompany('');
  }

  return (
    <>
      <div class="perch">
        {loft.perch.map((look, i) => (
          <button
            type="button"
            key={`${i}-${look.pose}-${look.size}-${look.color}`}
            class={`perch__pigeon ${picked === i ? 'perch__pigeon--picked' : ''}`}
            aria-label={`Голубь: ${PIGEON_COLOR_NAMES[look.color]}, ${PIGEON_SIZE_NAMES[look.size]}`}
            aria-pressed={picked === i}
            onClick={() => setPicked(picked === i ? null : i)}
          >
            <PigeonArt class="perch__art" look={look} mirrored={facesLeft(look, i)} />
            {picked === i && <MessageScrollArt class="perch__scroll" />}
          </button>
        ))}
      </div>
      {picked !== null && (
        <form class="form loft__send" onSubmit={send}>
          <label class="field">
            <span class="field__label">Куда летит голубь?</span>
            <input
              type="text"
              class={inNote ? 'ink-input' : 'input'}
              placeholder="Название компании"
              ref={inputRef}
              value={company}
              onInput={(e) => setCompany(e.currentTarget.value)}
            />
          </label>
          {inNote ? (
            <div class="ink-actions">
              <button type="button" class="ink-button ink-button--quiet" onClick={() => setPicked(null)}>
                Отмена
              </button>
              <button type="submit" class="ink-button ink-actions__main" disabled={!company.trim()}>
                Отправить голубя
              </button>
            </div>
          ) : (
            <div class="task__actions">
              <button type="submit" class="button" disabled={!company.trim()}>
                Отправить
              </button>
              <button type="button" class="link-button" onClick={() => setPicked(null)}>
                Отмена
              </button>
            </div>
          )}
        </form>
      )}
    </>
  );
}
