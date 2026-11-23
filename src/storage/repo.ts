// Чтение и запись данных приложения.

import type { TimerState } from '../logic/timer';
import type { Achievement, BoardState, PlayerState, Settings, TaskTemplate } from '../model/types';
import type { KvKey, KvMap, ProsvetDb } from './db';
import { createSettings, normalizeBoard, normalizePlayer, normalizeSettings, normalizeTimer } from './normalize';

export async function getKv<K extends KvKey>(db: ProsvetDb, key: K): Promise<unknown> {
  return db.get('kv', key);
}

export async function setKv<K extends KvKey>(db: ProsvetDb, key: K, value: KvMap[K]): Promise<void> {
  await db.put('kv', value, key);
}

/** Всё, что нужно приложению при запуске. */
export interface AppData {
  player: PlayerState;
  settings: Settings;
  board: BoardState;
  timer: TimerState | null;
}

/** Загружает данные; при первом запуске создаёт игрока и настройки. */
export async function loadAppData(db: ProsvetDb, now: number): Promise<AppData> {
  const [rawPlayer, rawSettings, rawBoard, rawTimer] = await Promise.all([
    getKv(db, 'player'),
    getKv(db, 'settings'),
    getKv(db, 'board'),
    getKv(db, 'timer'),
  ]);
  const data: AppData = {
    player: normalizePlayer(rawPlayer),
    settings: rawSettings === undefined ? createSettings(now) : normalizeSettings(rawSettings, now),
    board: normalizeBoard(rawBoard),
    timer: normalizeTimer(rawTimer),
  };
  if (rawPlayer === undefined) await setKv(db, 'player', data.player);
  if (rawSettings === undefined) await setKv(db, 'settings', data.settings);
  return data;
}

// Свои задания

export async function listCustomTasks(db: ProsvetDb): Promise<TaskTemplate[]> {
  return db.getAll('tasks');
}

export async function putCustomTask(db: ProsvetDb, task: TaskTemplate): Promise<void> {
  await db.put('tasks', task);
}

export async function deleteCustomTask(db: ProsvetDb, id: string): Promise<void> {
  await db.delete('tasks', id);
}

// Летопись

/** Записи журнала, свежие сверху. */
export async function listAchievements(db: ProsvetDb): Promise<Achievement[]> {
  return (await db.getAllFromIndex('achievements', 'byUpdatedAt')).reverse();
}

export async function putAchievement(db: ProsvetDb, a: Achievement): Promise<void> {
  await db.put('achievements', a);
}

export async function deleteAchievement(db: ProsvetDb, id: string): Promise<void> {
  await db.delete('achievements', id);
}
