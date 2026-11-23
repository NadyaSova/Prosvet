// Лавка. SPEC.md §9.3, §9.5. Чистые функции: время, генератор случайных чисел и id — в параметрах.
//
// За золото — внутренние награды: саженцы (ждут в запасе, место выбирает пользователь), редкости
// (встают на свои места сразу), вещи лагеря (каждая одна). За звёзды — внешние призы: пользователь
// сама заводит призы, покупка выдаёт купон. «Свой купон» — разовый, без заведённого приза.

import { BALANCE } from '../config/balance';
import {
  CAMP_KINDS,
  DECOR_KINDS,
  type CampKind,
  type Coupon,
  type DecorKind,
  type PlantKind,
  type PlayerState,
  type Prize,
  type ShopState,
  type ValleyDecor,
  type ValleyState,
} from '../model/types';
import type { Rng } from './rng';
import { addCampItem, isDistrictOpen, plantItem } from './valley';

export function emptyShop(): ShopState {
  return { prizes: [], coupons: [] };
}

// Лавка за золото

export type Good =
  | { kind: 'plant'; id: PlantKind; price: number }
  | { kind: 'decor'; id: DecorKind; price: number }
  | { kind: 'camp'; id: CampKind; price: number };

/** Товары за золото по разделам, от дешёвых к дорогим. Цены — BALANCE.shop. */
const byPrice = <G extends Good>(list: G[]): G[] => list.sort((a, b) => a.price - b.price);

export const GOODS: readonly Good[] = [
  ...byPrice(Object.entries(BALANCE.shop.plants).map(([id, price]) => ({ kind: 'plant' as const, id: id as PlantKind, price }))),
  ...byPrice(DECOR_KINDS.map((id) => ({ kind: 'decor' as const, id, price: BALANCE.shop.decor[id] }))),
  ...byPrice(CAMP_KINDS.map((id) => ({ kind: 'camp' as const, id, price: BALANCE.shop.camp[id] }))),
];

/**
 * Можно ли купить: ok; gold — не хватает золота; full — район полон, растению негде расти;
 * max — у редкостей этого вида заняты все места; owned — такая вещь лагеря уже есть.
 */
export type GoodStatus = 'ok' | 'gold' | 'full' | 'max' | 'owned';

interface Wallet {
  player: PlayerState;
  valley: ValleyState;
}

/** Сколько редкостей этого вида уже есть: в долине и в запасе. */
function decorCount(w: Wallet, kind: DecorKind): number {
  return w.valley.decor.filter((d) => d.kind === kind).length + w.player.inventory.filter((i) => i === kind).length;
}

export function goodStatus(w: Wallet, good: Good): GoodStatus {
  if (good.kind === 'camp' && w.valley.camp.includes(good.id)) return 'owned';
  if (good.kind === 'decor' && decorCount(w, good.id) >= BALANCE.shop.decorMax[good.id]) return 'max';
  if (good.kind === 'plant' && isDistrictOpen(w.valley)) return 'full';
  if (w.player.gold < good.price) return 'gold';
  return 'ok';
}

/**
 * Покупка за золото. Саженец уходит в запас (посадить — кнопкой «Посадить», место выбирает пользователь),
 * редкость и вещь лагеря сразу появляются в долине. null — купить нельзя (см. goodStatus).
 */
export function buyGood<S extends Wallet>(
  state: S,
  good: Good,
  now: number,
  rng: Rng,
): { state: S; placed: ValleyDecor | null } | null {
  if (goodStatus(state, good) !== 'ok') return null;
  const player = { ...state.player, gold: state.player.gold - good.price };
  switch (good.kind) {
    case 'plant':
      return { state: { ...state, player: { ...player, inventory: [...player.inventory, good.id] } }, placed: null };
    case 'decor': {
      const r = plantItem(state.valley, good.id, now, rng);
      if (!r) return null;
      return { state: { ...state, player, valley: r.valley }, placed: r.object as ValleyDecor };
    }
    case 'camp': {
      const valley = addCampItem(state.valley, good.id);
      if (!valley) return null;
      return { state: { ...state, player, valley }, placed: null };
    }
  }
}

// Внешние призы и купоны

export interface PrizeInput {
  title: string;
  price: number;
  icon?: string;
}

/** Название без лишних пробелов, цена — целое от 1 до maxStars. null — так сохранить нельзя. */
export function cleanPrizeInput(input: PrizeInput): PrizeInput | null {
  const title = input.title.trim().replace(/\s+/g, ' ');
  const price = input.price;
  if (!title || !Number.isInteger(price) || price < 1 || price > BALANCE.shop.maxStars) return null;
  const clean: PrizeInput = { title, price };
  const icon = input.icon?.trim();
  if (icon) clean.icon = icon;
  return clean;
}

/** Новый приз или правка старого (по id). Призы — в порядке создания. null — неверные поля. */
export function savePrize(shop: ShopState, input: PrizeInput, id: string, now: number): ShopState | null {
  const clean = cleanPrizeInput(input);
  if (!clean) return null;
  const old = shop.prizes.find((p) => p.id === id);
  const prize: Prize = { id, ...clean, createdAt: old?.createdAt ?? now };
  const prizes = old ? shop.prizes.map((p) => (p.id === id ? prize : p)) : [...shop.prizes, prize];
  return { ...shop, prizes };
}

/** Удаляет приз. Купленные по нему купоны остаются как были. */
export function removePrize(shop: ShopState, id: string): ShopState {
  return { ...shop, prizes: shop.prizes.filter((p) => p.id !== id) };
}

/**
 * Покупка купона за звёзды: по заведённому призу (prizeId) или «свой купон» (без prizeId).
 * null — не хватает звёзд или неверные поля.
 */
export function buyCoupon(
  player: PlayerState,
  shop: ShopState,
  input: PrizeInput & { prizeId?: string },
  id: string,
  now: number,
): { player: PlayerState; shop: ShopState; coupon: Coupon } | null {
  const clean = cleanPrizeInput(input);
  if (!clean || player.stars < clean.price) return null;
  const coupon: Coupon = { id, ...clean, boughtAt: now, status: 'bought' };
  if (input.prizeId) coupon.prizeId = input.prizeId;
  return {
    player: { ...player, stars: player.stars - clean.price },
    shop: { ...shop, coupons: [coupon, ...shop.coupons] },
    coupon,
  };
}

/** Отметка «выдан» (given = true) или её отмена — если нажала по ошибке. */
export function setCouponGiven(shop: ShopState, id: string, given: boolean, now: number): ShopState {
  return {
    ...shop,
    coupons: shop.coupons.map((c) => {
      if (c.id !== id) return c;
      if (given) return { ...c, status: 'given', givenAt: now };
      const { givenAt: _givenAt, ...rest } = c;
      return { ...rest, status: 'bought' };
    }),
  };
}

/** История купонов: сначала ждущие выдачи (свежие сверху), потом выданные (недавно выданные сверху). */
export function couponHistory(coupons: readonly Coupon[]): { waiting: Coupon[]; given: Coupon[] } {
  const waiting = coupons.filter((c) => c.status === 'bought').sort((a, b) => b.boughtAt - a.boughtAt);
  const given = coupons
    .filter((c) => c.status === 'given')
    .sort((a, b) => (b.givenAt ?? b.boughtAt) - (a.givenAt ?? a.boughtAt));
  return { waiting, given };
}
