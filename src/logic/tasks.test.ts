import { describe, expect, it } from 'vitest';
import { DEFAULT_TASKS } from '../data/default-tasks';
import type { TaskTemplate } from '../model/types';
import { mergeTemplates } from './tasks';

const custom: TaskTemplate = { id: 'c1', branch: 'hunt', kind: 'timed', minutes: 45, onBoard: true, title: 'Своё' };

describe('список заданий', () => {
  it('стартовые + свои, скрытые помечены', () => {
    const all = mergeTemplates(DEFAULT_TASKS, [custom], ['image-one-line']);
    expect(all).toHaveLength(DEFAULT_TASKS.length + 1);
    expect(all.find((t) => t.id === 'image-one-line')?.hidden).toBe(true);
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
