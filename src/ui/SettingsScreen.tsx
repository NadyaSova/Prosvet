// Настройки: какие задания появляются на доске, свои задания, данные и резервная копия.

import { BRANCHES, type Settings, type TaskTemplate } from '../model/types';
import type { Persistence } from '../storage/browser';
import type { ProsvetDb } from '../storage/db';
import type { AppData } from '../storage/repo';
import { BackBar } from './common';
import { DataSection } from './DataSection';
import { minutesText } from './format';
import { BRANCH_NAMES } from './labels';

interface Props {
  db: ProsvetDb;
  settings: Settings;
  persistence: Persistence | null;
  templates: readonly TaskTemplate[];
  customIds: ReadonlySet<string>;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onDeleteCustom: (id: string) => void;
  onDataChange: (data: AppData) => void;
}

export function SettingsScreen(p: Props) {
  const tasks = p.templates.filter((t) => t.onBoard);

  return (
    <main class="screen settings">
      <BackBar title="Настройки" />

      <section class="card">
        <h2>Задания на доске</h2>
        <p class="muted small">Без галочки задание не появляется на доске. Свои задания добавляются через «Своё задание» на главном экране.</p>
        {BRANCHES.map((b) => {
          const list = tasks.filter((t) => t.branch === b);
          if (list.length === 0) return null;
          return (
            <div class="task-group" key={b}>
              <h3 class={`task-group__title chip--${b}`}>{BRANCH_NAMES[b]}</h3>
              {list.map((t) => (
                <div class="task-row" key={t.id}>
                  <label class="check">
                    <input
                      type="checkbox"
                      checked={!t.hidden}
                      onChange={(e) => p.onToggleHidden(t.id, !e.currentTarget.checked)}
                    />
                    <span>
                      {t.title}
                      <span class="muted small"> · {t.kind === 'timed' ? minutesText(t.minutes) : 'сразу'}</span>
                      {p.customIds.has(t.id) && <span class="muted small"> · своё</span>}
                    </span>
                  </label>
                  {p.customIds.has(t.id) && (
                    <button
                      type="button"
                      class="link-button"
                      onClick={() => {
                        if (confirm(`Удалить задание «${t.title}»?`)) p.onDeleteCustom(t.id);
                      }}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <DataSection db={p.db} settings={p.settings} persistence={p.persistence} onChange={p.onDataChange} />
    </main>
  );
}
