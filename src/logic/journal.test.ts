import { describe, expect, it } from 'vitest';
import type { Achievement } from '../model/types';
import {
  allSkills,
  createEntry,
  entryStatus,
  filterEntries,
  journalFileName,
  journalMarkdown,
  missingParts,
  normalizeSkills,
  parseSkillInput,
  sortEntries,
  updateEntry,
} from './journal';

const NOW = new Date(2026, 10, 23, 12, 0).getTime();
const DAY_MS = 86_400_000;

const entry = (id: string, createdAt: number, extra: Partial<Achievement> = {}): Achievement => ({
  id, createdAt, updatedAt: createdAt, title: `Запись ${id}`, status: 'draft', ...extra,
});

describe('статус записи', () => {
  it('черновик, пока не заполнены контекст, как сделала и результат', () => {
    expect(entryStatus({})).toBe('draft');
    expect(missingParts({ context: 'Проект', result: '  ' })).toEqual(['action', 'result']);
    expect(entryStatus({ context: 'Проект', action: 'Сделала', result: 'Быстрее в 3 раза' })).toBe('complete');
  });
});

describe('навыки', () => {
  it('без пустых, лишних пробелов и повторов без учёта регистра', () => {
    expect(normalizeSkills([' TypeScript ', 'typescript', '', 'CI  /  CD', 'Ревью'])).toEqual(['TypeScript', 'CI / CD', 'Ревью']);
  });

  it('слишком длинный навык обрезается', () => {
    expect(normalizeSkills(['а'.repeat(60)])[0]).toHaveLength(40);
  });

  it('ввод через запятую', () => {
    expect(parseSkillInput('Vite, CI; ревью кода')).toEqual(['Vite', 'CI', 'ревью кода']);
  });

  it('все навыки — частые сначала, при равенстве по алфавиту (русскому: кириллица перед латиницей)', () => {
    const list = [
      entry('a', NOW, { skills: ['Vite', 'CI'] }),
      entry('b', NOW, { skills: ['ci', 'Ревью'] }),
      entry('c', NOW, { skills: ['Архитектура'] }),
    ];
    expect(allSkills(list)).toEqual(['CI', 'Архитектура', 'Ревью', 'Vite']);
  });
});

describe('список', () => {
  const list = [
    entry('a', NOW, { skills: ['CI'], status: 'complete' }),
    entry('b', NOW + 1, { skills: ['Vite'] }),
    entry('c', NOW + 2),
  ];

  it('фильтр по навыку без учёта регистра и по черновикам', () => {
    expect(filterEntries(list, { kind: 'skill', skill: 'ci' }).map((a) => a.id)).toEqual(['a']);
    expect(filterEntries(list, { kind: 'drafts' }).map((a) => a.id)).toEqual(['b', 'c']);
    expect(filterEntries(list, { kind: 'all' })).toHaveLength(3);
  });

  it('свежие сверху по дате создания', () => {
    const edited = { ...list[0]!, updatedAt: NOW + 10 };
    expect(sortEntries([edited, list[1]!, list[2]!]).map((a) => a.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('создание и правка', () => {
  it('новая запись: поля обрезаны, пустые не сохраняются', () => {
    const a = createEntry({ title: '  Ускорила сборку ', context: ' ', action: 'Перешла на Vite', skills: ['Vite', 'vite'] }, 'id1', NOW);
    expect(a).toEqual({ id: 'id1', createdAt: NOW, updatedAt: NOW, title: 'Ускорила сборку', action: 'Перешла на Vite', skills: ['Vite'], status: 'draft' });
  });

  it('правка: дата создания остаётся, статус пересчитывается, стёртое поле пропадает', () => {
    const a = createEntry({ title: 'Ускорила сборку', action: 'Vite' }, 'id1', NOW);
    const b = updateEntry(a, { title: 'Ускорила сборку', context: 'CI шёл 9 минут', action: 'Vite', result: '3 минуты' }, NOW + DAY_MS);
    expect(b.createdAt).toBe(NOW);
    expect(b.updatedAt).toBe(NOW + DAY_MS);
    expect(b.status).toBe('complete');
    const c = updateEntry(b, { title: 'Ускорила сборку', action: 'Vite' }, NOW + 2 * DAY_MS);
    expect(c.status).toBe('draft');
    expect('result' in c).toBe(false);
  });
});

describe('выгрузка в Markdown', () => {
  const full = entry('a', new Date(2026, 10, 20).getTime(), {
    title: 'Ускорила\nсборку',
    context: 'CI шёл 9 минут',
    action: 'Перевела на Vite\n# без старого конфига',
    result: '3 минуты вместо 9',
    skills: ['Vite', 'CI'],
    status: 'complete',
  });
  const draft = entry('b', new Date(2026, 10, 22).getTime(), { title: '#важное Провела ревью' });
  const md = journalMarkdown([full, draft], NOW);

  it('заголовок файла с датой выгрузки и числом записей', () => {
    expect(md.startsWith('# Летопись\n\nВыгрузка из «Просвета» от 23 ноября 2026. Записей: 2, из них черновиков: 1.\n')).toBe(true);
  });

  it('у каждой записи дата, навыки и статус; свежие сверху', () => {
    expect(md).toContain('## Ускорила сборку\n\n- Дата: 20 ноября 2026\n- Навыки: Vite, CI\n- Статус: готово\n');
    expect(md).toContain('- Дата: 22 ноября 2026\n- Статус: черновик\n');
    expect(md.indexOf('Провела ревью')).toBeLessThan(md.indexOf('Ускорила сборку'));
  });

  it('части записи — абзацами; пустые пропущены; строки, похожие на разметку, остаются текстом', () => {
    expect(md).toContain('**Контекст.** CI шёл 9 минут');
    expect(md).toContain('**Как сделала.** Перевела на Vite\n\\# без старого конфига');
    expect(md).toContain('**Результат.** 3 минуты вместо 9');
    expect(md).toContain('## \\#важное Провела ревью');
    expect(md.match(/\*\*Контекст\.\*\*/g)).toHaveLength(1);
  });

  it('пустой журнал', () => {
    expect(journalMarkdown([], NOW)).toContain('Записей: 0, из них черновиков: 0.');
  });

  it('имя файла по местной дате', () => {
    expect(journalFileName(NOW)).toBe('Летопись 2026-11-23.md');
  });
});
