// Приводит прочитанные из базы или из резервной копии записи к текущему формату.
// Если в новой версии у записи появилось поле, старые данные получают значение по умолчанию —
// так добавление полей не требует отдельной миграции.

import { BALANCE } from '../config/balance';
import type { RunningTask } from '../logic/game';
import { ENTRY_PARTS, entryStatus, normalizeSkills } from '../logic/journal';
import { lookKey } from '../logic/pigeons';
import { CAPACITY } from '../logic/valley';
import { createPlayer } from '../model/player';
import {
  BRANCHES,
  DECOR_KINDS,
  type Achievement,
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

export function normalizePlayer(raw: unknown): PlayerState {
  const d = createPlayer();
  if (!isObject(raw)) return d;
  // Шрамы убраны на шаге 4 (их заменили голуби и перья) — старые поля отбрасываем.
  const { scars: _scars, scarsTotal: _scarsTotal, ...rest } = raw;
  return {
    ...d,
    ...rest,
    xp: { ...d.xp, ...(isObject(raw.xp) ? raw.xp : {}) },
    streak: { ...d.streak, ...(isObject(raw.streak) ? raw.streak : {}) },
    branchLastTouched: isObject(raw.branchLastTouched) ? raw.branchLastTouched : {},
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
  } as PlayerState;
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
    !BRANCHES.includes(raw.branch as never)
  ) {
    return null;
  }
  return { pausedAt: null, pausedMs: 0, pausesUsed: 0, ...raw } as RunningTask;
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
 * Запись Летописи из базы или копии. null — без id или заголовка.
 * Статус пересчитывается по заполненным частям: он не может разойтись с самой записью.
 */
export function normalizeAchievement(raw: unknown): Achievement | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : 0;
  const a: Achievement = {
    id: raw.id,
    createdAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt,
    title: raw.title,
    status: 'draft',
  };
  for (const p of ENTRY_PARTS) {
    const v = raw[p];
    if (typeof v === 'string' && v.trim() !== '') a[p] = v;
  }
  const skills = Array.isArray(raw.skills) ? normalizeSkills(raw.skills.filter((s) => typeof s === 'string')) : [];
  if (skills.length > 0) a.skills = skills;
  a.status = entryStatus(a);
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
  if (BRANCHES.includes(raw.branch as never)) p.branch = raw.branch as ValleyPlant['branch'];
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
  return { plants, decor };
}
