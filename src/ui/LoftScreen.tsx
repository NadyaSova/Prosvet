// Голубятня: плащ из перьев, жёрдочка с пятью голубями, голуби в пути и вернувшиеся. SPEC.md §9.4.

import { useEffect, useRef, useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import { canLateInvite, cloakView, daysInFlight, feathersOf, lookKey } from '../logic/pigeons';
import type { LoftState, Pigeon, PigeonLook } from '../model/types';
import { CloakArt } from './cloak-art';
import { BackBar } from './common';
import { dateText, daysText, feathersText, plural } from './format';
import { PIGEON_COLOR_NAMES, PIGEON_SIZE_NAMES } from './labels';
import { FeatherArt, MessageScrollArt, PigeonArt } from './pigeon-art';
import { ask } from './confirm';

interface Props {
  pigeons: readonly Pigeon[];
  loft: LoftState;
  now: number;
  onSend: (perchIndex: number, company: string) => void;
  onAnswer: (id: string, outcome: 'rejected' | 'invited') => void;
  onLateInvite: (id: string) => void;
}

function outcomeText(p: Pigeon): string {
  if (p.outcome === 'invited') return 'позвали дальше — золотое перо';
  const base = p.outcome === 'silence' ? `${daysText(BALANCE.pigeons.returnAfterDays)} тишины — перо` : 'перо';
  return p.lateInvite ? `${base}, а потом позвали — и золотое` : base;
}

function flightText(p: Pigeon, now: number): string {
  const d = daysInFlight(p, now);
  return d === 0 ? 'улетел сегодня' : `с ${dateText(p.sentAt)} · ${daysText(d)} в пути`;
}

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

export function LoftScreen({ pigeons, loft, now, onSend, onAnswer, onLateInvite }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const [company, setCompany] = useState('');
  const [answering, setAnswering] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const feathers = feathersOf(pigeons);
  const cloak = cloakView(feathers.length);
  const flying = pigeons.filter((p) => p.status === 'flying');
  const returned = pigeons
    .filter((p) => p.status === 'returned')
    .sort((a, b) => (b.returnedAt ?? 0) - (a.returnedAt ?? 0));

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

  async function lateInvite(p: Pigeon) {
    if (await ask(`«${p.company}» всё-таки позвали дальше? Голубь принесёт ещё и золотое перо.`, { ok: 'Да, позвали', cancel: 'Нет' })) onLateInvite(p.id);
  }

  return (
    <main class="screen loft">
      <BackBar title="Голубятня" />

      <section class="card cloak">
        <CloakArt class="cloak__art" feathers={feathers} stage={cloak.stage} />
        <div class="cloak__info">
          <div class="hero__title">{cloak.title ?? 'Странница'}</div>
          <div class="small">{cloak.feathers > 0 ? `В плаще ${feathersText(cloak.feathers)}` : 'Плащ ждёт первого пера'}</div>
          <div class="muted small">
            {cloak.next
              ? `До титула «${cloak.next.title}» — ещё ${feathersText(cloak.next.feathers - cloak.feathers)}`
              : 'Все пороги плаща пройдены'}
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Жёрдочка</h2>
        <p class="muted small loft__hint">Отправила отклик? Выбери голубя — он отнесёт его.</p>
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
                class="input"
                placeholder="Название компании"
                ref={inputRef}
                value={company}
                onInput={(e) => setCompany(e.currentTarget.value)}
              />
            </label>
            <div class="task__actions">
              <button type="submit" class="button" disabled={!company.trim()}>
                Отправить
              </button>
              <button type="button" class="link-button" onClick={() => setPicked(null)}>
                Отмена
              </button>
            </div>
          </form>
        )}
      </section>

      <section class="card">
        <h2>В пути{flying.length > 0 && <span class="muted"> · {flying.length}</span>}</h2>
        {flying.length === 0 && <p class="muted small loft__hint">Сейчас никто не летит.</p>}
        {flying.map((p) => (
          <article class="pigeon-row" key={p.id}>
            <PigeonArt class="pigeon-row__art" look={p.look} />
            <div class="pigeon-row__body">
              <div class="pigeon-row__company">{p.company}</div>
              <div class="muted small">{flightText(p, now)}</div>
              {answering === p.id ? (
                <div class="pigeon-row__answer">
                  <span class="small">Что ответили?</span>
                  <div class="choices">
                    <button type="button" class="choice" onClick={() => { setAnswering(null); onAnswer(p.id, 'invited'); }}>
                      Позвали дальше
                    </button>
                    <button type="button" class="choice" onClick={() => { setAnswering(null); onAnswer(p.id, 'rejected'); }}>
                      Отказали
                    </button>
                    <button type="button" class="link-button" onClick={() => setAnswering(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" class="link-button pigeon-row__back" onClick={() => setAnswering(p.id)}>
                  Голубь вернулся
                </button>
              )}
            </div>
          </article>
        ))}
        {flying.length > 0 && (
          <p class="muted small loft__hint">
            Если ответа не будет {BALANCE.pigeons.returnAfterDays}{' '}
            {plural(BALANCE.pigeons.returnAfterDays, ['день', 'дня', 'дней'])}, голубь вернётся сам и принесёт перо.
          </p>
        )}
      </section>

      {returned.length > 0 && (
        <details class="card returned">
          <summary>
            <h2>Вернулись · {returned.length}</h2>
          </summary>
          {returned.map((p) => (
            <article class="pigeon-row" key={p.id}>
              <FeatherArt
                class="pigeon-row__feather"
                color={p.outcome === 'invited' ? 'gold' : p.look.color}
                size={p.look.size}
              />
              <div class="pigeon-row__body">
                <div class="pigeon-row__company">{p.company}</div>
                <div class="muted small">{outcomeText(p)}</div>
                {canLateInvite(p) && (
                  <button type="button" class="link-button pigeon-row__back" onClick={() => lateInvite(p)}>
                    Всё-таки позвали
                  </button>
                )}
              </div>
            </article>
          ))}
        </details>
      )}
    </main>
  );
}
