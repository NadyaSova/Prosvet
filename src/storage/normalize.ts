// Приводит прочитанные из базы или из резервной копии записи к текущему формату.
// Если в новой версии у записи появилось поле, старые данные получают значение по умолчанию —
// так добавление полей не требует отдельной миграции.

import { BALANCE } from '../config/balance';
import type { RunningTask } from '../logic/game';
import { ENTRY_PARTS, normalizeSkills } from '../logic/journal';
import { lookKey } from '../logic/pigeons';
import { cleanFinding } from '../logic/stop-questions';
import { CAPACITY } from '../logic/valley';
import { LANDMARK_SITES } from '../logic/valley-district';
import { createPlayer } from '../model/player';
import {
  BRANCHES,
  CAMP_KINDS,
  DECOR_KINDS,
  GARDEN_KINDS,
  LANDMARK_KINDS,
  type Achievement,
  type Boss,
  type BossSession,
  type Branch,
  type GardenKind,
  type LandmarkKind,
  type Coupon,
  type Finding,
  type TaskTemplate,
  type Prize,
  type ShopState,
  PIGEON_COLORS,
  PIGEON_POSES,
  PIGEON_SIZES,
  PLANT_KINDS,
  PLANT_SIZES,
  type BoardState,
  type LoftState,
  type Pigeon,
  type PigeonLook,
  type PigeonOutcome,
  type PlayerState,
  type Settings,
  type ValleyDecor,
  type ValleyLandmark,
  type ValleyPlant,
  type ValleyState,
} from '../model/types';
import type { PhraseHistory } from './db';

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function createSettings(now: number): Settings {
  return { createdAt: now, lastBackupAt: null, hiddenTaskIds: [] };
}

/**
 * Ветки фазы 1, которых больше нет (docs/phase2-plan.md §4.9): опыт и всё остальное Облика уходит в Летопись
 * (резюме и LinkedIn теперь там), Речь переименована в Подготовку.
 */
const OLD_BRANCHES: Record<string, Branch> = { image: 'chronicle', speech: 'prep' };

/** Ветка из базы или копии — с переносом старых веток. null — неизвестная ветка. */
export function migrateBranch(raw: unknown): Branch | null {
  if (typeof raw !== 'string') return null;
  const b = OLD_BRANCHES[raw] ?? raw;
  return BRANCHES.includes(b as Branch) ? (b as Branch) : null;
}

export function normalizePlayer(raw: unknown): PlayerState {
  const d = createPlayer();
  if (!isObject(raw)) return d;
  // Шрамы убраны на шаге 4 (их заменили голуби и перья) — старые поля отбрасываем.
  const { scars: _scars, scarsTotal: _scarsTotal, ...rest } = raw;
  // Опыт старой ветки складывается с опытом новой; «трогали в последний раз» — самый поздний день.
  const xp = { ...d.xp };
  for (const [key, value] of Object.entries(isObject(raw.xp) ? raw.xp : {})) {
    const b = migrateBranch(key);
    if (b && typeof value === 'number' && Number.isFinite(value)) xp[b] += value;
  }
  const touched: PlayerState['branchLastTouched'] = {};
  for (const [key, day] of Object.entries(isObject(raw.branchLastTouched) ? raw.branchLastTouched : {})) {
    const b = migrateBranch(key);
    if (b && typeof day === 'number') touched[b] = Math.max(touched[b] ?? day, day);
  }
  return {
    ...d,
    ...rest,
    xp,
    streak: { ...d.streak, ...(isObject(raw.streak) ? raw.streak : {}) },
    branchLastTouched: touched,
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
  } as PlayerState;
}

/** Своё задание из базы или копии. null — без id или с неизвестной веткой. */
export function normalizeTask(raw: unknown): TaskTemplate | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null;
  const branch = migrateBranch(raw.branch);
  if (!branch) return null;
  return { ...raw, branch } as TaskTemplate;
}

export function normalizeTasks(raw: readonly unknown[]): TaskTemplate[] {
  return raw.map(normalizeTask).filter((t) => t !== null);
}

export function normalizeSettings(raw: unknown, now: number): Settings {
  const d = createSettings(now);
  if (!isObject(raw)) return d;
  return {
    ...d,
    ...raw,
    hiddenTaskIds: Array.isArray(raw.hiddenTaskIds) ? raw.hiddenTaskIds : [],
  } as Settings;
}

