import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createPlayer } from '../model/player';
import { LANDMARK_KINDS, type Boss } from '../model/types';
import {
  addSession,
  archiveBoss,
  cancelStopwatch,
  chooseGarden,
  chooseLandmark,
  clampSessionMinutes,
  createBoss,
  daysSinceLast,
  fogDensity,
  gardenView,
  measuredMinutes,
  releaseBoss,
  runningBoss,
  sessionStars,
  startStopwatch,
  totalMinutes,
  winBoss,
} from './bosses';
import {
  finishBossSession,
  startBossSession,
  startTimedTask,
  winBossAction,
  type GameState,
} from './game';
import { createRng, type Rng } from './rng';
import { dayOf } from './time';
import { emptyValley } from './valley';

const NOW = new Date(2026, 10, 24, 12, 0).getTime();
const MIN = 60_000;
const DAY_MS = 86_400_000;
const PHRASE: Rng = () => 0; // карта «фраза + 5 золота»

const game = (): GameState => ({
  player: createPlayer(),
  board: { taskIds: [], rerolls: null },
  timer: null,
  valley: emptyValley(),
});

const finite = (id = 'b1', bosses: Boss[] = []) =>
  createBoss(bosses, { title: 'Интервью в «Ромашке»', kind: 'finite', branch: 'prep' }, NOW, createRng(1), id);
const endless = (id = 'e1', bosses: Boss[] = []) =>
  createBoss(bosses, { title: 'Соседние роли', kind: 'endless', branch: 'scouting' }, NOW, createRng(1), id);

/** Босс с n подходами по 20 минут. */
function withSessions(b: Boss, n: number): Boss {
  let x = b;
  for (let i = 0; i < n; i++) x = addSession(startStopwatch(x, NOW + i * DAY_MS), 20);
  return x;
}

describe('создание босса', () => {
  it('конечный — сооружение, бесконечный — место; название без пробелов по краям, пустая заметка не хранится', () => {
    const b = createBoss([], { title: '  Тестовое  ', note: ' ', kind: 'finite', branch: 'prep' }, NOW, createRng(1), 'x');
    expect(b).toMatchObject({ id: 'x', title: 'Тестовое', status: 'active', sessions: [], createdAt: NOW });
    expect(b.note).toBeUndefined();
    expect(b.place.landmark).toBeDefined();
    expect(b.place.garden).toBeUndefined();
    expect(endless().place.garden).toBeDefined();
  });

  it('без названия — нельзя', () => {
    expect(() => createBoss([], { title: ' ', kind: 'finite', branch: 'prep' }, NOW, createRng(1), 'x')).toThrow();
  });

  it('сооружения не повторяются, пока не открыты все', () => {
    const bosses: Boss[] = [];
    const rng = createRng(5);
    for (let i = 0; i < LANDMARK_KINDS.length; i++) {
      bosses.push(createBoss(bosses, { title: `Босс ${i}`, kind: 'finite', branch: 'prep' }, NOW, rng, `b${i}`));
    }
    expect(new Set(bosses.map((b) => b.place.landmark)).size).toBe(LANDMARK_KINDS.length);
  });

  it('сооружение отпущенного босса возвращается в пул', () => {
    const won = LANDMARK_KINDS.slice(1).map((landmark, i): Boss => ({
      ...finite(`w${i}`), place: { landmark, seed: 0 }, status: 'won',
    }));
    const released: Boss = { ...finite('r'), place: { landmark: LANDMARK_KINDS[0], seed: 0 }, status: 'released' };
    expect(chooseLandmark([...won, released], createRng(1))).toBe(LANDMARK_KINDS[0]);
  });

  it('все сооружения открыты — любое, которого нет под туманом', () => {
    const won = LANDMARK_KINDS.map((landmark, i): Boss => ({ ...finite(`w${i}`), place: { landmark, seed: 0 }, status: 'won' }));
    const active: Boss = { ...finite('a'), place: { landmark: LANDMARK_KINDS[0], seed: 0 } };
    for (let seed = 1; seed < 30; seed++) {
      expect(chooseLandmark([...won, active], createRng(seed))).not.toBe(LANDMARK_KINDS[0]);
    }
  });

  it('место бесконечного босса — из тех, что встречаются реже', () => {
    const bosses = (['pond', 'flowerbed', 'apiary'] as const).map((garden, i): Boss => ({
      ...endless(`e${i}`), place: { garden, seed: 0 },
    }));
    expect(chooseGarden(bosses, createRng(3))).toBe('meadow');
  });
});

