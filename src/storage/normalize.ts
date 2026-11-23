// Приводит прочитанные из базы или из резервной копии записи к текущему формату.
// Если в новой версии у записи появилось поле, старые данные получают значение по умолчанию —
// так добавление полей не требует отдельной миграции.

import type { TimerState } from '../logic/timer';
import { createPlayer } from '../model/player';
import type { BoardState, PlayerState, Settings } from '../model/types';

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function createSettings(now: number): Settings {
  return { createdAt: now, lastBackupAt: null, hiddenTaskIds: [] };
}

export function normalizePlayer(raw: unknown): PlayerState {
  const d = createPlayer();
  if (!isObject(raw)) return d;
  return {
    ...d,
    ...raw,
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

export function normalizeTimer(raw: unknown): TimerState | null {
  if (!isObject(raw) || typeof raw.startedAt !== 'number' || typeof raw.durationMs !== 'number') return null;
  return { pausedAt: null, pausedMs: 0, pausesUsed: 0, ...raw } as TimerState;
}