export function normalizeBoard(raw: unknown): BoardState {
  if (!isObject(raw)) return { taskIds: [], rerolls: null };
  return {
    taskIds: Array.isArray(raw.taskIds) ? raw.taskIds.filter((id) => typeof id === 'string') : [],
    rerolls: isObject(raw.rerolls) ? (raw.rerolls as BoardState['rerolls']) : null,
  };
}

export function normalizeTimer(raw: unknown): RunningTask | null {
  if (
    !isObject(raw) ||
    typeof raw.startedAt !== 'number' ||
    typeof raw.durationMs !== 'number' ||
    typeof raw.templateId !== 'string' ||
    typeof raw.title !== 'string' ||
    !migrateBranch(raw.branch)
  ) {
    return null;
  }
  return { pausedAt: null, pausedMs: 0, pausesUsed: 0, ...raw, branch: migrateBranch(raw.branch) } as RunningTask;
}

function normalizeLook(raw: unknown): PigeonLook | null {
  if (!isObject(raw)) return null;
  const { pose, size, color } = raw;
  if (!PIGEON_POSES.includes(pose as never) || !PIGEON_SIZES.includes(size as never) || !PIGEON_COLORS.includes(color as never)) {
    return null;
  }
  return { pose, size, color } as PigeonLook;
}

/** Жёрдочка. null — записи нет или она испорчена: тогда приложение создаёт новую. */
export function normalizeLoft(raw: unknown): LoftState | null {
  if (!isObject(raw) || !Array.isArray(raw.perch)) return null;
  const perch = raw.perch.map(normalizeLook);
  if (perch.length !== BALANCE.pigeons.perchSize || perch.some((l) => l === null)) return null;
  const looks = perch as PigeonLook[];
  if (new Set(looks.map(lookKey)).size !== looks.length) return null;
  return { perch: looks };
}

const DEFAULT_LOOK: PigeonLook = { pose: 'sit', size: 'medium', color: 'slate' };

/** Голубь из базы или копии. null — запись без id, компании или даты отправки. */
export function normalizePigeon(raw: unknown): Pigeon | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.company !== 'string' || typeof raw.sentAt !== 'number') {
    return null;
  }
  const look = normalizeLook(raw.look) ?? DEFAULT_LOOK;
  const outcome = ['silence', 'rejected', 'invited'].includes(raw.outcome as string) ? (raw.outcome as PigeonOutcome) : undefined;
  const returned = raw.status === 'returned' && outcome !== undefined;
  const p: Pigeon = { id: raw.id, company: raw.company, look, sentAt: raw.sentAt, status: returned ? 'returned' : 'flying' };
  if (returned) {
    p.outcome = outcome;
    p.returnedAt = typeof raw.returnedAt === 'number' ? raw.returnedAt : raw.sentAt;
    if (raw.lateInvite === true && outcome !== 'invited') p.lateInvite = true;
  }
  if (typeof raw.lastAskedAt === 'number') p.lastAskedAt = raw.lastAskedAt;
  return p;
}

export function normalizePigeons(raw: readonly unknown[]): Pigeon[] {
  return raw.map(normalizePigeon).filter((p) => p !== null);
}

/**
 * Запись Летописи из базы или копии. null — без id или заголовка. Непонятный статус — черновик.
 */
export function normalizeAchievement(raw: unknown): Achievement | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : 0;
  const a: Achievement = {
    id: raw.id,
    createdAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt,
    title: raw.title,
    status: raw.status === 'complete' ? 'complete' : 'draft',
  };
  for (const p of ENTRY_PARTS) {
    const v = raw[p];
    if (typeof v === 'string' && v.trim() !== '') a[p] = v;
  }
  const skills = Array.isArray(raw.skills) ? normalizeSkills(raw.skills.filter((s) => typeof s === 'string')) : [];
  if (skills.length > 0) a.skills = skills;
  return a;
}

export function normalizeAchievements(raw: readonly unknown[]): Achievement[] {
  return raw.map(normalizeAchievement).filter((a) => a !== null);
}

export function normalizePhrases(raw: unknown): PhraseHistory {
  if (!isObject(raw) || !Array.isArray(raw.recent)) return { recent: [] };
  return { recent: raw.recent.filter((p) => typeof p === 'string') };
}

