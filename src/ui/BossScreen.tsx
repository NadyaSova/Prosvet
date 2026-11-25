// Экран босса (docs/phase2-plan.md §5): рисунок (сооружение под туманом или место), ветка, заметка,
// «Начать подход», журнал подходов с заметками. Конечный — «Победа» с необязательной заметкой и «Отпустить»;
// бесконечный — «Свернуть в архив». Во время подхода вместо этого экрана — секундомер (StopwatchScreen).

import { useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import { daysSinceLast, fogDensity, gardenView, totalMinutes } from '../logic/bosses';
import type { Boss } from '../model/types';
import { BossArt, landmarkVisibility } from './boss-art';
import { BackBar, BranchChip } from './common';
import { ask } from './confirm';
import { agoText, dateText, durationText, plural } from './format';
import { GARDEN_ELEMENTS } from './labels';
import { GARDEN_NAMES } from './valley/garden-art';
import { LANDMARK_NAMES } from './valley/landmark-art';

/** Подпись под рисунком: что с туманом или сколько выросло в месте. */
function placeText(boss: Boss): string {
  if (boss.kind === 'endless' && boss.place.garden) {
    const v = gardenView(boss);
    const name = GARDEN_NAMES[boss.place.garden];
    if (v.elements === 0) return `${name}. Пока пусто — первый подход что-нибудь сюда добавит.`;
    const items = `${v.elements} ${plural(v.elements, GARDEN_ELEMENTS[boss.place.garden])}`;
    return `${name} · ${items}${v.bloom > 0 ? ' · место полно и становится пышнее' : ''}`;
  }
  if (boss.status === 'won') return `Из тумана вышло: ${boss.place.landmark ? LANDMARK_NAMES[boss.place.landmark] : 'сооружение'}.`;
  if (boss.status === 'released') return 'Отпущен: туман тихо ушёл, место освободилось.';
  if (boss.sessions.length === 0) return 'Под плотным туманом что-то есть. Каждый подход делает туман тоньше.';
  return landmarkVisibility(fogDensity(boss)) >= 0.4 ? 'Сквозь туман проступает силуэт.' : 'Туман стал тоньше. Скоро проступит силуэт.';
}

/** Чем закончился босс — строка над журналом. */
function endedText(boss: Boss): string | null {
  const when = boss.endedAt ? ` ${dateText(boss.endedAt)}` : '';
  if (boss.status === 'won') return `Победа${when}.`;
  if (boss.status === 'released') return `Отпущен${when}. Награды за подходы остались.`;
  if (boss.status === 'archived') return `В архиве${boss.endedAt ? ` с ${dateText(boss.endedAt)}` : ''}. Место и всё, что выросло, остались в долине.`;
  return null;
}

/** Победа: записка с необязательной заметкой — например, разбор интервью. */
function VictoryNote({ boss, onWin, onCancel }: { boss: Boss; onWin: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState('');
  return (
    <form
      class={`reward-note boss__win task--${boss.branch}`}
      onSubmit={(e) => {
        e.preventDefault();
        onWin(note);
      }}
    >
      <p class="reward-note__question">Победа над боссом?</p>
      <p class="reward-note__hint small">Туман рассеется, сооружение останется в долине. Можно оставить заметку — например, что спрашивали и что подтянуть.</p>
      <textarea
        class="ink-area"
        rows={3}
        maxLength={BALANCE.bosses.victoryNoteMaxLength}
        value={note}
        onInput={(e) => setNote(e.currentTarget.value)}
        aria-label="Заметка о победе"
      />
      <div class="ink-actions">
        <button type="button" class="ink-button ink-button--quiet" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" class="ink-button ink-actions__main">
          Объявить победу
        </button>
      </div>
    </form>
  );
}

interface Props {
  boss: Boss;
  now: number;
  /** Почему нельзя начать подход: идёт таймер задания или подход к другому боссу. null — можно. */
  blocked: string | null;
  onStart: () => void;
  onWin: (note: string) => void;
  onRelease: () => void;
  onArchive: () => void;
}

export function BossScreen({ boss, now, blocked, onStart, onWin, onRelease, onArchive }: Props) {
  const [winning, setWinning] = useState(false);
  const active = boss.status === 'active';
  const n = boss.sessions.length;
  const ended = endedText(boss);

  async function release() {
    if (await ask(`Отпустить «${boss.title}»? Туман тихо уйдёт, награды за подходы останутся.`, { ok: 'Отпустить', cancel: 'Не сейчас' })) onRelease();
  }

  async function archive() {
    if (await ask(`Свернуть «${boss.title}» в архив? Место и всё, что выросло, останутся в долине.`, { ok: 'В архив', cancel: 'Не сейчас' })) onArchive();
  }

  return (
    <main class={`screen boss task--${boss.branch}`}>
      <BackBar title={boss.title} />

      <section class="card boss__picture">
        {boss.status !== 'released' && <BossArt boss={boss} class="boss__art" />}
        <p class="muted small boss__place">{placeText(boss)}</p>
      </section>

      <div class="boss__meta">
        <BranchChip branch={boss.branch} />
        <span class="muted small">{boss.kind === 'finite' ? 'конечный' : 'бесконечный'}</span>
      </div>

      {boss.note && <p class="boss__note">{boss.note}</p>}

      <p class="small boss__stats">
        {n === 0
          ? 'Подходов ещё не было.'
          : `${n} ${plural(n, ['подход', 'подхода', 'подходов'])} · всего ${durationText(totalMinutes(boss))} · последний ${agoText(daysSinceLast(boss, now)!)}`}
      </p>

      {ended && <p class="boss__ended">{ended}</p>}
      {boss.victoryNote && <p class="boss__note boss__note--victory">{boss.victoryNote}</p>}

      {active && (
        <div class="boss__actions">
          <button type="button" class="button" disabled={blocked !== null} onClick={onStart}>
            Начать подход
          </button>
          {blocked && <p class="muted small boss__blocked">{blocked}</p>}
          {boss.kind === 'finite' &&
            (winning ? (
              <VictoryNote boss={boss} onWin={onWin} onCancel={() => setWinning(false)} />
            ) : (
              <div class="boss__end-links">
                <button type="button" class="link-button" onClick={() => setWinning(true)}>
                  Победа
                </button>
                <button type="button" class="link-button" onClick={release}>
                  Отпустить
                </button>
              </div>
            ))}
          {boss.kind === 'endless' && (
            <div class="boss__end-links">
              <button type="button" class="link-button" onClick={archive}>
                Свернуть в архив
              </button>
            </div>
          )}
        </div>
      )}

      {n > 0 && (
        <section class="card">
          <h2>Подходы · {n}</h2>
          <ol class="boss__sessions">
            {[...boss.sessions].reverse().map((s) => (
              <li key={s.startedAt} class="boss__session">
                <span class="small">
                  {dateText(s.startedAt)} <span class="muted">· {durationText(s.minutes)}</span>
                </span>
                {s.note && <span class="boss__session-note">{s.note}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
