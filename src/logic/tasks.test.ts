import { describe, expect, it } from 'vitest';
import { DEFAULT_TASKS } from '../data/default-tasks';
import { BRANCHES, type TaskTemplate } from '../model/types';
import { mergeTemplates } from './tasks';

const custom: TaskTemplate = { id: 'c1', branch: 'hunt', kind: 'timed', minutes: 45, onBoard: true, title: 'Своё' };

describe('список заданий', () => {
  it('стартовые + свои, скрытые помечены', () => {
    const all = mergeTemplates(DEFAULT_TASKS, [custom], ['speech-tech-topic', 'image-one-line']);
    expect(all).toHaveLength(DEFAULT_TASKS.length + 1);
    expect(all.find((t) => t.id === 'speech-tech-topic')?.hidden).toBe(true);
    expect(all.find((t) => t.id === 'speech-about-me')?.hidden).toBeUndefined();
    expect(all.at(-1)).toBe(custom);
  });

  it('своё задание с тем же id заменяет стартовое', () => {
    const edited: TaskTemplate = { ...DEFAULT_TASKS[1]!, title: 'Переименовала' };
    const all = mergeTemplates(DEFAULT_TASKS, [edited], []);
    expect(all).toHaveLength(DEFAULT_TASKS.length);
    expect(all.filter((t) => t.id === edited.id)).toEqual([edited]);
  });
});

describe('стартовый набор', () => {
  it('id не повторяются', () => {
    expect(new Set(DEFAULT_TASKS.map((t) => t.id)).size).toBe(DEFAULT_TASKS.length);
  });

  it('у каждой из семи веток есть задание на доске', () => {
    const branches = new Set(DEFAULT_TASKS.filter((t) => t.onBoard).map((t) => t.branch));
    expect([...branches].sort()).toEqual([...BRANCHES].sort());
  });

  it('мероприятие — мгновенное задание Нитей, не для доски', () => {
    const event = DEFAULT_TASKS.find((t) => t.kind === 'instant' && t.instant === 'event');
    expect(event).toMatchObject({ branch: 'threads', onBoard: false });
  });
});
