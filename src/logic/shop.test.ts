import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createPlayer } from '../model/player';
import type { PlayerState, ValleyState } from '../model/types';
import { createRng } from './rng';
import {
  buyCoupon,
  buyGood,
  cleanPrizeInput,
  couponHistory,
  emptyShop,
  GOODS,
  goodStatus,
  removePrize,
  savePrize,
  setCouponGiven,
  type Good,
} from './shop';
import { CAPACITY, emptyValley, plantForCompletion } from './valley';

const NOW = new Date(2026, 10, 23, 12, 0).getTime();
const good = (id: string): Good => GOODS.find((g) => g.id === id)!;
const rich = (gold = 1000, stars = 0): PlayerState => ({ ...createPlayer(), gold, stars });

function fullValley(): ValleyState {
  let v = emptyValley();
  for (let i = 0; i < CAPACITY; i++) v = plantForCompletion(v, { kind: 'timed', branch: 'call', minutes: 5, full: true }, NOW + i, createRng(i))!.valley;
  return v;
}

describe('лавка за золото', () => {
  it('в каждом разделе товары от дешёвых к дорогим, цены — из конфига', () => {
    for (const kind of ['plant', 'decor', 'camp'] as const) {
      const prices = GOODS.filter((g) => g.kind === kind).map((g) => g.price);
      expect(prices.length).toBeGreaterThan(0);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
    expect(good('rowan').price).toBe(BALANCE.shop.plants.rowan);
    expect(good('tent').price).toBe(BALANCE.shop.camp.tent);
  });

  it('саженец уходит в запас, золото списывается', () => {
    const r = buyGood({ player: rich(100), valley: emptyValley() }, good('rowan'), NOW, createRng(1))!;
    expect(r.state.player.gold).toBe(100 - BALANCE.shop.plants.rowan);
    expect(r.state.player.inventory).toEqual(['rowan']);
    expect(r.state.valley.plants).toHaveLength(0);
    expect(r.placed).toBeNull();
  });

  it('редкость сразу встаёт в долину', () => {
    const r = buyGood({ player: rich(), valley: emptyValley() }, good('deer'), NOW, createRng(1))!;
    expect(r.state.valley.decor).toHaveLength(1);
    expect(r.placed).toMatchObject({ kind: 'deer' });
    expect(r.state.player.inventory).toEqual([]);
  });

  it('вещь лагеря — одна', () => {
    const w = { player: rich(), valley: emptyValley() };
    const r = buyGood(w, good('lantern'), NOW, createRng(1))!;
    expect(r.state.valley.camp).toEqual(['lantern']);
    expect(goodStatus(r.state, good('lantern'))).toBe('owned');
    expect(buyGood(r.state, good('lantern'), NOW, createRng(1))).toBeNull();
  });

  it('не хватает золота — купить нельзя', () => {
    const w = { player: rich(BALANCE.shop.plants.apple - 1), valley: emptyValley() };
    expect(goodStatus(w, good('apple'))).toBe('gold');
    expect(buyGood(w, good('apple'), NOW, createRng(1))).toBeNull();
  });

  it('редкостей не больше, чем мест для них, считая выпавшие в запасе', () => {
    let w = { player: { ...rich(), inventory: ['deer'] }, valley: emptyValley() };
    for (let i = 1; i < BALANCE.shop.decorMax.deer; i++) w = buyGood(w, good('deer'), NOW + i, createRng(i))!.state;
    expect(goodStatus(w, good('deer'))).toBe('max');
  });

  it('в полной долине саженцы не продаются, а вещи лагеря — да', () => {
    const w = { player: rich(), valley: fullValley() };
    expect(goodStatus(w, good('flowers'))).toBe('full');
    expect(goodStatus(w, good('tent'))).toBe('ok');
  });
});

describe('призы и купоны', () => {
  it('название без лишних пробелов, цена — целое от 1 до максимума', () => {
    expect(cleanPrizeInput({ title: '  Массаж   от мужа ', price: 3, icon: ' ' })).toEqual({ title: 'Массаж от мужа', price: 3 });
    expect(cleanPrizeInput({ title: ' ', price: 3 })).toBeNull();
    expect(cleanPrizeInput({ title: 'А', price: 0 })).toBeNull();
    expect(cleanPrizeInput({ title: 'А', price: 1.5 })).toBeNull();
    expect(cleanPrizeInput({ title: 'А', price: BALANCE.shop.maxStars + 1 })).toBeNull();
  });

  it('приз создаётся, правится (дата создания остаётся) и удаляется', () => {
    let shop = savePrize(emptyShop(), { title: 'Массаж', price: 3, icon: '💆' }, 'p1', NOW)!;
    shop = savePrize(shop, { title: 'Ужин', price: 2 }, 'p2', NOW + 1)!;
    shop = savePrize(shop, { title: 'Массаж от мужа', price: 4 }, 'p1', NOW + 2)!;
    expect(shop.prizes).toEqual([
      { id: 'p1', title: 'Массаж от мужа', price: 4, createdAt: NOW },
      { id: 'p2', title: 'Ужин', price: 2, createdAt: NOW + 1 },
    ]);
    expect(savePrize(shop, { title: '', price: 2 }, 'p3', NOW)).toBeNull();
    expect(removePrize(shop, 'p1').prizes.map((p) => p.id)).toEqual(['p2']);
  });

  it('покупка приза: звёзды списываются, купон копирует название, цену и значок', () => {
    const shop = savePrize(emptyShop(), { title: 'Массаж', price: 3, icon: '💆' }, 'p1', NOW)!;
    const r = buyCoupon(rich(0, 5), shop, { ...shop.prizes[0]!, prizeId: 'p1' }, 'c1', NOW)!;
    expect(r.player.stars).toBe(2);
    expect(r.coupon).toEqual({ id: 'c1', title: 'Массаж', price: 3, icon: '💆', prizeId: 'p1', boughtAt: NOW, status: 'bought' });
    expect(r.shop.coupons).toEqual([r.coupon]);
    // Приз остаётся: его можно купить ещё раз.
    expect(r.shop.prizes).toHaveLength(1);
    // Удаление приза не трогает купон.
    expect(removePrize(r.shop, 'p1').coupons).toEqual([r.coupon]);
  });

  it('свой купон — без приза, в призы не попадает', () => {
    const r = buyCoupon(rich(0, 2), emptyShop(), { title: 'Прогулка у моря', price: 2 }, 'c1', NOW)!;
    expect(r.player.stars).toBe(0);
    expect(r.coupon).not.toHaveProperty('prizeId');
    expect(r.shop.prizes).toEqual([]);
  });

  it('не хватает звёзд — купона нет', () => {
    expect(buyCoupon(rich(0, 2), emptyShop(), { title: 'Вечер без дел', price: 4 }, 'c1', NOW)).toBeNull();
  });

  it('«выдан» отмечается и снимается; история: сначала ждущие, потом выданные', () => {
    let shop = emptyShop();
    let player = rich(0, 10);
    for (const [id, at] of [['a', NOW], ['b', NOW + 1], ['c', NOW + 2]] as const) {
      const r = buyCoupon(player, shop, { title: id, price: 1 }, id, at)!;
      player = r.player;
      shop = r.shop;
    }
    shop = setCouponGiven(shop, 'a', true, NOW + 10);
    shop = setCouponGiven(shop, 'c', true, NOW + 5);
    const h = couponHistory(shop.coupons);
    expect(h.waiting.map((c) => c.id)).toEqual(['b']);
    expect(h.given.map((c) => c.id)).toEqual(['a', 'c']);
    expect(h.given[0]).toMatchObject({ status: 'given', givenAt: NOW + 10 });

    const undone = setCouponGiven(shop, 'a', false, NOW + 11).coupons.find((c) => c.id === 'a')!;
    expect(undone.status).toBe('bought');
    expect(undone).not.toHaveProperty('givenAt');
  });
});
