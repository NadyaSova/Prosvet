// Летопись: список записей с фильтром по навыкам, новая запись, выгрузка в Markdown. SPEC.md §10.

import { useState } from 'preact/hooks';
import { allSkills, filterEntries, hasSkill, journalFileName, journalMarkdown, type JournalFilter } from '../logic/journal';
import type { Achievement } from '../model/types';
import { canShare, downloadText, shareText } from '../storage/browser';
import { BackBar } from './common';
import { dateText } from './format';
import { go } from './router';

interface Props {
  entries: readonly Achievement[];
  /** Открыть сразу с фильтром «Черновики» (из задания «Дополнить черновую запись»). */
  drafts: boolean;
}

/** Фильтр помнится, пока приложение открыто: после правки записи список возвращается к нему. */
let lastFilter: JournalFilter = { kind: 'all' };

const sameFilter = (a: JournalFilter, b: JournalFilter) =>
  a.kind === b.kind && (a.kind !== 'skill' || (b.kind === 'skill' && a.skill === b.skill));

export function JournalScreen({ entries, drafts }: Props) {
  const [filter, setFilterState] = useState<JournalFilter>(drafts ? { kind: 'drafts' } : lastFilter);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const skills = allSkills(entries);
  const draftCount = entries.filter((a) => a.status === 'draft').length;
  // Навык мог пропасть из всех записей — тогда показываем все.
  const active: JournalFilter = filter.kind === 'skill' && !entries.some((a) => hasSkill(a, filter.skill)) ? { kind: 'all' } : filter;
  const shown = filterEntries(entries, active);

  function setFilter(f: JournalFilter) {
    lastFilter = f;
    setFilterState(f);
  }

  async function share() {
    const now = Date.now();
    try {
      await shareText(journalMarkdown(entries, now), journalFileName(now), 'Летопись');
    } catch (e) {
      setMessage({ text: `Не получилось поделиться: ${String(e)}`, error: true });
    }
  }

  function download() {
    const now = Date.now();
    downloadText(journalMarkdown(entries, now), journalFileName(now), 'text/markdown');
    setMessage({ text: 'Файл сохранён в «Загрузки».' });
  }

  const chip = (f: JournalFilter, label: string, key: string) => (
    <button
      type="button"
      key={key}
      class={`choice chip--chronicle ${sameFilter(active, f) ? 'choice--on' : ''}`}
      aria-pressed={sameFilter(active, f)}
      onClick={() => setFilter(f)}
    >
      {label}
    </button>
  );

  return (
    <main class="screen journal">
      <BackBar title="Летопись" />
      <p class="muted small journal__hint">
        Сделала что-то необычное — запиши, пока помнишь. Отсюда потом берутся строки для резюме и истории для собеседований.
      </p>
      <button type="button" class="button" onClick={() => go('journal/new')}>
        Новая запись
      </button>

      {entries.length === 0 ? (
        <p class="muted">Пока ни одной записи.</p>
      ) : (
        <>
          <div class="choices" role="group" aria-label="Фильтр">
            {chip({ kind: 'all' }, `Все · ${entries.length}`, 'all')}
            {(draftCount > 0 || active.kind === 'drafts') && chip({ kind: 'drafts' }, `Черновики · ${draftCount}`, 'drafts')}
            {skills.map((s) => chip({ kind: 'skill', skill: s }, s, `skill-${s}`))}
          </div>

          {shown.length === 0 && <p class="muted">Черновиков нет — все записи готовы.</p>}
          {shown.map((a) => (
            <button type="button" key={a.id} class="entry" onClick={() => go(`journal/edit/${encodeURIComponent(a.id)}`)}>
              <span class="muted small">
                {dateText(a.createdAt)}
                {a.status === 'draft' && <span class="entry__draft"> · черновик</span>}
              </span>
              <span class="entry__title">{a.title}</span>
              {a.result && <span class="small entry__result">{a.result}</span>}
              {a.skills && a.skills.length > 0 && <span class="muted small">{a.skills.join(' · ')}</span>}
            </button>
          ))}

          <section class="card">
            <h2>Выгрузка</h2>
            <p class="muted small journal__export-hint">Все записи одним файлом Markdown — с датой, навыками и статусом. Читается в Obsidian.</p>
            <div class="data__buttons">
              {canShare() && (
                <button type="button" class="button" onClick={() => void share()}>
                  Поделиться
                </button>
              )}
              <button type="button" class="button button--secondary" onClick={download}>
                Скачать файл
              </button>
            </div>
            {message && <p class={message.error ? 'error' : 'data__ok'}>{message.text}</p>}
          </section>
        </>
      )}
    </main>
  );
}
