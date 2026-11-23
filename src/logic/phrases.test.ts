import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { pickPhrase } from './phrases';
import { createRng } from './rng';

describe('фразы', () => {
  it('маленький пул: не повторяется, пока не покажут весь', () => {
    const pool = ['а', 'б', 'в'];
    const rng = createRng(1);
    let recent: string[] = [];
    for (let round = 0; round < 20; round++) {
      const shown: string[] = [];
      for (let i = 0; i < pool.length; i++) {
        const r = pickPhrase(pool, recent, rng);
        shown.push(r.phrase);
        recent = r.recent;
      }
      // После первого круга каждые 3 показа подряд — все три фразы.
      expect(new Set(shown).size).toBe(3);
    }
  });

  it('большой пул: фраза не повторяется в окне noRepeatWindow', () => {
    const pool = Array.from({ length: 30 }, (_, i) => `фраза ${i}`);
    const rng = createRng(2);
    let recent: string[] = [];
    const shown: string[] = [];
    for (let i = 0; i < 300; i++) {
      const r = pickPhrase(pool, recent, rng);
      shown.push(r.phrase);
      recent = r.recent;
    }
    const w = BALANCE.phrases.noRepeatWindow;
    for (let i = w; i < shown.length; i++) {
      expect(shown.slice(i - w, i)).not.toContain(shown[i]);
    }
  });

  it('история других пулов не мешает', () => {
    const r = pickPhrase(['одна'], ['чужая', 'одна'], createRng(3));
    expect(r.phrase).toBe('одна');
    expect(r.recent).toEqual(['чужая', 'одна']);
  });
});
