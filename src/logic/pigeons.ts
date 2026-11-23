// Голуби и перья. SPEC.md §9.4.
// Чистые функции: время и генератор случайных чисел — в параметрах.
//
// Цикл голубя: отправила отклик → голубь улетает. На 5-й и 10-й день пути он спрашивает «Компания ответила?».
// Ответ можно отметить в любой день: «Отказали» — обычное перо, «Позвали дальше» — золотое.
// Нет ответа 15 дней — голубь возвращается сам с обычным пером.
// Позвали уже после возвращения с обычным пером — ещё и золотое перо (обычное остаётся).

import { BALANCE } from '../config/balance';
import {
  PIGEON_COLORS,
  PIGEON_POSES,
  PIGEON_SIZES,
  type LoftState,
  type Pigeon,
  type PigeonColor,
  type PigeonLook,
  type PigeonSize,
} from '../model/types';
import { pickFrom, type Rng } from './rng';
import { dayOf, dayStart } from './time';

export const lookKey = (l: PigeonLook) => `${l.pose}/${l.size}/${l.color}`;

export function sameLook(a: PigeonLook, b: PigeonLook): boolean {
  return lookKey(a) === lookKey(b);
}

const ALL_LOOKS: readonly PigeonLook[] = PIGEON_POSES.flatMap((pose) =>
  PIGEON_SIZES.flatMap((size) => PIGEON_COLORS.map((color) => ({ pose, size, color }))),
);

/**
 * Новый голубь, не похожий на тех, кто уже есть: другое сочетание позы, размера и цвета.
 * Из свободных сочетаний берём те, у которых меньше всего совпадений по цвету, потом по размеру, потом по позе, —
 * так на жёрдочке видны все цвета и разные размеры. exclude — сочетания, которые нельзя брать, но и не считать
 * (улетевший голубь: на его место прилетает другой).
 */
export function newLook(taken: readonly PigeonLook[], rng: Rng, exclude: readonly PigeonLook[] = []): PigeonLook {
  const keys = new Set([...taken, ...exclude].map(lookKey));
  const free = ALL_LOOKS.filter((l) => !keys.has(lookKey(l)));
  if (free.length === 0) return pickFrom(ALL_LOOKS, rng);
  const score = (l: PigeonLook) => {
    const count = (f: (t: PigeonLook) => boolean) => taken.filter(f).length;
    return [count((t) => t.color === l.color), count((t) => t.size === l.size), count((t) => t.pose === l.pose)];
  };
  const scored = free.map((l) => ({ l, s: score(l) }));
  let best = scored;
  for (let i = 0; i < 3; i++) {
    const min = Math.min(...best.map((x) => x.s[i]!));
    best = best.filter((x) => x.s[i] === min);
  }
  return pickFrom(best, rng).l;
}

/** Жёрдочка из разных голубей. */
export function createLoft(rng: Rng): LoftState {
  const perch: PigeonLook[] = [];
  for (let i = 0; i < BALANCE.pigeons.perchSize; i++) perch.push(newLook(perch, rng));
  return { perch };
}

/**
 * Голубь с жёрдочки улетает с откликом; на его место прилетает новый, не похожий ни на кого из пяти.
 */
export function launchPigeon(
  loft: LoftState,
  index: number,
  company: string,
  now: number,
  rng: Rng,
  id: string,
): { loft: LoftState; pigeon: Pigeon } {
  const look = loft.perch[index];
  if (!look) throw new Error('На этом месте нет голубя');
  const name = company.trim();
  if (!name) throw new Error('Нужно название компании');
  const perch = [...loft.perch];
  perch[index] = newLook(
    loft.perch.filter((_, i) => i !== index),
    rng,
    [look],
  );
  return { loft: { perch }, pigeon: { id, company: name, look, sentAt: now, status: 'flying' } };
}

/** Сколько дней голубь в пути: по календарным дням, в день отправки — 0. */
export function daysInFlight(p: Pigeon, now: number): number {
  return dayOf(now) - dayOf(p.sentAt);
}

/**
 * Пора ли спросить «Компания ответила?». Возвращает день вопроса (5 или 10) или null.
 * Каждый вопрос задаётся один раз: если не открывала приложение на 5-й день, а открыла на 12-й, — спросит один раз.
 */
