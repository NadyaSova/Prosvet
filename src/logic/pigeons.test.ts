import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createPlayer } from '../model/player';
import { PIGEON_COLORS, type Pigeon, type PigeonLook } from '../model/types';
import { answerPigeonAction, lateInviteAction, returnOverduePigeons, sendPigeon, type GameState } from './game';
import {
  answerPigeon,
  canLateInvite,
  cloakView,
  createLoft,
  daysInFlight,
  dueQuestion,
  feathersOf,
  isOverdue,
  lateInvite,
  launchPigeon,
  lookKey,
  markAsked,
  newLook,
  returnSilent,
  thresholdsCrossed,
} from './pigeons';
import { applyFeather } from './rewards';
import { createRng, type Rng } from './rng';
import { emptyValley } from './valley';
import { dayOf, dayStart } from './time';

const NOW = new Date(2026, 10, 23, 12, 0).getTime();
const PHRASE: Rng = () => 0; // карта «фраза + 5 золота»
const LOOK: PigeonLook = { pose: 'sit', size: 'medium', color: 'slate' };

const pigeon = (over: Partial<Pigeon> = {}): Pigeon => ({
  id: 'p1', company: 'Компания', look: LOOK, sentAt: NOW, status: 'flying', ...over,
});
/** Полдень через days календарных дней после NOW. */
const after = (days: number) => dayStart(dayOf(NOW) + days) + 12 * 3_600_000;

const newGame = (): GameState => ({ player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() });

describe('вид голубей', () => {
  it('на жёрдочке 5 разных голубей, видны все 4 цвета', () => {
    for (let seed = 1; seed < 50; seed++) {
      const { perch } = createLoft(createRng(seed));
      expect(perch).toHaveLength(BALANCE.pigeons.perchSize);
      expect(new Set(perch.map(lookKey)).size).toBe(perch.length);
      expect(new Set(perch.map((l) => l.color)).size).toBe(PIGEON_COLORS.length);
    }
  });

  it('новый голубь не похож ни на кого из тех, кто есть', () => {
    const taken = createLoft(createRng(3)).perch;
    for (let seed = 1; seed < 30; seed++) {
      const l = newLook(taken, createRng(seed));
      expect(taken.map(lookKey)).not.toContain(lookKey(l));
    }
  });

  it('улетевшего сменяет новый голубь, остальные остаются на местах', () => {
    const loft = createLoft(createRng(1));
    const r = launchPigeon(loft, 2, '  Ромашка  ', NOW, createRng(5), 'id-1');
    expect(r.pigeon).toEqual({ id: 'id-1', company: 'Ромашка', look: loft.perch[2], sentAt: NOW, status: 'flying' });
    expect(r.loft.perch).toHaveLength(5);
    expect(r.loft.perch.filter((_, i) => i !== 2)).toEqual(loft.perch.filter((_, i) => i !== 2));
    expect(loft.perch.map(lookKey)).not.toContain(lookKey(r.loft.perch[2]!));
    expect(new Set(r.loft.perch.map(lookKey)).size).toBe(5);
  });

  it('после многих отправок на жёрдочке по-прежнему все 4 цвета', () => {
    let loft = createLoft(createRng(1));
    const rng = createRng(9);
    for (let i = 0; i < 40; i++) {
      loft = launchPigeon(loft, i % 5, 'К', NOW, rng, `id-${i}`).loft;
      expect(new Set(loft.perch.map((l) => l.color)).size).toBe(PIGEON_COLORS.length);
      expect(new Set(loft.perch.map(lookKey)).size).toBe(5);
    }
  });

  it('без названия компании голубь не улетает', () => {
    expect(() => launchPigeon(createLoft(createRng(1)), 0, '   ', NOW, createRng(1), 'x')).toThrow();
  });
});

