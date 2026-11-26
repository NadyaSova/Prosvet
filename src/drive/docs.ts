// Документы для чтения в Google Drive (docs/phase2-plan.md §7): Летопись, Находки, Недели, по документу на босса.
// Собираются целиком из данных приложения в HTML; Drive превращает HTML в Google Doc.

import { ENTRY_PARTS, PART_LABELS, sortEntries } from '../logic/journal';
import type { Achievement, Boss, Finding, WeekState } from '../model/types';
import { durationText, plural, weekRangeText } from '../ui/format';
import { BRANCH_NAMES } from '../ui/labels';

/** Документ: key — постоянное имя для поиска в Drive; folder — в главной папке или в папке «Боссы». */
export interface DriveDoc {
  key: string;
  title: string;
  folder: 'root' | 'bosses';
  html: string;
}

/** Из чего собираются документы. */
export interface DocsInput {
  achievements: readonly Achievement[];
  findings: readonly Finding[];
  bosses: readonly Boss[];
  week: WeekState;
}

const longDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
/** «20 ноября 2026» — без «г.», который добавляет Intl. */
const dateLong = (t: number) => longDate.format(new Date(t)).replace(/\s*г\.$/, '');
const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Текст с переносами строк — абзацы. */
function paragraphs(text: string, lead = ''): string {
  return text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((p, i) => `<p>${i === 0 ? lead : ''}${escapeHtml(p.trim()).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

const WARNING =
  'Этот документ собирает приложение «Просвет» и пересобирает целиком при каждом сохранении в Drive. ' +
  'Правки, сделанные здесь, пропадут — менять записи можно в приложении.';

function page(title: string, now: number, body: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>` +
    `<h1>${escapeHtml(title)}</h1>` +
    `<p><i>${WARNING}</i></p>` +
    `<p><i>Обновлено ${dateLong(now)}, ${clock.format(new Date(now))}.</i></p>` +
    body +
    '</body></html>'
  );
}

export function journalDoc(entries: readonly Achievement[], now: number): string {
  const sorted = sortEntries(entries);
  const drafts = sorted.filter((a) => a.status === 'draft').length;
  let body = `<p>Записей: ${sorted.length}, из них черновиков: ${drafts}.</p>`;
  for (const a of sorted) {
    body += `<h2>${escapeHtml(a.title.replace(/\s+/g, ' ').trim())}</h2><ul>`;
    body += `<li>Дата: ${dateLong(a.createdAt)}</li>`;
    if (a.skills?.length) body += `<li>Навыки: ${escapeHtml(a.skills.join(', '))}</li>`;
    body += `<li>Статус: ${a.status === 'complete' ? 'готово' : 'черновик'}</li></ul>`;
    for (const p of ENTRY_PARTS) {
      const v = a[p];
      if (v?.trim()) body += paragraphs(v, `<b>${PART_LABELS[p]}.</b> `);
    }
  }
  return page('Летопись', now, body);
}

/** Находки, свежие сверху, по дням. */
export function findingsDoc(findings: readonly Finding[], now: number): string {
  const sorted = [...findings].sort((a, b) => b.createdAt - a.createdAt);
  let body = sorted.length ? `<p>Находок: ${sorted.length}.</p>` : '<p>Находок пока нет.</p>';
  let day = '';
  for (const f of sorted) {
    const d = dateLong(f.createdAt);
    if (d !== day) {
      if (day) body += '</ul>';
      body += `<h2>${d}</h2><ul>`;
      day = d;
    }
    body += `<li>${escapeHtml(f.text.trim())}</li>`;
  }
  if (day) body += '</ul>';
  return page('Находки', now, body);
}

/** «Чего хочется на этой неделе» по неделям, свежие сверху. */
export function weeksDoc(week: WeekState, now: number): string {
  const wishes = week.wishes.filter((w) => w.text.trim()).sort((a, b) => b.week - a.week);
  let body = wishes.length ? '' : '<p>Записей пока нет.</p>';
  for (const w of wishes) {
    const first = weekRangeText(w.week);
    body += `<h2>${escapeHtml(first)}</h2><p>Хотелось: ${escapeHtml(w.text.trim())}</p>`;
  }
  return page('Недели', now, body);
}

function bossStatus(b: Boss): string {
  const when = b.endedAt ? ` ${dateLong(b.endedAt)}` : '';
  switch (b.status) {
    case 'active':
      return 'в работе';
    case 'won':
      return `победа${when}`;
    case 'released':
      return `отпущен${when}`;
    case 'archived':
      return `в архиве${when}`;
  }
}

/** Есть ли у босса заметки: описание, заметки подходов, заметка победы. Документ — только у таких. */
export function bossHasNotes(b: Boss): boolean {
  return !!(b.note?.trim() || b.victoryNote?.trim() || b.sessions.some((s) => s.note?.trim()));
}

export function bossDoc(b: Boss, now: number): string {
  const minutes = b.sessions.reduce((sum, s) => sum + s.minutes, 0);
  const n = b.sessions.length;
  let body = '<ul>';
  body += `<li>${b.kind === 'finite' ? 'Конечный босс' : 'Бесконечный босс'} · ${BRANCH_NAMES[b.branch]}</li>`;
  body += `<li>Заведён ${dateLong(b.createdAt)}, ${bossStatus(b)}</li>`;
  body += `<li>${n} ${plural(n, ['подход', 'подхода', 'подходов'])}${n ? `, ${durationText(minutes)}` : ''}</li></ul>`;
  if (b.note?.trim()) body += paragraphs(b.note);
  if (b.victoryNote?.trim()) body += '<h2>Заметка победы</h2>' + paragraphs(b.victoryNote);
  const sessions = [...b.sessions].sort((x, y) => y.startedAt - x.startedAt);
  if (sessions.length) {
    body += '<h2>Подходы</h2>';
    for (const s of sessions) {
      const head = `<b>${dateLong(s.startedAt)}</b> · ${durationText(s.minutes)}`;
      body += s.note?.trim() ? paragraphs(s.note, `${head} — `) : `<p>${head}</p>`;
    }
  }
  return page(b.title.trim() || 'Босс', now, body);
}

/** Все документы: Летопись, Находки, Недели и по документу на каждого босса с заметками. */
export function driveDocs(input: DocsInput, now: number): DriveDoc[] {
  const docs: DriveDoc[] = [
    { key: 'journal', title: 'Летопись', folder: 'root', html: journalDoc(input.achievements, now) },
    { key: 'findings', title: 'Находки', folder: 'root', html: findingsDoc(input.findings, now) },
    { key: 'weeks', title: 'Недели', folder: 'root', html: weeksDoc(input.week, now) },
  ];
  for (const b of input.bosses) {
    if (bossHasNotes(b)) docs.push({ key: `boss:${b.id}`, title: b.title.trim() || 'Босс', folder: 'bosses', html: bossDoc(b, now) });
  }
  return docs;
}

/** Содержимое без строки «Обновлено …» — чтобы не загружать документ заново, если в нём ничего не поменялось. */
export function docFingerprint(html: string): string {
  return html.replace(/<p><i>Обновлено [^<]*<\/i><\/p>/, '');
}
