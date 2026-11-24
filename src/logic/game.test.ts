import { describe, expect, it } from 'vitest';
import { DEFAULT_TASKS } from '../data/default-tasks';
import { createPlayer } from '../model/player';
import type { TaskTemplate } from '../model/types';
import { BALANCE } from '../config/balance';
import {
  cancelTask,
  completeDoneTask,
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
    // image-one-line — задание фазы 1, которого в наборе больше нет: тоже уходит.
    const next = ensureBoard(g, DEFAULT_TASKS, NOW, createRng(3));
    expect(next.board.taskIds).toHaveLength(3);
    expect(next.board.taskIds).not.toContain(own.id);
    expect(next.board.taskIds).not.toContain('image-one-line');
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
    for (let seed = 0; seed < 100; seed++) {
      const g = newGame(seed + 1);
      const first = tinyTask(g, DEFAULT_TASKS, NOW, createRng(seed))!;
      expect(g.board.taskIds).not.toContain(first.id);
      const second = tinyTask(g, DEFAULT_TASKS, NOW, createRng(seed + 1000), first.id)!;
      expect(second.id).not.toBe(first.id);
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
    expect(r.state.player.xp[get(doneId).branch]).toBe(r.done.report.xp);
    expect(r.done.report.xp).toBeGreaterThanOrEqual(r.done.minutes!);
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

describe('правка времени при остановке', () => {
  /** Задание на 30 минут вне доски, запущенное в NOW. */
  const started = () => startTimedTask(newGame(), { templateId: 'once', title: 'Отклик', branch: 'call', minutes: 30 }, NOW);

  it('время вышло, засчитать меньше — награда за минуты, без карты добычи', () => {
    const g = started();
    const full = finishTimedTask(g, DEFAULT_TASKS, NOW + 30 * MIN, createRng(9))!;
    const fixed = finishTimedTask(g, DEFAULT_TASKS, NOW + 30 * MIN, createRng(9), { minutes: 10 })!;
    expect(fixed.done.minutes).toBe(10);
    expect(fixed.done.full).toBe(false);
    expect(fixed.done.report.loot).toBeNull();
    expect(fixed.state.player.xp.call).toBeLessThan(full.state.player.xp.call);
    expect(fixed.state.timer).toBeNull();
  });

  it('засчитать больше запланированного — полная награда за все минуты, та же карта добычи', () => {
    const g = started();
    const full = finishTimedTask(g, DEFAULT_TASKS, NOW + 30 * MIN, createRng(9))!;
    const more = finishTimedTask(g, DEFAULT_TASKS, NOW + 30 * MIN, createRng(9), { minutes: 45 })!;
    expect(more.done.minutes).toBe(45);
    expect(more.done.plannedMinutes).toBe(30);
    expect(more.done.full).toBe(true);
    expect(more.done.report.loot).toEqual(full.done.report.loot);
    expect(more.state.player.xp.call).toBeGreaterThan(full.state.player.xp.call);
  });

  it('закончила раньше, засчитать всё время — с картой добычи', () => {
    const r = finishTimedTask(started(), DEFAULT_TASKS, NOW + 12 * MIN, createRng(9), { minutes: 30 })!;
    expect(r.done.full).toBe(true);
    expect(r.done.report.loot).not.toBeNull();
  });

  it('время вышло, пока приложение было закрыто: после правки день — по-прежнему когда время вышло', () => {
    const evening = new Date(2026, 10, 23, 23, 0).getTime();
    const g = startTimedTask(newGame(), { templateId: 'once', title: 'Вечернее', branch: 'call', minutes: 30 }, evening);
    const morning = new Date(2026, 10, 24, 8, 0).getTime();
    const r = onOpen(g, DEFAULT_TASKS, morning, createRng(9), { minutes: 10 });
    expect(r.done?.minutes).toBe(10);
    expect(r.done?.whileAway).toBe(true);
    expect(r.state.player.streak.lastActiveDay).toBe(dayOf(evening));
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
    const g: GameState = { ...newGame(), board: { taskIds: ['chronicle-achievement', 'hunt-review', 'hunt-apply-session'], rerolls: null } };
    const r = completeInstantTask(g, journal, DEFAULT_TASKS, NOW, PHRASE);
    expect(r.state.player.xp.chronicle).toBeGreaterThan(0);
    expect(r.state.board.taskIds).not.toContain('chronicle-achievement');
    expect(r.state.board.taskIds).toHaveLength(3);
  });

  it('мероприятие: звезда, крупное растение, доска не меняется', () => {
    const event = get('threads-event');
    const g = newGame();
    const r = completeInstantTask(g, event, DEFAULT_TASKS, NOW, PHRASE);
    expect(r.done.report.taskStars).toBe(BALANCE.tasks.instantStars.event);
    expect(r.state.player.stars).toBe(r.done.report.stars);
    expect(r.state.player.xp.threads).toBe(BALANCE.xp.instant.event);
    expect(r.done.planted).toMatchObject({ kind: 'flax', size: 'large' });
    expect(r.state.board.taskIds).toEqual(g.board.taskIds);
  });

  it('не сбрасывает идущий таймер', () => {
    const journal = get('chronicle-achievement');
    const g = startTimedTask(newGame(), { templateId: 'once', title: 'x', branch: 'call', minutes: 30 }, NOW);
    expect(completeInstantTask(g, journal, DEFAULT_TASKS, NOW + MIN, PHRASE).state.timer).toBe(g.timer);
  });
});

describe('«Уже сделала»', () => {
  it('засчитывается сразу как полное задание на столько минут', () => {
    const g = startTimedTask(newGame(), { templateId: 'once', title: 'x', branch: 'call', minutes: 30 }, NOW);
    const r = completeDoneTask(g, { title: 'Созвонилась с коллегой', branch: 'threads', minutes: 20 }, NOW + MIN, PHRASE);
    expect(r.done).toMatchObject({ title: 'Созвонилась с коллегой', branch: 'threads', minutes: 20, full: true });
    expect(r.state.player.xp.threads).toBe(20);
    expect(r.done.report.loot?.kind).toBe('phrase');
    expect(r.done.planted?.kind).toBe('flax');
    expect(r.state.player.streak.lastActiveDay).toBe(dayOf(NOW));
    expect(r.state.board).toBe(g.board);
    expect(r.state.timer).toBe(g.timer);
  });
});

describe('«Написать» — награда ×1,5', () => {
  it('полное время: опыт и золото умножены', () => {
    const g = startTimedTask(newGame(), { templateId: 'threads-write', title: 'Написать', branch: 'threads', minutes: 20 }, NOW);
    const r = finishTimedTask(g, DEFAULT_TASKS, NOW + 20 * MIN, PHRASE)!;
    expect(r.done.report.xp).toBe(30);
    expect(r.done.report.gold - r.done.report.lootGold).toBe(15);
  });

  it('досрочно — пропорционально, с тем же множителем', () => {
    const g = startTimedTask(newGame(), { templateId: 'threads-write', title: 'Написать', branch: 'threads', minutes: 20 }, NOW);
    const r = finishTimedTask(g, DEFAULT_TASKS, NOW + 7 * MIN + 30_000, PHRASE)!;
    expect(r.done.report.xp).toBe(10); // 7 × 1,5 = 10,5 → вниз
    expect(r.done.report.gold).toBe(5); // 7 × 0,5 × 1,5 = 5,25 → вниз
  });
});

describe('вопросы при остановке', () => {
  /** Задание из стартового набора, запущенное в NOW. */
  function startedTask(id: string): GameState {
    const t = get(id);
    if (t.kind !== 'timed') throw new Error('нужно таймерное');
    return startTimedTask(newGame(), { templateId: t.id, title: t.title, branch: t.branch, minutes: t.minutes }, NOW);
  }
  const finish = (id: string, fix = {}, after?: number) => {
    const g = startedTask(id);
    return finishTimedTask(g, DEFAULT_TASKS, NOW + (after ?? g.timer!.durationMs), createRng(9), fix)!;
  };

  it('у заданий из §4 — свои вопросы', () => {
    expect(finish('hunt-apply-session').done.ask).toBe('pigeon');
    expect(finish('threads-write').done.ask).toBe('sent');
    expect(finish('scouting-communities').done.ask).toBe('finding');
    expect(finish('hunt-browse').done.ask).toBe('found');
    expect(finish('hunt-review').done.ask).toBe('verdict');
    expect(finish('craft-study').done.ask).toBeUndefined();
  });

  it('«Написать» отправила — бонус сверх ×1,5; не отправила — награда за время', () => {
    const plain = finish('threads-write');
    const sent = finish('threads-write', { answer: { ask: 'sent', yes: true } });
    const notSent = finish('threads-write', { answer: { ask: 'sent', yes: false } });
    const bonus = BALANCE.tasks.stopBonus.sent;
    expect(sent.done.report.bonus).toEqual(bonus);
    expect(sent.done.report.xp).toBe(plain.done.report.xp + bonus.xp);
    expect(sent.state.player.gold).toBe(plain.state.player.gold + bonus.gold);
    expect(sent.state.player.xp.threads).toBe(30 + bonus.xp);
    expect(sent.done.answer).toEqual({ ask: 'sent', yes: true });
    expect(notSent.done.report.bonus).toBeNull();
    expect(notSent.state.player).toEqual(plain.state.player);
  });

  it('та же карта добычи и то же растение с ответом и без', () => {
    const plain = finish('hunt-browse');
    const found = finish('hunt-browse', { answer: { ask: 'found', yes: true } });
    expect(found.done.report.loot).toEqual(plain.done.report.loot);
    expect(found.done.planted).toEqual(plain.done.planted);
  });

  it('находка: бонус за непустую строку', () => {
    expect(finish('scouting-communities', { answer: { ask: 'finding', text: 'Митап по Rust в Хайфе' } }).done.report.bonus).toEqual(
      BALANCE.tasks.stopBonus.finding,
    );
    expect(finish('scouting-communities', { answer: { ask: 'finding', text: '   ' } }).done.report.bonus).toBeNull();
  });

  it('разбор вакансии: «нет» награждается так же, как «откликаться», «подумать» — без бонуса', () => {
    const apply = finish('hunt-review', { answer: { ask: 'verdict', verdict: 'apply' } });
    const skip = finish('hunt-review', { answer: { ask: 'verdict', verdict: 'skip' } });
    const think = finish('hunt-review', { answer: { ask: 'verdict', verdict: 'think' } });
    expect(skip.state.player).toEqual(apply.state.player);
    expect(apply.done.report.bonus).toEqual(BALANCE.tasks.stopBonus.verdict);
    expect(think.done.report.bonus).toBeNull();
  });

  it('ответ не к вопросу этого задания — без бонуса', () => {
    const r = finish('hunt-review', { answer: { ask: 'sent', yes: true } });
    expect(r.done.report.bonus).toBeNull();
    expect(r.done.answer).toBeUndefined();
  });

  it('досрочная остановка — бонус тоже, вместе с правкой времени', () => {
    const early = finish('hunt-browse', { answer: { ask: 'found', yes: true } }, 7 * MIN + 30_000);
    expect(early.done.full).toBe(false);
    expect(early.done.report.xp).toBe(7 + BALANCE.tasks.stopBonus.found.xp);
    const fixed = finish('hunt-browse', { minutes: 25, answer: { ask: 'found', yes: true } }, 7 * MIN);
    expect(fixed.done.full).toBe(true);
    expect(fixed.done.report.xp).toBe(25 + BALANCE.tasks.stopBonus.found.xp);
  });

  it('время вышло при закрытом приложении — ответ учитывается при пересчёте', () => {
    const g = startedTask('threads-write');
    const later = NOW + 3 * 60 * MIN;
    const r = onOpen(g, DEFAULT_TASKS, later, createRng(9), { answer: { ask: 'sent', yes: true } });
    expect(r.done?.whileAway).toBe(true);
    expect(r.done?.report.bonus).toEqual(BALANCE.tasks.stopBonus.sent);
  });
});