describe('дни в пути и вопросы', () => {
  it('дни в пути — календарные', () => {
    const late = new Date(2026, 10, 23, 23, 50).getTime();
    const p = pigeon({ sentAt: late });
    expect(daysInFlight(p, late + 20 * 60_000)).toBe(1); // после полуночи — уже первый день
    expect(daysInFlight(p, after(5))).toBe(5);
  });

  it('переход на летнее время не сдвигает дни', () => {
    // В Израиле летнее время в 2027 году начинается 26 марта.
    const sent = new Date(2027, 2, 20, 12, 0).getTime();
    const p = pigeon({ sentAt: sent });
    expect(daysInFlight(p, new Date(2027, 2, 30, 0, 30).getTime())).toBe(10);
    expect(dueQuestion(p, new Date(2027, 2, 30, 0, 30).getTime())).toBe(10);
    expect(isOverdue(p, new Date(2027, 3, 3, 23, 59).getTime())).toBe(false);
    expect(isOverdue(p, new Date(2027, 3, 4, 0, 1).getTime())).toBe(true);
  });

  it('спрашивает на 5-й и на 10-й день, каждый раз один раз', () => {
    let p = pigeon();
    expect(dueQuestion(p, after(4))).toBeNull();
    expect(dueQuestion(p, after(5))).toBe(5);
    p = markAsked(p, after(5)); // «Ещё нет»
    expect(dueQuestion(p, after(5) + 3_600_000)).toBeNull();
    expect(dueQuestion(p, after(9))).toBeNull();
    expect(dueQuestion(p, after(10))).toBe(10);
    p = markAsked(p, after(10));
    expect(dueQuestion(p, after(14))).toBeNull();
  });

  it('пропустила 5-й день — на 12-й спросит один раз', () => {
    let p = pigeon();
    expect(dueQuestion(p, after(12))).toBe(10);
    p = markAsked(p, after(12));
    expect(dueQuestion(p, after(13))).toBeNull();
  });

  it('вернувшийся голубь не спрашивает', () => {
    expect(dueQuestion(answerPigeon(pigeon(), 'rejected', after(6)), after(10))).toBeNull();
  });
});

describe('возвращение', () => {
  it('ответ можно отметить в любой день — голубь возвращается сразу', () => {
    const p = answerPigeon(pigeon(), 'invited', after(1));
    expect(p).toMatchObject({ status: 'returned', outcome: 'invited', returnedAt: after(1) });
    expect(() => answerPigeon(p, 'rejected', after(2))).toThrow();
  });

  it('15 дней без ответа — возвращается сам, на 14-й ещё нет', () => {
    const p = pigeon();
    expect(isOverdue(p, after(14))).toBe(false);
    expect(isOverdue(p, after(15))).toBe(true);
    expect(dueQuestion(p, after(15))).toBeNull();
    expect(returnSilent(p)).toMatchObject({
      status: 'returned',
      outcome: 'silence',
      returnedAt: dayStart(dayOf(NOW) + 15),
    });
  });

  it('позвали после возвращения с обычным пером — можно один раз', () => {
    const silent = returnSilent(pigeon());
    expect(canLateInvite(silent)).toBe(true);
    const late = lateInvite(silent);
    expect(late.lateInvite).toBe(true);
    expect(canLateInvite(late)).toBe(false);
    expect(canLateInvite(answerPigeon(pigeon(), 'invited', NOW))).toBe(false);
    expect(canLateInvite(pigeon())).toBe(false);
  });
});