function normalizePlant(raw: unknown): ValleyPlant | null {
  if (
    !isObject(raw) ||
    typeof raw.id !== 'string' ||
    !PLANT_KINDS.includes(raw.kind as never) ||
    !PLANT_SIZES.includes(raw.size as never) ||
    !Number.isInteger(raw.slot) ||
    (raw.slot as number) < 0 ||
    (raw.slot as number) >= CAPACITY
  ) {
    return null;
  }
  const p: ValleyPlant = {
    id: raw.id,
    kind: raw.kind as ValleyPlant['kind'],
    size: raw.size as ValleyPlant['size'],
    slot: raw.slot as number,
    seed: typeof raw.seed === 'number' ? raw.seed >>> 0 : 0,
    plantedAt: typeof raw.plantedAt === 'number' ? raw.plantedAt : 0,
  };
  const branch = migrateBranch(raw.branch);
  if (branch) p.branch = branch;
  return p;
}

function normalizeDecor(raw: unknown): ValleyDecor | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !DECOR_KINDS.includes(raw.kind as never)) return null;
  return {
    id: raw.id,
    kind: raw.kind as ValleyDecor['kind'],
    anchor: Number.isInteger(raw.anchor) && (raw.anchor as number) >= 0 ? (raw.anchor as number) : 0,
    seed: typeof raw.seed === 'number' ? raw.seed >>> 0 : 0,
    plantedAt: typeof raw.plantedAt === 'number' ? raw.plantedAt : 0,
  };
}

/** Долина. null — записи нет (база или копия старше шага 6): тогда приложение выращивает её по опыту. */
export function normalizeValley(raw: unknown): ValleyState | null {
  if (!isObject(raw)) return null;
  const taken = new Set<number>();
  const plants: ValleyPlant[] = [];
  for (const item of Array.isArray(raw.plants) ? raw.plants : []) {
    const p = normalizePlant(item);
    // Два растения на одном месте быть не может — второе отбрасываем.
    if (p && !taken.has(p.slot)) {
      taken.add(p.slot);
      plants.push(p);
    }
  }
  const decor = (Array.isArray(raw.decor) ? raw.decor : []).map(normalizeDecor).filter((d) => d !== null);
  // Вещи лагеря появились на шаге 8. Каждая — не больше одной.
  const camp = CAMP_KINDS.filter((k) => Array.isArray(raw.camp) && raw.camp.includes(k));
  // Сооружения боссов появились на шаге 7 фазы 2. На одном месте — одно сооружение, у босса — одно место.
  const sites = new Set<number>();
  const owners = new Set<string>();
  const landmarks: ValleyLandmark[] = [];
  for (const item of Array.isArray(raw.landmarks) ? raw.landmarks : []) {
    if (!isObject(item) || typeof item.bossId !== 'string' || !Number.isInteger(item.site)) continue;
    const site = item.site as number;
    if (site < 0 || site >= LANDMARK_SITES.length || sites.has(site) || owners.has(item.bossId)) continue;
    sites.add(site);
    owners.add(item.bossId);
    landmarks.push({ bossId: item.bossId, site });
  }
  return { plants, decor, camp, landmarks };
}

function optionalText(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined;
}

function normalizeSession(raw: unknown): BossSession | null {
  if (!isObject(raw) || typeof raw.startedAt !== 'number' || !Number.isInteger(raw.minutes) || (raw.minutes as number) < 1) {
    return null;
  }
  const s: BossSession = { startedAt: raw.startedAt, minutes: raw.minutes as number };
  const note = optionalText(raw.note);
  if (note) s.note = note;
  return s;
}

const BOSS_STATUSES: Record<Boss['kind'], readonly Boss['status'][]> = {
  finite: ['active', 'won', 'released'],
  endless: ['active', 'archived'],
};

/**
 * Босс из базы или копии. null — без id, названия, вида или с неизвестной веткой.
 * Сооружение или место не того вида выбирается заново по сиду; непонятный статус — «в работе».
 */
