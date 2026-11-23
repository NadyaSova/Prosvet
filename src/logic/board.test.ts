import { describe, expect, it } from 'vitest';
import { DEFAULT_TASKS } from '../data/default-tasks';
import type { TaskTemplate } from '../model/types';
import { branchWeights, buildBoard, canReroll, pickTinyTask, refillSlot, sizeBucket, type BoardContext } from './board';
import { createRng } from './rng';

const D = 20_000;
const ctx: BoardContext = { today: D, branchLastTouched: {} };
const byId = new Map(DEFAULT_TASKS.map((t) => [t.id, t]));
const get = (id: string) => byId.get(id)!;

describe('сборка доски', () => {
  it('3 задания из разных веток и разных размеров', () => {
    for (let seed = 0; seed < 500; seed++) {
      const board = buildBoard(DEFAULT_TASKS, ctx, createRng(seed)).map(get);
      expect(board).toHaveLength(3);
      expect(new Set(board.map((t) => t.branch)).size).toBe(3);
      expect(new Set(board.map(sizeBucket)).size).toBe(3);
    }
  });

  it('скрытые задания и задания не для доски на доску не попадают', () => {
    const hidden = DEFAULT_TASKS.map((t) => (t.id === 'image-one-line' ? { ...t, hidden: true } : t));
    for (let seed = 0; seed < 300; seed++) {
      const board = buildBoard(hidden, ctx, createRng(seed)).map(get);
      for (const t of board) {
        expect(t.onBoard).toBe(true);
        expect(t.id).not.toBe('image-one-line');
      }
    }
  });

  it('перетягивание не повторяет задания прежней доски', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed);
      const first = buildBoard(DEFAULT_TASKS, ctx, rng);
      const second = buildBoard(DEFAULT_TASKS, ctx, rng, first);
      expect(second).toHaveLength(3);
      for (const id of second) expect(first).not.toContain(id);
    }
  });

  it('давно заброшенная ветка попадает на доску чаще', () => {
    const touched: BoardContext = {
      today: D,
      branchLastTouched: { chronicle: D, image: D, speech: D, scouting: D, hunt: D - 10 },
    };
    expect(branchWeights(touched).hunt).toBeGreaterThan(branchWeights(touched).image);
    let huntCount = 0;
    const n = 2000;
    for (let seed = 0; seed < n; seed++) {
      const board = buildBoard(DEFAULT_TASKS, touched, createRng(seed)).map(get);
      if (board.some((t) => t.branch === 'hunt')) huntCount++;
    }
    // Без предпочтений ветка попадала бы на доску из 3 мест в ~60% случаев.
    expect(huntCount / n).toBeGreaterThan(0.8);
  });

  it('если шаблонов мало, доска всё равно собирается', () => {
    const few: TaskTemplate[] = [
      { id: 'a', branch: 'hunt', kind: 'timed', minutes: 5, onBoard: true, title: 'a' },
      { id: 'b', branch: 'hunt', kind: 'timed', minutes: 5, onBoard: true, title: 'b' },
    ];
    expect(buildBoard(few, ctx, createRng(1)).sort()).toEqual(['a', 'b']);
    expect(buildBoard([], ctx, createRng(1))).toEqual([]);
  });
});

describe('пополнение доски', () => {
  it('новое задание — того же размера, из ветки, которой нет на доске', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = createRng(seed);
      const board = buildBoard(DEFAULT_TASKS, ctx, rng);
      const next = refillSlot(board, 1, DEFAULT_TASKS, ctx, rng);
      expect(next).toHaveLength(3);
      expect(next[0]).toBe(board[0]);
      expect(next[2]).toBe(board[2]);
      const added = get(next[1]!);
      expect(board).not.toContain(added.id);
      expect(sizeBucket(added)).toBe(sizeBucket(get(board[1]!)));
      expect(added.branch).not.toBe(get(board[0]!).branch);
      expect(added.branch).not.toBe(get(board[2]!).branch);
    }
  });
});

describe('«Не хочу ничего»', () => {
  it('всегда даёт короткое задание, не с доски', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = createRng(seed);
      const board = buildBoard(DEFAULT_TASKS, ctx, rng);
      const tiny = pickTinyTask(DEFAULT_TASKS, ctx, rng, board)!;
      expect(sizeBucket(tiny)).toBe('short');
      expect(board).not.toContain(tiny.id);
    }
  });
});

describe('перетягивание доски', () => {
  it('бесплатно один раз в день', () => {
    expect(canReroll(null, D)).toBe(true);
    expect(canReroll({ day: D, count: 1 }, D)).toBe(false);
    expect(canReroll({ day: D - 1, count: 1 }, D)).toBe(true);
  });
});
