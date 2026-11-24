import { describe, expect, it } from 'vitest';
import { DEFAULT_TASKS } from '../data/default-tasks';
import { createPlayer } from '../model/player';
import type { TaskTemplate } from '../model/types';
import {
  cancelTask,
  completeInstantTask,
  ensureBoard,
  finishTimedTask,
  onOpen,
  pauseTask,
  rerollBoard,
  resumeTask,
  startTimedTask,
  tinyTask,
  type GameState,
} from './game';
import { createRng, type Rng } from './rng';
import { emptyValley } from './valley';
import { dayOf } from './time';

const NOW = new Date(2026, 10, 23, 12, 0).getTime();
const MIN = 60_000;
const DAY_MS = 86_400_000;
const PHRASE: Rng = () => 0; // карта «фраза + 5 золота»

const byId = new Map(DEFAULT_TASKS.map((t) => [t.id, t]));
const get = (id: string) => byId.get(id)!;

function newGame(seed = 1): GameState {
  const empty: GameState = { player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() };
  return ensureBoard(empty, DEFAULT_TASKS, NOW, createRng(seed));
}

function startFromBoard(g: GameState, index: number, now = NOW): GameState {
  const t = get(g.board.taskIds[index]!);
  if (t.kind !== 'timed') throw new Error('нужно таймерное');
  return startTimedTask(g, { templateId: t.id, title: t.title, branch: t.branch, minutes: t.minutes }, now);
}

/** Доска, где первое задание — таймерное. */
function gameWithTimedFirst(): GameState {
  for (let seed = 1; ; seed++) {
    const g = newGame(seed);
    if (get(g.board.taskIds[0]!).kind === 'timed') return g;
  }
}

describe('доска', () => {
  it('новая игра — полная доска', () => {
    expect(newGame().board.taskIds).toHaveLength(3);
  });

  it('скрытое задание с доски заменяется на том же месте', () => {
    const g = newGame();
    const hiddenId = g.board.taskIds[1]!;
    const templates = DEFAULT_TASKS.map((t) => (t.id === hiddenId ? { ...t, hidden: true } : t));
    const next = ensureBoard(g, templates, NOW, createRng(2));
    expect(next.board.taskIds).toHaveLength(3);
    expect(next.board.taskIds[0]).toBe(g.board.taskIds[0]);
    expect(next.board.taskIds[2]).toBe(g.board.taskIds[2]);
    expect(next.board.taskIds).not.toContain(hiddenId);
  });

  it('удалённое своё задание уходит с доски', () => {
    const own: TaskTemplate = { id: 'own', branch: 'prep', kind: 'timed', minutes: 45, onBoard: true, title: 'Своё' };
    const g: GameState = { ...newGame(), board: { taskIds: ['own', 'image-one-line'], rerolls: null } };
    const next = ensureBoard(g, DEFAULT_TASKS, NOW, createRng(3));
    expect(next.board.taskIds).toHaveLength(3);
    expect(next.board.taskIds).not.toContain(own.id);
  });

  it('если менять нечего — то же состояние', () => {
    const g = newGame();
    expect(ensureBoard(g, DEFAULT_TASKS, NOW, createRng(4))).toBe(g);
  });

  it('все задания скрыты — доска пустая, без ошибок', () => {
    const hidden = DEFAULT_TASKS.map((t) => ({ ...t, hidden: true }));
    expect(ensureBoard(newGame(), hidden, NOW, createRng(5)).board.taskIds).toEqual([]);
  });

  it('перетянуть можно раз в день', () => {
    const g = newGame();
    const once = rerollBoard(g, DEFAULT_TASKS, NOW, createRng(6))!;
    expect(once.board.taskIds).toHaveLength(3);
    for (const id of once.board.taskIds) expect(g.board.taskIds).not.toContain(id);
    expect(rerollBoard(once, DEFAULT_TASKS, NOW + 60 * MIN, createRng(7))).toBeNull();
    expect(rerollBoard(once, DEFAULT_TASKS, NOW + DAY_MS, createRng(8))).not.toBeNull();
  });

  it('«Не хочу ничего» и «Другое» дают разные короткие задания', () => {
    const g = newGame();
    for (let seed = 0; seed < 100; seed++) {
      const first = tinyTask(g, DEFAULT_TASKS, NOW, createRng(seed))!;
      const second = tinyTask(g, DEFAULT_TASKS, NOW, createRng(seed + 1000), first.id)!;
      expect(second.id).not.toBe(first.id);
      expect(g.board.taskIds).not.toContain(second.id);
    }
  });
});

