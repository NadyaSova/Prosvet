import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { drawLoot } from './loot';
import { createRng } from './rng';

describe('генератор случайных чисел', () => {
  it('одинаковый сид — одинаковая последовательность', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it('числа в [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('карта добычи', () => {
  it('веса в сумме дают 100%', () => {
    expect(BALANCE.loot.table.reduce((s, r) => s + r.weight, 0)).toBe(100);
  });

  it('границы вероятностей', () => {
    expect(drawLoot(() => 0).kind).toBe('phrase');
    expect(drawLoot(() => 0.4499).kind).toBe('phrase');
    expect(drawLoot(() => 0.45).kind).toBe('gold');
    expect(drawLoot(() => 0.7).kind).toBe('seed');
    expect(drawLoot(() => 0.84).kind).toBe('log');
    expect(drawLoot(() => 0.92).kind).toBe('star');
    expect(drawLoot(() => 0.98).kind).toBe('rare');
    expect(drawLoot(() => 0.99999).kind).toBe('rare');
  });

  it('частоты на большом числе вытягиваний совпадают с таблицей', () => {
    const rng = createRng(2026);
    const n = 100_000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const kind = drawLoot(rng).kind;
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    for (const row of BALANCE.loot.table) {
      expect((counts[row.kind] ?? 0) / n).toBeCloseTo(row.weight / 100, 2);
    }
  });

  it('семена и редкости берутся из списков баланса', () => {
    const rng = createRng(1);
    for (let i = 0; i < 2000; i++) {
      const card = drawLoot(rng);
      if (card.kind === 'seed') expect(BALANCE.loot.seeds).toContain(card.item);
      if (card.kind === 'rare') expect(BALANCE.loot.rareDecor).toContain(card.item);
    }
  });
});
