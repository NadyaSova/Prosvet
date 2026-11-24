// Своё задание вне доски. Два режима:
// «Буду делать» — текст, ветка, длительность, таймер; по галочке сохраняется в «Мои задания» и попадает на доску.
// «Уже сделала» — дело без таймера засчитывается сразу: текст, ветка, сколько минут заняло.
// Там же мероприятие (митап, конференция, вебинар) — мгновенное задание Нитей с крупной наградой и звездой.

import { useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import { BRANCHES, TASK_MINUTES, type Branch, type TaskMinutes } from '../model/types';
import { BackBar } from './common';
import { BRANCH_NAMES } from './labels';

export interface CustomTaskInput {
  title: string;
  branch: Branch;
  minutes: TaskMinutes;
  save: boolean;
}

/** Уже сделанное: мероприятие или дело с веткой и минутами. */
export type DoneTaskInput =
  | { event: true; title: string }
  | { event: false; title: string; branch: Branch; minutes: TaskMinutes };

type Mode = 'plan' | 'done';

export function CustomTaskScreen({
  onStart,
  onDone,
}: {
  onStart: (input: CustomTaskInput) => void;
  onDone: (input: DoneTaskInput) => void;
}) {
  const [mode, setMode] = useState<Mode>('plan');
  const [title, setTitle] = useState('');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [minutes, setMinutes] = useState<TaskMinutes>(25);
  const [save, setSave] = useState(false);
  const [event, setEvent] = useState(false);

  const isEvent = mode === 'done' && event;
  const ready = title.trim() !== '' && (isEvent || branch !== null);

  function submit() {
    const text = title.trim();
    if (!ready) return;
    if (mode === 'plan') onStart({ title: text, branch: branch!, minutes, save });
    else if (event) onDone({ event: true, title: text });
    else onDone({ event: false, title: text, branch: branch!, minutes });
  }

  let placeholder = 'Например: разобрать вопросы к собеседованию в X';
  if (mode === 'done') placeholder = event ? 'Например: митап о платформенной разработке' : 'Например: созвонилась с бывшей коллегой';

  return (
    <main class="screen form-screen">
      <BackBar title="Своё задание" />
      <div class="choices" role="group" aria-label="Что записать">
        {(
          [
            ['plan', 'Буду делать'],
            ['done', 'Уже сделала'],
          ] as const
        ).map(([m, label]) => (
          <button
            type="button"
            key={m}
            class={`choice ${mode === m ? 'choice--on' : ''}`}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        class="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label class="field">
          <span class="field__label">{mode === 'plan' ? 'Что буду делать' : isEvent ? 'Где была' : 'Что сделала'}</span>
          <textarea
            rows={2}
            maxLength={200}
            value={title}
            onInput={(e) => setTitle(e.currentTarget.value)}
            placeholder={placeholder}
          />
        </label>

        {mode === 'done' && (
          <label class="check">
            <input type="checkbox" checked={event} onChange={(e) => setEvent(e.currentTarget.checked)} />
            <span>
              Это мероприятие: митап, конференция, вебинар
              <br />
              <span class="muted small">Нити, крупная награда и {BALANCE.tasks.instantStars.event} ★</span>
            </span>
          </label>
        )}

        {!isEvent && (
          <>
            <fieldset class="field">
              <legend class="field__label">Ветка</legend>
              <div class="choices">
                {BRANCHES.map((b) => (
                  <button
                    type="button"
                    key={b}
                    class={`choice chip--${b} ${branch === b ? 'choice--on' : ''}`}
                    aria-pressed={branch === b}
                    onClick={() => setBranch(b)}
                  >
                    {BRANCH_NAMES[b]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset class="field">
              <legend class="field__label">{mode === 'plan' ? 'Сколько минут' : 'Сколько минут заняло'}</legend>
              <div class="choices">
                {TASK_MINUTES.map((m) => (
                  <button
                    type="button"
                    key={m}
                    class={`choice ${minutes === m ? 'choice--on' : ''}`}
                    aria-pressed={minutes === m}
                    onClick={() => setMinutes(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {mode === 'plan' && (
          <label class="check">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.currentTarget.checked)} />
            <span>Сохранить в мои задания — будет появляться на доске</span>
          </label>
        )}

        <button type="submit" class="button" disabled={!ready}>
          {mode === 'plan' ? 'Начать таймер' : 'Засчитать'}
        </button>
      </form>
    </main>
  );
}