describe('таймерное задание', () => {
  it('нельзя запустить второй таймер', () => {
    const g = startFromBoard(gameWithTimedFirst(), 0);
    expect(() => startFromBoard(g, 0)).toThrow();
  });

  it('время вышло: полная награда, задание на доске заменено, таймер снят', () => {
    const g = startFromBoard(gameWithTimedFirst(), 0);
    const doneId = g.timer!.templateId;
    const r = finishTimedTask(g, DEFAULT_TASKS, NOW + g.timer!.durationMs, PHRASE)!;
    expect(r.done.full).toBe(true);
    expect(r.done.report.loot).not.toBeNull();
    expect(r.state.timer).toBeNull();
    expect(r.state.board.taskIds).toHaveLength(3);
    expect(r.state.board.taskIds).not.toContain(doneId);
    expect(r.state.player.xp[get(doneId).branch]).toBe(r.done.minutes);
  });

  it('закончила раньше: награда за минуты, без карты добычи', () => {
    const g = startFromBoard(gameWithTimedFirst(), 0);
    const r = finishTimedTask(g, DEFAULT_TASKS, NOW + 3 * MIN + 30_000, PHRASE)!;
    expect(r.done.full).toBe(false);
    expect(r.done.minutes).toBe(3);
    expect(r.done.report.loot).toBeNull();
  });

  it('меньше минуты — засчитывать нечего, таймер не трогаем', () => {
    const g = startFromBoard(gameWithTimedFirst(), 0);
    expect(finishTimedTask(g, DEFAULT_TASKS, NOW + 30_000, PHRASE)).toBeNull();
  });

  it('пауза останавливает время, отмена снимает таймер без награды', () => {
    let g = startFromBoard(gameWithTimedFirst(), 0);
    g = pauseTask(g, NOW + 2 * MIN);
    g = resumeTask(g, NOW + 62 * MIN);
    const r = finishTimedTask(g, DEFAULT_TASKS, NOW + 66 * MIN, PHRASE)!;
    expect(r.done.minutes).toBe(Math.min(6, r.done.plannedMinutes!));
    const cancelled = cancelTask(g);
    expect(cancelled.timer).toBeNull();
    expect(cancelled.player).toBe(g.player);
    expect(cancelled.board).toBe(g.board);
  });

  it('разовое задание вне доски не меняет доску', () => {
    const g = newGame();
    const started = startTimedTask(g, { templateId: 'once-1', title: 'Своё', branch: 'prep', minutes: 10 }, NOW);
    const r = finishTimedTask(started, DEFAULT_TASKS, NOW + 10 * MIN, PHRASE)!;
    expect(r.state.board.taskIds).toEqual(g.board.taskIds);
    expect(r.state.player.xp.prep).toBe(10);
    expect(r.done.title).toBe('Своё');
  });
});

describe('открытие приложения', () => {
  it('время вышло, пока приложение было закрыто, — награда при открытии, день — когда время вышло', () => {
    // Таймер запущен поздно вечером, закончился до полуночи, приложение открыли утром.
    const evening = new Date(2026, 10, 23, 23, 0).getTime();
    const g = startTimedTask(newGame(), { templateId: 'once', title: 'Вечернее', branch: 'call', minutes: 30 }, evening);
    const morning = new Date(2026, 10, 24, 8, 0).getTime();
    const r = onOpen(g, DEFAULT_TASKS, morning, PHRASE);
    expect(r.done?.whileAway).toBe(true);
    expect(r.done?.full).toBe(true);
    expect(r.state.timer).toBeNull();
    expect(r.state.player.streak.lastActiveDay).toBe(dayOf(evening));
  });

  it('таймер ещё идёт — ничего не засчитывается', () => {
    const g = startFromBoard(gameWithTimedFirst(), 0);
    const r = onOpen(g, DEFAULT_TASKS, NOW + MIN, PHRASE);
    expect(r.done).toBeNull();
    expect(r.state.timer).toBe(g.timer);
  });

  it('сообщает о прерванной серии', () => {
    const g = startTimedTask(newGame(), { templateId: 'once', title: 'x', branch: 'call', minutes: 5 }, NOW);
    const after = finishTimedTask(g, DEFAULT_TASKS, NOW + 5 * MIN, PHRASE)!.state;
    const r = onOpen(after, DEFAULT_TASKS, NOW + 5 * DAY_MS, PHRASE);
    expect(r.news.broken).toBe(true);
    expect(r.state.player.streak.startDay).toBeNull();
  });
});

describe('мгновенное задание', () => {
  it('запись в журнал засчитывается и уступает место на доске', () => {
    const journal = get('chronicle-achievement');
    const g: GameState = { ...newGame(), board: { taskIds: ['chronicle-achievement', 'image-keywords', 'hunt-apply-session'], rerolls: null } };
    const r = completeInstantTask(g, journal, DEFAULT_TASKS, NOW, PHRASE);
    expect(r.state.player.xp.chronicle).toBeGreaterThan(0);
    expect(r.state.board.taskIds).not.toContain('chronicle-achievement');
    expect(r.state.board.taskIds).toHaveLength(3);
  });

  it('не сбрасывает идущий таймер', () => {
    const journal = get('chronicle-achievement');
    const g = startTimedTask(newGame(), { templateId: 'once', title: 'x', branch: 'call', minutes: 30 }, NOW);
    expect(completeInstantTask(g, journal, DEFAULT_TASKS, NOW + MIN, PHRASE).state.timer).toBe(g.timer);
  });
});