describe('секундомер', () => {
  it('считает целые минуты по метке старта', () => {
    const b = startStopwatch(finite(), NOW);
    expect(measuredMinutes(b, NOW + 42 * MIN + 59_000)).toBe(42);
  });

  it('меньше минуты — засчитывать нечего; секундомер не идёт — тоже', () => {
    expect(measuredMinutes(startStopwatch(finite(), NOW), NOW + 59_000)).toBeNull();
    expect(measuredMinutes(finite(), NOW + 10 * MIN)).toBeNull();
  });

  it('забытый секундомер — не больше предела', () => {
    const b = startStopwatch(finite(), NOW);
    expect(measuredMinutes(b, NOW + 10 * 60 * MIN)).toBe(BALANCE.bosses.maxSessionMinutes);
  });

  it('правка времени — в пределах подхода', () => {
    expect(clampSessionMinutes(0)).toBe(1);
    expect(clampSessionMinutes(44.6)).toBe(45);
    expect(clampSessionMinutes(999)).toBe(BALANCE.bosses.maxSessionMinutes);
  });

  it('второй раз не запускается; отмена — без подхода', () => {
    const b = startStopwatch(finite(), NOW);
    expect(() => startStopwatch(b, NOW)).toThrow();
    const cancelled = cancelStopwatch(b);
    expect(cancelled.stopwatch).toBeUndefined();
    expect(cancelled.sessions).toEqual([]);
  });

  it('остановка записывает подход с началом, минутами и заметкой', () => {
    const b = addSession(startStopwatch(finite(), NOW), 25, ' вопросы к ним ');
    expect(b.stopwatch).toBeUndefined();
    expect(b.sessions).toEqual([{ startedAt: NOW, minutes: 25, note: 'вопросы к ним' }]);
    expect(addSession(startStopwatch(b, NOW), 10, '').sessions[1]).toEqual({ startedAt: NOW, minutes: 10 });
  });

  it('у побеждённого босса секундомер не запускается', () => {
    expect(() => startStopwatch(winBoss(finite(), NOW), NOW)).toThrow();
  });
});

describe('конец босса', () => {
  it('победа — только у конечного, с необязательной заметкой', () => {
    const won = winBoss(finite(), NOW + DAY_MS, ' спрашивали про кэш ');
    expect(won).toMatchObject({ status: 'won', endedAt: NOW + DAY_MS, victoryNote: 'спрашивали про кэш' });
    expect(() => winBoss(endless(), NOW)).toThrow();
    expect(() => winBoss(won, NOW)).toThrow();
  });

  it('пока идёт секундомер — ни победы, ни «отпустить», ни архива', () => {
    expect(() => winBoss(startStopwatch(finite(), NOW), NOW)).toThrow(/секундомер/);
    expect(() => releaseBoss(startStopwatch(finite(), NOW), NOW)).toThrow(/секундомер/);
    expect(() => archiveBoss(startStopwatch(endless(), NOW), NOW)).toThrow(/секундомер/);
  });

  it('«Отпустить» — конечного, подходы остаются', () => {
    const b = releaseBoss(withSessions(finite(), 2), NOW);
    expect(b.status).toBe('released');
    expect(b.sessions).toHaveLength(2);
    expect(() => releaseBoss(endless(), NOW)).toThrow();
  });

  it('в архив — бесконечного', () => {
    expect(archiveBoss(endless(), NOW).status).toBe('archived');
    expect(() => archiveBoss(finite(), NOW)).toThrow();
  });
});

describe('вид в долине', () => {
  it('туман редеет с каждым подходом, но до победы не уходит', () => {
    const densities = [0, 1, 2, 3, 4, 30].map((n) => fogDensity(withSessions(finite(), n)));
    expect(densities[0]).toBe(1);
    for (let i = 1; i < 5; i++) expect(densities[i]!).toBeLessThan(densities[i - 1]!);
    expect(densities[5]).toBe(BALANCE.bosses.fogMin);
  });

  it('после победы и «отпустить» тумана нет', () => {
    expect(fogDensity(winBoss(withSessions(finite(), 2), NOW))).toBe(0);
    expect(fogDensity(releaseBoss(finite(), NOW))).toBe(0);
  });

  it('место наполняется: элемент за подход, особый за каждые 5, сверх ёмкости — пышнее', () => {
    expect(gardenView(withSessions(endless(), 7))).toEqual({ elements: 7, specials: 1, bloom: 0 });
    const cap = BALANCE.bosses.gardenCapacity;
    expect(gardenView(withSessions(endless(), cap + 3))).toEqual({
      elements: cap, specials: Math.floor((cap + 3) / 5), bloom: 3,
    });
  });

  it('звезда — за каждый 5-й подход к бесконечному боссу; у конечного — нет', () => {
    expect(sessionStars(withSessions(endless(), 3))).toBe(0);
    expect(sessionStars(withSessions(endless(), 4))).toBe(1);
    expect(sessionStars(withSessions(endless(), 9))).toBe(1);
    expect(sessionStars(withSessions(finite(), 4))).toBe(0);
  });
});

describe('журнал подходов', () => {
  it('как давно не возвращалась и сколько всего минут', () => {
    const b = withSessions(endless(), 3); // последний — NOW + 2 дня
    expect(daysSinceLast(b, NOW + 9 * DAY_MS)).toBe(7);
    expect(daysSinceLast(endless(), NOW)).toBeNull();
    expect(totalMinutes(b)).toBe(60);
  });
});

