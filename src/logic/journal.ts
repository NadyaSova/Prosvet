// Летопись — журнал достижений. SPEC.md §10. Чистые функции: время — в параметрах.

import type { Achievement } from '../model/types';

/** Что пользователь вводит в форме записи. Пустые строки — «не заполнено». */
export interface EntryFields {
  title: string;
  context?: string;
  action?: string;
  result?: string;
  skills?: readonly string[];
}

/** Части полной записи, кроме заголовка. Без любой из них запись остаётся черновиком. */
export const ENTRY_PARTS = ['context', 'action', 'result'] as const;
export type EntryPart = (typeof ENTRY_PARTS)[number];

export const MAX_SKILL_LENGTH = 40;

const filled = (s: string | undefined): s is string => s !== undefined && s.trim() !== '';

/** Каких частей не хватает до полной записи. */
export function missingParts(a: Pick<Achievement, EntryPart>): EntryPart[] {
  return ENTRY_PARTS.filter((p) => !filled(a[p]));
}

/** Запись полная, когда заполнены контекст, как сделала и результат. Иначе — черновик. */
export function entryStatus(a: Pick<Achievement, EntryPart>): Achievement['status'] {
  return missingParts(a).length === 0 ? 'complete' : 'draft';
}

const skillKey = (s: string) => s.toLocaleLowerCase('ru');

/** Навыки без пустых, без лишних пробелов и без повторов (регистр не важен — остаётся первое написание). */
export function normalizeSkills(list: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const s = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_SKILL_LENGTH).trim();
    if (s === '' || seen.has(skillKey(s))) continue;
    seen.add(skillKey(s));
    out.push(s);
  }
  return out;
}

/** «TypeScript, CI» → ['TypeScript', 'CI']. */
export function parseSkillInput(text: string): string[] {
  return normalizeSkills(text.split(/[,;\n]/));
}

/** Все навыки из записей: сначала самые частые, при равенстве — по алфавиту. */
export function allSkills(entries: readonly Achievement[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const e of entries) {
    for (const s of e.skills ?? []) {
      const c = counts.get(skillKey(s));
      if (c) c.count++;
      else counts.set(skillKey(s), { name: s, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
    .map((c) => c.name);
}

export type JournalFilter = { kind: 'all' } | { kind: 'drafts' } | { kind: 'skill'; skill: string };

export function hasSkill(a: Achievement, skill: string): boolean {
  return (a.skills ?? []).some((s) => skillKey(s) === skillKey(skill));
}

export function filterEntries(entries: readonly Achievement[], f: JournalFilter): Achievement[] {
  switch (f.kind) {
    case 'all':
      return [...entries];
    case 'drafts':
      return entries.filter((a) => a.status === 'draft');
    case 'skill':
      return entries.filter((a) => hasSkill(a, f.skill));
  }
}

/** Записи по дате создания, свежие сверху. Правка записи её не передвигает. */
export function sortEntries(entries: readonly Achievement[]): Achievement[] {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt);
}

function applyFields(base: Pick<Achievement, 'id' | 'createdAt' | 'updatedAt'>, f: EntryFields): Achievement {
  const a: Achievement = { ...base, title: f.title.trim(), status: 'draft' };
  for (const p of ENTRY_PARTS) {
    const v = f[p];
    if (filled(v)) a[p] = v.trim();
  }
  const skills = normalizeSkills(f.skills ?? []);
  if (skills.length > 0) a.skills = skills;
  a.status = entryStatus(a);
  return a;
}

export function createEntry(f: EntryFields, id: string, now: number): Achievement {
  return applyFields({ id, createdAt: now, updatedAt: now }, f);
}

/** Правка записи: дата создания остаётся, статус пересчитывается. */
export function updateEntry(a: Achievement, f: EntryFields, now: number): Achievement {
  return applyFields({ id: a.id, createdAt: a.createdAt, updatedAt: now }, f);
}

// Выгрузка в Markdown. SPEC.md §10.3: один файл, у каждой записи — дата, навыки, статус; читается в Obsidian.

export const PART_LABELS: Record<EntryPart, string> = {
  context: 'Контекст',
  action: 'Как сделала',
  result: 'Результат',
};

const longDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
/** «20 ноября 2026» — без «г.», который добавляет Intl. */
const dateLong = (t: number) => longDate.format(new Date(t)).replace(/\s*г\.$/, '');

/** Строка в начале, похожая на разметку (заголовок, цитата), остаётся текстом. */
function escapeLine(line: string): string {
  return /^\s{0,3}(#|>)/.test(line) ? line.replace(/^(\s*)([#>])/, '$1\\$2') : line;
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function journalMarkdown(entries: readonly Achievement[], now: number): string {
  const sorted = sortEntries(entries);
  const drafts = sorted.filter((a) => a.status === 'draft').length;
  const out: string[] = [
    '# Летопись',
    '',
    `Выгрузка из «Просвета» от ${dateLong(now)}. Записей: ${sorted.length}, из них черновиков: ${drafts}.`,
  ];
  for (const a of sorted) {
    out.push('', `## ${escapeLine(oneLine(a.title))}`, '');
    out.push(`- Дата: ${dateLong(a.createdAt)}`);
    if (a.skills?.length) out.push(`- Навыки: ${a.skills.join(', ')}`);
    out.push(`- Статус: ${a.status === 'complete' ? 'готово' : 'черновик'}`);
    for (const p of ENTRY_PARTS) {
      const v = a[p];
      if (!filled(v)) continue;
      const lines = v.trim().split(/\r?\n/).map(escapeLine);
      out.push('', `**${PART_LABELS[p]}.** ${lines.join('\n')}`);
    }
  }
  return out.join('\n') + '\n';
}

/** «Летопись 2026-11-23.md». */
export function journalFileName(now: number): string {
  return `Летопись ${isoDay(now)}.md`;
}
