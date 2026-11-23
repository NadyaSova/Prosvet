// Своё задание вне доски: текст, ветка, длительность. По галочке сохраняется в «Мои задания» и попадает на доску.

import { useState } from 'preact/hooks';
import { BRANCHES, TASK_MINUTES, type Branch, type TaskMinutes } from '../model/types';
import { BackBar } from './common';
import { BRANCH_NAMES } from './labels';

export interface CustomTaskInput {
  title: string;
  branch: Branch;
  minutes: TaskMinutes;
  save: boolean;
}

export function CustomTaskScreen({ onStart }: { onStart: (input: CustomTaskInput) => void }) {
  const [title, setTitle] = useState('');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [minutes, setMinutes] = useState<TaskMinutes>(25);
  const [save, setSave] = useState(false);
  const ready = title.trim() !== '' && branch !== null;

  return (
    <main class="screen form-screen">
      <BackBar title="Своё задание" />
      <form
        class="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onStart({ title: title.trim(), branch, minutes, save });
        }}
      >
        <label class="field">
          <span class="field__label">Что буду делать</span>
          <textarea
            rows={2}
            maxLength={200}
            value={title}
            onInput={(e) => setTitle(e.currentTarget.value)}
            placeholder="Например: разобрать вопросы к собеседованию в X"
          />
        </label>

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
          <legend class="field__label">Сколько минут</legend>
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

        <label class="check">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.currentTarget.checked)} />
          <span>Сохранить в мои задания — будет появляться на доске</span>
        </label>

        <button type="submit" class="button" disabled={!ready}>
          Начать таймер
        </button>
      </form>
    </main>
  );
}
