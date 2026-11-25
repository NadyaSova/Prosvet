import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createPlayer } from '../model/player';
import type { Boss, Pigeon, ValleyPlant } from '../model/types';
import { normalizePlayer, normalizeWeek } from '../storage/normalize';
import { addSession, createBoss, startStopwatch, winBoss } from './bosses';
import { completeInstantTask, finishBossSession, finishTimedTask, startBossSession, startTimedTask, type GameState } from './game';
import { applyCompletion } from './rewards';
import { createRng } from './rng';
import { dayOf } from './time';
import { emptyValley } from './valley';
import {
  cleanWish,
  createWeekState,
  dueWeek,
  hasContent,
  logDay,
  setWish,
  weekday,
  weekStart,
  weekSummary,
  wishFor,
  type WeekData,
} from './week';

const MIN = 60_000;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
/** Воскресенье 22 ноября 2026 — начало недели. */
const SUN = dayOf(at(2026, 11, 22));

const game = (): GameState => ({ player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() });

describe('неделя', () => {
  it('начинается с воскресенья', () => {
    expect(weekday(SUN)).toBe(0);
    expect(weekday(dayOf(at(2026, 11, 25)))).toBe(3);
    for (let d = 0; d < 7; d++) expect(weekStart(SUN + d)).toBe(SUN);
    expect(weekStart(SUN - 1)).toBe(SUN - 7);
    expect(weekStart(SUN + 7)).toBe(SUN + 7);
  });

  it('не сбивается на переводе часов (Израиль, 27 марта и 25 октября 2026)', () => {
    // Переход на летнее время — в пятницу 27.03.2026, на зимнее — в воскресенье 25.10.2026.
    expect(weekStart(dayOf(at(2026, 3, 28, 23)))).toBe(dayOf(at(2026, 3, 22)));
    expect(weekStart(dayOf(at(2026, 3, 29, 0)))).toBe(dayOf(at(2026, 3, 29)));
    expect(weekStart(dayOf(at(2026, 10, 25, 1)))).toBe(dayOf(at(2026, 10, 25)));
    expect(weekStart(dayOf(at(2026, 10, 24, 23)))).toBe(dayOf(at(2026, 10, 18)));
  });

  it('BALANCE: неделя с воскресенья', () => {
    expect(BALANCE.week.firstWeekday).toBe(0);
  });
});

describe('журнал дней', () => {
  it('складывает минуты и дела по веткам одного дня', () => {
    let days = logDay([], SUN, 'hunt', 20);
    days = logDay(days, SUN, 'hunt', 15);
    days = logDay(days, SUN, 'chronicle', 0);
    expect(days).toEqual([{ day: SUN, minutes: { hunt: 35 }, done: { hunt: 2, chronicle: 1 } }]);
  });

  it('держит дни по порядку, даже если день раньше последнего', () => {
    let days = logDay([], SUN + 2, 'prep', 10);
    days = logDay(days, SUN, 'prep', 5);
    days = logDay(days, SUN + 3, 'prep', 5);
    days = logDay(days, SUN + 1, 'prep', 5);
    expect(days.map((d) => d.day)).toEqual([SUN, SUN + 1, SUN + 2, SUN + 3]);
  });

  it('пишется любой наградой: таймер — минуты, мгновенное — только дело', () => {
    const now = at(2026, 11, 23);
    let p = applyCompletion(createPlayer(), { kind: 'timed', branch: 'craft', minutes: 30, full: true }, now, createRng(1)).state;
    p = applyCompletion(p, { kind: 'instant', branch: 'chronicle', instant: 'journal' }, now, createRng(2)).state;
    expect(p.days).toEqual([{ day: SUN + 1, minutes: { craft: 30 }, done: { craft: 1, chronicle: 1 } }]);
  });

  it('множитель «Написать» и бонус за ответ минуты не меняют', () => {
    const p = applyCompletion(
      createPlayer(),
      { kind: 'timed', branch: 'threads', minutes: 20, full: true, factor: 1.5, bonus: { xp: 10, gold: 5 } },
      at(2026, 11, 23),
      createRng(1),
    ).state;
    expect(p.days[0]!.minutes).toEqual({ threads: 20 });
  });

  it('таймер, закончившийся при закрытом приложении, — в день, когда вышло время', () => {
    const start = at(2026, 11, 28, 23); // суббота, 23:00 — время вышло в 23:30
    const s = startTimedTask(game(), { templateId: 'x', title: 'Учёба', branch: 'craft', minutes: 30 }, start);
    const r = finishTimedTask(s, [], at(2026, 11, 29, 9), createRng(1))!;
    expect(r.state.player.days).toEqual([{ day: SUN + 6, minutes: { craft: 30 }, done: { craft: 1 } }]);
  });

  it('подход к боссу — минуты ветки босса', () => {
    const now = at(2026, 11, 24);
    const boss = createBoss([], { title: 'Послужной список', kind: 'finite', branch: 'chronicle' }, now - 60 * MIN, createRng(1), 'b');
    const running = startBossSession(game(), [boss], 'b', now - 45 * MIN);
    const r = finishBossSession(game(), [running], 'b', now, createRng(2))!;
    expect(r.state.player.days).toEqual([{ day: SUN + 2, minutes: { chronicle: 45 }, done: { chronicle: 1 } }]);
  });

  it('старые данные без журнала читаются с пустым; испорченное отбрасывается, ветки фазы 1 переносятся', () => {
    expect(normalizePlayer({ xp: {} }).days).toEqual([]);
    const p = normalizePlayer({
      days: [
        { day: SUN + 1, minutes: { speech: 10, prep: 5 }, done: { speech: 1, prep: 1 } },
        { day: SUN, minutes: { hunt: 20, nope: 3 }, done: { hunt: 1 } },
        { day: SUN, minutes: {}, done: { image: 1 } },
        { day: 'x', done: { hunt: 1 } },
        { day: SUN + 2, minutes: { hunt: -5 }, done: { hunt: 0 } },
        'мусор',
      ],
    });
    expect(p.days).toEqual([
      { day: SUN, minutes: { hunt: 20 }, done: { hunt: 1, chronicle: 1 } },
      { day: SUN + 1, minutes: { prep: 15 }, done: { prep: 2 } },
    ]);
  });
});