export function dueQuestion(p: Pigeon, now: number): number | null {
  if (p.status !== 'flying') return null;
  const days = daysInFlight(p, now);
  if (days >= BALANCE.pigeons.returnAfterDays) return null;
  const due = BALANCE.pigeons.askOnDays.filter((d) => days >= d);
  if (due.length === 0) return null;
  const askDay = Math.max(...due);
  const askedOn = p.lastAskedAt === undefined ? -1 : dayOf(p.lastAskedAt) - dayOf(p.sentAt);
  return askedOn >= askDay ? null : askDay;
}

/** «Ещё нет». */
export function markAsked(p: Pigeon, now: number): Pigeon {
  return { ...p, lastAskedAt: now };
}

/** Ответ отмечен: голубь возвращается сразу. */
export function answerPigeon(p: Pigeon, outcome: 'rejected' | 'invited', now: number): Pigeon {
  if (p.status !== 'flying') throw new Error('Голубь уже вернулся');
  return { ...p, status: 'returned', outcome, returnedAt: now };
}

/** Можно ли отметить «всё-таки позвали» для вернувшегося голубя. */
export function canLateInvite(p: Pigeon): boolean {
  return p.status === 'returned' && p.outcome !== 'invited' && !p.lateInvite;
}

export function lateInvite(p: Pigeon): Pigeon {
  if (!canLateInvite(p)) throw new Error('Для этого голубя золотое перо уже есть или он ещё в пути');
  return { ...p, lateInvite: true };
}

/** Нет ответа 15 дней — голубь возвращается сам. Время возвращения — начало 15-го дня пути. */
export function isOverdue(p: Pigeon, now: number): boolean {
  return p.status === 'flying' && daysInFlight(p, now) >= BALANCE.pigeons.returnAfterDays;
}

export function returnSilent(p: Pigeon): Pigeon {
  return {
    ...p,
    status: 'returned',
    outcome: 'silence',
    returnedAt: dayStart(dayOf(p.sentAt) + BALANCE.pigeons.returnAfterDays),
  };
}

// Перья и плащ

export interface Feather {
  pigeonId: string;
  /** Обычное перо — цвета голубя; золотое — золотое. */
  color: PigeonColor | 'gold';
  /** Величиной — как голубь. */
  size: PigeonSize;
}

/** Все перья, по порядку возвращения голубей. Перья выводятся из голубей и отдельно не хранятся. */
export function feathersOf(pigeons: readonly Pigeon[]): Feather[] {
  const returned = pigeons
    .filter((p) => p.status === 'returned')
    .sort((a, b) => (a.returnedAt ?? a.sentAt) - (b.returnedAt ?? b.sentAt));
  const result: Feather[] = [];
  for (const p of returned) {
    const { size } = p.look;
    if (p.outcome === 'invited') result.push({ pigeonId: p.id, color: 'gold', size });
    else {
      result.push({ pigeonId: p.id, color: p.look.color, size });
      if (p.lateInvite) result.push({ pigeonId: `${p.id}+late`, color: 'gold', size });
    }
  }
  return result;
}

export interface CloakView {
  feathers: number;
  /** Сколько порогов пройдено (0 — ни одного). По нему рисуется плащ. */
  stage: number;
  /** Титул последнего пройденного порога. */
  title: string | null;
  /** Следующий порог. null — все пройдены. */
  next: { feathers: number; title: string } | null;
}

export function cloakView(feathers: number): CloakView {
  const passed = BALANCE.cloak.thresholds.filter((t) => feathers >= t.feathers);
  const next = BALANCE.cloak.thresholds.find((t) => feathers < t.feathers) ?? null;
  return {
    feathers,
    stage: passed.length,
    title: passed.at(-1)?.title ?? null,
    next: next && { feathers: next.feathers, title: next.title },
  };
}

/** Пороги плаща, пройденные при переходе от before перьев к after. */
export function thresholdsCrossed(before: number, after: number): number[] {
  return BALANCE.cloak.thresholds.filter((t) => before < t.feathers && t.feathers <= after).map((t) => t.feathers);
}