export function normalizeBoss(raw: unknown): Boss | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string' || !raw.title.trim()) return null;
  if (raw.kind !== 'finite' && raw.kind !== 'endless') return null;
  const kind = raw.kind;
  const branch = migrateBranch(raw.branch);
  if (!branch) return null;
  const rawPlace = isObject(raw.place) ? raw.place : {};
  const seed = typeof rawPlace.seed === 'number' ? rawPlace.seed >>> 0 : 0;
  const known = <T extends string>(kinds: readonly T[], x: unknown): T =>
    kinds.includes(x as T) ? (x as T) : kinds[seed % kinds.length]!;
  const place: Boss['place'] =
    kind === 'finite'
      ? { landmark: known<LandmarkKind>(LANDMARK_KINDS, rawPlace.landmark), seed }
      : { garden: known<GardenKind>(GARDEN_KINDS, rawPlace.garden), seed };
  const status = BOSS_STATUSES[kind].includes(raw.status as never) ? (raw.status as Boss['status']) : 'active';
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).map(normalizeSession).filter((s) => s !== null);
  const b: Boss = {
    id: raw.id,
    title: raw.title,
    kind,
    branch,
    status,
    place,
    sessions,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
  };
  const note = optionalText(raw.note);
  if (note) b.note = note;
  if (typeof raw.templateId === 'string') b.templateId = raw.templateId;
  // Секундомер идёт только у босса в работе.
  if (status === 'active' && isObject(raw.stopwatch) && typeof raw.stopwatch.startedAt === 'number') {
    b.stopwatch = { startedAt: raw.stopwatch.startedAt };
  }
  if (status !== 'active') b.endedAt = typeof raw.endedAt === 'number' ? raw.endedAt : b.createdAt;
  const victoryNote = optionalText(raw.victoryNote);
  if (status === 'won' && victoryNote) b.victoryNote = victoryNote;
  return b;
}

/** Боссы; секундомер остаётся только у одного — того, что запущен последним. */
export function normalizeBosses(raw: readonly unknown[]): Boss[] {
  const list = raw.map(normalizeBoss).filter((b) => b !== null);
  const running = list.filter((b) => b.stopwatch).sort((a, b) => b.stopwatch!.startedAt - a.stopwatch!.startedAt);
  for (const b of running.slice(1)) delete b.stopwatch;
  return list;
}

/** Находка из базы или копии. null — без id или с пустым текстом. */
export function normalizeFinding(raw: unknown): Finding | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.text !== 'string') return null;
  const text = cleanFinding(raw.text);
  if (!text) return null;
  return { id: raw.id, createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0, text };
}

export function normalizeFindings(raw: readonly unknown[]): Finding[] {
  return raw.map(normalizeFinding).filter((f) => f !== null);
}

/** Значок приза — короткая строка (эмодзи); остальное отбрасываем. */
function normalizeIcon(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() !== '' && raw.length <= 16 ? raw : undefined;
}

function isPrice(raw: unknown): raw is number {
  return Number.isInteger(raw) && (raw as number) >= 1 && (raw as number) <= BALANCE.shop.maxStars;
}

function normalizePrize(raw: unknown): Prize | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string' || !raw.title.trim() || !isPrice(raw.price)) {
    return null;
  }
  const p: Prize = { id: raw.id, title: raw.title, price: raw.price, createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0 };
  const icon = normalizeIcon(raw.icon);
  if (icon) p.icon = icon;
  return p;
}

function normalizeCoupon(raw: unknown): Coupon | null {
  if (
    !isObject(raw) ||
    typeof raw.id !== 'string' ||
    typeof raw.title !== 'string' ||
    !Number.isInteger(raw.price) ||
    typeof raw.boughtAt !== 'number'
  ) {
    return null;
  }
  const c: Coupon = {
    id: raw.id,
    title: raw.title,
    price: raw.price as number,
    boughtAt: raw.boughtAt,
    status: raw.status === 'given' ? 'given' : 'bought',
  };
  const icon = normalizeIcon(raw.icon);
  if (icon) c.icon = icon;
  if (typeof raw.prizeId === 'string') c.prizeId = raw.prizeId;
  if (c.status === 'given') c.givenAt = typeof raw.givenAt === 'number' ? raw.givenAt : raw.boughtAt;
  return c;
}

/** Призы и купоны. Записи нет (база или копия старше шага 8) — пусто. Купоны — свежие сверху. */
export function normalizeShop(raw: unknown): ShopState {
  if (!isObject(raw)) return { prizes: [], coupons: [] };
  const list = <T>(x: unknown, f: (r: unknown) => T | null): T[] =>
    (Array.isArray(x) ? x : []).map(f).filter((v): v is T => v !== null);
  return {
    prizes: list(raw.prizes, normalizePrize),
    coupons: list(raw.coupons, normalizeCoupon).sort((a, b) => b.boughtAt - a.boughtAt),
  };
}