describe('перья и плащ', () => {
  it('перья — по вернувшимся голубям, цвета и величины голубя; золотое — золотое', () => {
    const big: PigeonLook = { pose: 'look', size: 'large', color: 'rose' };
    const pigeons: Pigeon[] = [
      pigeon({ id: 'a', status: 'flying' }),
      answerPigeon(pigeon({ id: 'b', look: big }), 'invited', after(3)),
      answerPigeon(pigeon({ id: 'c' }), 'rejected', after(1)),
      lateInvite(returnSilent(pigeon({ id: 'd', look: big }))),
    ];
    expect(feathersOf(pigeons)).toEqual([
      { pigeonId: 'c', color: 'slate', size: 'medium' },
      { pigeonId: 'b', color: 'gold', size: 'large' },
      { pigeonId: 'd', color: 'rose', size: 'large' },
      { pigeonId: 'd+late', color: 'gold', size: 'large' },
    ]);
  });

  it('пороги плаща', () => {
    expect(cloakView(0)).toMatchObject({ stage: 0, title: null, next: { feathers: 5, title: 'Голубятница' } });
    expect(cloakView(5)).toMatchObject({ stage: 1, title: 'Голубятница', next: { feathers: 15 } });
    expect(cloakView(100)).toMatchObject({ stage: 6, title: 'Повелительница ветров', next: null });
    expect(thresholdsCrossed(4, 5)).toEqual([5]);
    expect(thresholdsCrossed(5, 6)).toEqual([]);
  });

  it('перо: опыт Зову, без серии, золота и карты; золотое — звезда', () => {
    const plain = applyFeather(createPlayer(), false, 0);
    expect(plain.report).toMatchObject({ golden: false, xp: 10, gold: 0, stars: 0, thresholds: [] });
    expect(plain.state.xp.call).toBe(10);
    expect(plain.state.streak).toEqual(createPlayer().streak);
    expect(plain.state.branchLastTouched).toEqual({});
    expect(plain.state.gold).toBe(0);

    const golden = applyFeather(createPlayer(), true, 0);
    expect(golden.report).toMatchObject({ golden: true, xp: 30, stars: 1 });
    expect(golden.state.stars).toBe(1);
  });

  it('пятое перо — порог плаща и звезда', () => {
    const r = applyFeather(createPlayer(), false, 4);
    expect(r.report.thresholds).toEqual([5]);
    expect(r.report.stars).toBe(1);
  });
});

describe('голубятня в игре', () => {
  it('отклик — мгновенное задание Зова: опыт, золото, карта, серия', () => {
    const loft = createLoft(createRng(1));
    const r = sendPigeon(newGame(), loft, 0, 'Ромашка', NOW, PHRASE, 'id-1');
    expect(r.done.report).toMatchObject({ branch: 'call', xp: 10, gold: 5 + BALANCE.loot.phraseGold });
    expect(r.done.report.loot?.kind).toBe('phrase');
    expect(r.state.player.streak.lastActiveDay).toBe(dayOf(NOW));
    expect(r.state.player.branchLastTouched.call).toBe(dayOf(NOW));
    expect(r.pigeon.status).toBe('flying');
    expect(new Set(r.loft.perch.map(lookKey)).size).toBe(5);
  });

  it('ответ приносит перо и не трогает серию', () => {
    const g = newGame();
    const r = answerPigeonAction(g, [pigeon()], 'p1', 'rejected', after(2));
    expect(r.pigeon.outcome).toBe('rejected');
    expect(r.feather.silent).toBe(false);
    expect(r.state.player.xp.call).toBe(10);
    expect(r.state.player.streak).toEqual(g.player.streak);
  });

  it('поздний ответ — ещё и золотое перо', () => {
    const r = lateInviteAction(newGame(), [returnSilent(pigeon())], 'p1');
    expect(r.pigeon.lateInvite).toBe(true);
    expect(r.feather.report).toMatchObject({ golden: true, stars: 1 });
  });

  it('при открытии вернувшиеся сами голуби приносят перья по порядку; порог считается верно', () => {
    const old = [1, 2, 3, 4].map((i) => answerPigeon(pigeon({ id: `old${i}` }), 'rejected', NOW));
    const flying = [pigeon({ id: 'x', sentAt: NOW + 1 }), pigeon({ id: 'y', sentAt: NOW }), pigeon({ id: 'z', sentAt: after(10) })];
    const r = returnOverduePigeons(newGame(), [...old, ...flying], after(16));
    expect(r.changed.map((p) => p.id)).toEqual(['y', 'x']);
    expect(r.feathers.map((f) => f.silent)).toEqual([true, true]);
    expect(r.feathers.map((f) => f.report.thresholds)).toEqual([[5], []]);
    expect(r.state.player.xp.call).toBe(20);
    expect(r.state.player.streak).toEqual(createPlayer().streak);
  });

  it('нечего возвращать — состояние то же', () => {
    const g = newGame();
    expect(returnOverduePigeons(g, [pigeon()], after(3)).state).toBe(g);
  });
});