describe('подход как игровое действие', () => {
  it('секундомер не запускается, пока идёт таймер или подход к другому боссу', () => {
    const a = finite('a');
    const b = finite('b', [a]);
    const withTimer = startTimedTask(game(), { templateId: 't', title: 'Т', branch: 'hunt', minutes: 20 }, NOW);
    expect(() => startBossSession(withTimer, [a, b], 'a', NOW)).toThrow(/таймер/);
    const running = startBossSession(game(), [a, b], 'a', NOW);
    expect(running.stopwatch).toEqual({ startedAt: NOW });
    expect(() => startBossSession(game(), [running, b], 'b', NOW)).toThrow(/другому/);
  });

  it('таймер задания не запускается, пока идёт подход', () => {
    const running = startStopwatch(finite(), NOW);
    expect(() =>
      startTimedTask(game(), { templateId: 't', title: 'Т', branch: 'hunt', minutes: 20 }, NOW, [running]),
    ).toThrow(/босс/);
  });

  it('награда — как за таймерное задание на столько минут: опыт ветке босса, золото, карта, день серии', () => {
    const boss = startStopwatch(finite(), NOW);
    const r = finishBossSession(game(), [boss], boss.id, NOW + 40 * MIN, PHRASE)!;
    expect(r.done).toMatchObject({ title: boss.title, branch: 'prep', minutes: 40, planted: null });
    expect(r.done.report.xp).toBe(40);
    expect(r.done.report.loot?.kind).toBe('phrase');
    expect(r.state.player.xp.prep).toBe(40);
    expect(r.state.player.gold).toBe(20 + BALANCE.loot.phraseGold);
    expect(r.state.player.streak.lastActiveDay).toBe(dayOf(NOW + 40 * MIN));
    expect(r.state.valley).toEqual(emptyValley());
    expect(r.boss.sessions).toEqual([{ startedAt: NOW, minutes: 40 }]);
    expect(r.boss.stopwatch).toBeUndefined();
  });

  it('короткий подход — без карты добычи', () => {
    const boss = startStopwatch(finite(), NOW);
    const r = finishBossSession(game(), [boss], boss.id, NOW + 3 * MIN, PHRASE)!;
    expect(r.done.report.loot).toBeNull();
    expect(r.done.report.xp).toBe(3);
  });

  it('поправленное время засчитывается вместо измеренного, заметка пишется в подход', () => {
    const boss = startStopwatch(finite(), NOW);
    const r = finishBossSession(game(), [boss], boss.id, NOW + 5 * 60 * MIN, PHRASE, { minutes: 50, note: 'изучила продукт' })!;
    expect(r.done.minutes).toBe(50);
    expect(r.state.player.xp.prep).toBe(50);
    expect(r.boss.sessions[0]).toEqual({ startedAt: NOW, minutes: 50, note: 'изучила продукт' });
  });

  it('правка с тем же сидом даёт ту же карту добычи', () => {
    const boss = startStopwatch(finite(), NOW);
    const a = finishBossSession(game(), [boss], boss.id, NOW + 30 * MIN, createRng(7))!;
    const b = finishBossSession(game(), [boss], boss.id, NOW + 30 * MIN, createRng(7), { minutes: 45 })!;
    expect(b.done.report.loot).toEqual(a.done.report.loot);
  });

  it('меньше минуты без правки — засчитывать нечего; с правкой — засчитывается', () => {
    const boss = startStopwatch(finite(), NOW);
    expect(finishBossSession(game(), [boss], boss.id, NOW + 30_000, PHRASE)).toBeNull();
    expect(finishBossSession(game(), [boss], boss.id, NOW + 30_000, PHRASE, { minutes: 15 })?.done.minutes).toBe(15);
    expect(finishBossSession(game(), [finite()], 'b1', NOW + 30 * MIN, PHRASE)).toBeNull();
  });

  it('5-й подход к бесконечному боссу — звезда', () => {
    const boss = startStopwatch(withSessions(endless(), 4), NOW + 10 * DAY_MS);
    const r = finishBossSession(game(), [boss], boss.id, NOW + 10 * DAY_MS + 20 * MIN, PHRASE)!;
    expect(r.done.report.taskStars).toBe(1);
    expect(r.state.player.stars).toBe(1);
    expect(gardenView(r.boss).specials).toBe(1);
  });

  it('победа — крупный бонус со звездой, без карты и без дня серии', () => {
    const boss = withSessions(finite(), 2);
    const r = winBossAction(game(), [boss], boss.id, NOW, 'разбор');
    const { xp, gold, stars } = BALANCE.bosses.victory;
    expect(r.report).toMatchObject({ branch: 'prep', xp, gold });
    expect(r.state.player.xp.prep).toBe(xp);
    expect(r.state.player.gold).toBe(gold);
    expect(r.state.player.stars).toBe(r.report.stars);
    expect(r.report.stars).toBeGreaterThanOrEqual(stars);
    expect(r.state.player.streak).toEqual(createPlayer().streak);
    expect(r.boss).toMatchObject({ status: 'won', victoryNote: 'разбор' });
  });

  it('секундомер идёт только у одного', () => {
    expect(runningBoss([finite('a'), startStopwatch(finite('b'), NOW)])?.id).toBe('b');
    expect(runningBoss([finite('a')])).toBeUndefined();
  });
});