function pigeon(id: string, sentAt: number, back?: { at: number; outcome: Pigeon['outcome'] }): Pigeon {
  return {
    id,
    company: id,
    look: { pose: 'sit', size: 'medium', color: 'slate' },
    sentAt,
    status: back ? 'returned' : 'flying',
    ...(back && { outcome: back.outcome, returnedAt: back.at }),
  };
}

function plant(id: string, plantedAt: number): ValleyPlant {
  return { id, kind: 'pine', size: 'medium', slot: Number(id.slice(1)), seed: 1, plantedAt };
}

describe('итоги недели', () => {
  const today = SUN + 7;
  const inWeek = at(2026, 11, 24);
  const before = at(2026, 11, 20);

  function data(): WeekData {
    const player = createPlayer();
    player.days = [
      { day: SUN - 2, minutes: { hunt: 99 }, done: { hunt: 3 } },
      { day: SUN, minutes: { hunt: 20, prep: 30 }, done: { hunt: 1, prep: 1, chronicle: 2 } },
      { day: SUN + 3, minutes: { prep: 40 }, done: { prep: 2, call: 1 } },
      { day: SUN + 7, minutes: { craft: 30 }, done: { craft: 1 } },
    ];
    player.streak = { startDay: SUN, lastActiveDay: SUN + 6, extraDays: 0, logs: 0, milestoneReached: 0 };
    let won = createBoss([], { title: 'Интервью', kind: 'finite', branch: 'prep' }, before, createRng(1), 'won');
    won = addSession(startStopwatch(won, before), 30);
    won = addSession(startStopwatch(won, inWeek), 40);
    won = winBoss(won, inWeek + 60 * MIN);
    const fresh = createBoss([won], { title: 'Тестовое', kind: 'finite', branch: 'craft' }, inWeek, createRng(2), 'fresh');
    const quiet: Boss = addSession(
      startStopwatch(createBoss([], { title: 'Деньги', kind: 'endless', branch: 'scouting' }, before, createRng(3), 'quiet'), before),
      25,
    );
    return {
      player,
      valley: { ...emptyValley(), plants: [plant('p1', before), plant('p2', inWeek), plant('p3', inWeek + MIN), plant('p4', 0)] },
      bosses: [won, fresh, quiet],
      pigeons: [
        pigeon('a', before, { at: inWeek, outcome: 'silence' }),
        pigeon('b', inWeek),
        pigeon('c', before - 20 * 86_400_000, { at: before, outcome: 'rejected' }),
      ],
      achievements: [
        { id: 'e1', createdAt: inWeek, updatedAt: inWeek, title: 'Ускорила сборку', status: 'draft' },
        { id: 'e2', createdAt: before, updatedAt: inWeek, title: 'Старая', status: 'draft' },
      ],
    };
  }

  it('время и дела по веткам — только за эту неделю, больше минут выше', () => {
    const s = weekSummary(data(), SUN, today);
    expect(s.minutes).toBe(90);
    expect(s.done).toBe(7);
    expect(s.activeDays).toBe(2);
    expect(s.branches).toEqual([
      { branch: 'prep', minutes: 70, done: 3 },
      { branch: 'hunt', minutes: 20, done: 1 },
      { branch: 'chronicle', minutes: 0, done: 2 },
      { branch: 'call', minutes: 0, done: 1 },
    ]);
  });

  it('долина, боссы, голуби, Летопись и костёр', () => {
    const s = weekSummary(data(), SUN, today);
    expect(s.plants.map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(s.bosses.map((b) => [b.boss.id, b.sessions, b.minutes, b.won, b.isNew])).toEqual([
      ['won', 1, 40, true, false],
      ['fresh', 0, 0, false, true],
    ]);
    expect(s.sent.map((p) => p.id)).toEqual(['b']);
    expect(s.returned.map((p) => p.id)).toEqual(['a']);
    expect(s.flying).toBe(1);
    expect(s.feathers).toBe(2);
    expect(s.entries).toBe(1);
    expect(s.streak.value).toBe(8);
  });

  it('пустая неделя — показывать нечего; одно вернувшееся перо — есть что', () => {
    const empty = weekSummary({ ...data(), bosses: [], pigeons: [], valley: emptyValley() }, SUN - 14, today);
    expect(hasContent(empty)).toBe(false);
    expect(hasContent(weekSummary({ ...data(), player: createPlayer(), bosses: [], valley: emptyValley() }, SUN, today))).toBe(true);
  });

  it('отпущенный без подходов на неделе и новый, но уже отпущенный, — не в итогах', () => {
    const d = data();
    const released: Boss = { ...d.bosses[1]!, status: 'released', endedAt: inWeek };
    const s = weekSummary({ ...d, bosses: [released] }, SUN, today);
    expect(s.bosses).toEqual([]);
  });

  it('журнал дней пишется и при записи в Летопись через задание', () => {
    const t = { id: 'j', branch: 'chronicle' as const, title: 'Запись', kind: 'instant' as const, instant: 'journal' as const, onBoard: true };
    const r = completeInstantTask(game(), t, [t], inWeek, createRng(1));
    expect(weekSummary({ ...data(), player: r.state.player }, SUN, today).branches).toEqual([{ branch: 'chronicle', minutes: 0, done: 1 }]);
  });
});

describe('когда показывать итоги', () => {
  it('первый запуск: эта неделя считается увиденной, итоги — в следующую', () => {
    const s = createWeekState(SUN + 3);
    expect(dueWeek(s, SUN + 6)).toBeNull();
    const due = dueWeek(s, SUN + 7)!;
    expect(due.week).toBe(SUN);
    expect(due.state.seen).toBe(SUN + 7);
    expect(dueWeek(due.state, SUN + 9)).toBeNull();
  });

  it('после перерыва в несколько недель — итоги только прошлой недели', () => {
    const due = dueWeek(createWeekState(SUN), SUN + 23)!;
    expect(due.week).toBe(SUN + 14);
  });

  it('«что хочется»: одна строка на неделю, пустая убирает', () => {
    let s = setWish(createWeekState(SUN), SUN, '  Разобрать  две вакансии \n');
    expect(wishFor(s, SUN)).toBe('Разобрать две вакансии');
    s = setWish(s, SUN, 'Написать Оле');
    s = setWish(s, SUN + 7, 'Тестовое');
    expect(s.wishes).toEqual([
      { week: SUN, text: 'Написать Оле' },
      { week: SUN + 7, text: 'Тестовое' },
    ]);
    expect(wishFor(setWish(s, SUN, '   '), SUN)).toBeUndefined();
    expect(cleanWish('а'.repeat(500))).toHaveLength(BALANCE.week.wishMaxLength);
  });

  it('из базы: нет записи — первый запуск; испорченные строки отбрасываются', () => {
    expect(normalizeWeek(undefined, SUN + 3)).toEqual({ seen: SUN, wishes: [] });
    expect(
      normalizeWeek({ seen: SUN - 7, wishes: [{ week: SUN, text: ' Тест ' }, { week: SUN, text: 'повтор' }, { week: 'x', text: 'a' }, { week: SUN + 7, text: ' ' }] }, SUN),
    ).toEqual({ seen: SUN - 7, wishes: [{ week: SUN, text: 'Тест' }] });
  });
});
