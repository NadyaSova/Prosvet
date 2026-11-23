import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createPlayer } from '../model/player';
import type { PlayerState } from '../model/types';
import { applyCompletion, refreshStreak } from './rewards';
import type { Rng } from './rng';
import { dayOf } from './time';

const NOW = new Date(2026, 10, 23, 12, 0).getTime();
const DAY_MS = 86_400_000;
/** Генератор, который всегда возвращает одно число: так карта добычи предсказуема. */
const fixed = (x: number): Rng => () => x;
const PHRASE = fixed(0); // карта «фраза + 5 золота»
const LOG = fixed(0.84);
const STAR = fixed(0.92);
const SEED = fixed(0.7);

describe('таймерное задание', () => {
  it('полное: опыт за минуты, золото, карта добычи', () => {
    const { state, report } = applyCompletion(createPlayer(), { kind: 'timed', branch: 'image', minutes: 30, full: true }, NOW, PHRASE);
    expect(report.xp).toBe(30);
    expect(state.xp.image).toBe(30);
    expect(report.loot?.kind).toBe('phrase');
    expect(state.gold).toBe(15 + BALANCE.loot.phraseGold);
    expect(state.branchLastTouched.image).toBe(dayOf(NOW));
  });

  it('досрочное: пропорционально, без карты добычи, но день засчитан', () => {
    const { state, report } = applyCompletion(createPlayer(), { kind: 'timed', branch: 'speech', minutes: 7, full: false }, NOW, PHRASE);
    expect(report.xp).toBe(7);
    expect(report.gold).toBe(3);
    expect(report.loot).toBeNull();
    expect(state.streak.lastActiveDay).toBe(dayOf(NOW));
  });
});

describe('мгновенные задания', () => {
  it('запись в журнал — опыт и золото Летописи, карта добычи', () => {
    const { state, report } = applyCompletion(createPlayer(), { kind: 'instant', branch: 'chronicle', instant: 'journal' }, NOW, PHRASE);
    expect(report.xp).toBe(BALANCE.xp.instant.journal);
    expect(state.xp.chronicle).toBe(BALANCE.xp.instant.journal);
    expect(report.gold).toBe(BALANCE.gold.instant.journal + BALANCE.loot.phraseGold);
    expect(report.loot?.kind).toBe('phrase');
  });
});

describe('уровни и звёзды', () => {
  it('новый общий уровень даёт звезду', () => {
    const p: PlayerState = { ...createPlayer(), xp: { ...createPlayer().xp, hunt: 45 } };
    const { state, report } = applyCompletion(p, { kind: 'timed', branch: 'image', minutes: 5, full: true }, NOW, PHRASE);
    expect(report.newLevel).toBe(2);
    expect(report.newBranchLevel).toBeNull();
    expect(report.stars).toBe(1);
    expect(state.stars).toBe(1);
  });

  it('звезда из карты добычи', () => {
    const { state } = applyCompletion(createPlayer(), { kind: 'timed', branch: 'image', minutes: 5, full: true }, NOW, STAR);
    expect(state.stars).toBe(1);
  });

  it('веха серии даёт звезду', () => {
    let p = createPlayer();
    for (let i = 0; i < 7; i++) {
      p = applyCompletion(p, { kind: 'timed', branch: 'hunt', minutes: 5, full: false }, NOW + i * DAY_MS, PHRASE).state;
    }
    expect(p.streak.milestoneReached).toBe(7);
    expect(p.stars).toBeGreaterThanOrEqual(1);
  });
});

describe('добыча', () => {
  it('полено идёт в запас', () => {
    const { state } = applyCompletion(createPlayer(), { kind: 'timed', branch: 'image', minutes: 5, full: true }, NOW, LOG);
    expect(state.streak.logs).toBe(1);
  });

  it('если запас полон, полено превращается в золото', () => {
    const p = createPlayer();
    const full = { ...p, streak: { ...p.streak, logs: BALANCE.streak.maxLogs } };
    const { state, report } = applyCompletion(full, { kind: 'timed', branch: 'image', minutes: 5, full: true }, NOW, LOG);
    expect(report.logConverted).toBe(true);
    expect(state.streak.logs).toBe(BALANCE.streak.maxLogs);
    expect(state.gold).toBe(3 + BALANCE.loot.logOverflowGold);
  });

  it('семя попадает в запас декора', () => {
    const { state } = applyCompletion(createPlayer(), { kind: 'timed', branch: 'image', minutes: 5, full: true }, NOW, SEED);
    expect(state.inventory).toHaveLength(1);
  });
});

describe('проверка серии при открытии', () => {
  it('сообщает о сгоревшем полене', () => {
    let p = applyCompletion(createPlayer(), { kind: 'timed', branch: 'image', minutes: 5, full: true }, NOW, LOG).state;
    const r = refreshStreak(p, NOW + 4 * DAY_MS);
    expect(r.logsBurned).toBe(1);
    expect(r.broken).toBe(false);
    p = r.state;
    expect(p.streak.logs).toBe(0);
  });

  it('без изменений возвращает то же состояние', () => {
    const p = createPlayer();
    expect(refreshStreak(p, NOW).state).toBe(p);
  });
});
