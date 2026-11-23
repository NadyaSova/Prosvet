// Приводит прочитанные из базы или из резервной копии записи к текущему формату.
// Если в новой версии у записи появилось поле, старые данные получают значение по умолчанию —
// так добавление полей не требует отдельной миграции.

import type { RunningTask } from '../logic/game';
import { createPlayer } from '../model/player';
import { BRANCHES, type BoardState, type PlayerState, type Settings } from '../model/types';
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

export function normalizePhrases(raw: unknown): PhraseHistory {
  if (!isObject(raw) || !Array.isArray(raw.recent)) return { recent: [] };
  return { recent: raw.recent.filter((p) => typeof p === 'string') };
}
