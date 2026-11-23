// Чтение и запись данных приложения.

import type { GameState, RunningTask } from '../logic/game';
import type { Achievement, BoardState, PlayerState, Settings, TaskTemplate } from '../model/types';
import type { KvKey, KvMap, PhraseHistory, ProsvetDb } from './db';
import {
  createSettings,
  normalizeBoard,
  normalizePhrases,
  normalizePlayer,
  normalizeSettings,
  normalizeTimer,
} from './normalize';

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
  timer: RunningTask | null;
  phrases: PhraseHistory;
}

/** Загружает данные; при первом запуске создаёт игрока и настройки. */
export async function loadAppData(db: ProsvetDb, now: number): Promise<AppData> {
  const [rawPlayer, rawSettings, rawBoard, rawTimer, rawPhrases] = await Promise.all([
    getKv(db, 'player'),
    getKv(db, 'settings'),
    getKv(db, 'board'),
    getKv(db, 'timer'),
    getKv(db, 'phrases'),
  ]);
  const data: AppData = {
    player: normalizePlayer(rawPlayer),
    settings: rawSettings === undefined ? createSettings(now) : normalizeSettings(rawSettings, now),
    board: normalizeBoard(rawBoard),
    timer: normalizeTimer(rawTimer),
    phrases: normalizePhrases(rawPhrases),
  };
  if (rawPlayer === undefined) await setKv(db, 'player', data.player);
  if (rawSettings === undefined) await setKv(db, 'settings', data.settings);
  return data;
}

/**
 * Сохраняет игру одной транзакцией: игрока, доску и таймер, а если передана — и запись журнала.
 * Так награда и снятие таймера не могут разойтись: либо записалось всё, либо ничего.
 */
export async function saveGame(db: ProsvetDb, game: GameState, achievement?: Achievement): Promise<void> {
  const tx = db.transaction(['kv', 'achievements'], 'readwrite');
  const kv = tx.objectStore('kv');
  const writes: Promise<unknown>[] = [
    kv.put(game.player, 'player'),
    kv.put(game.board, 'board'),
    kv.put(game.timer, 'timer'),
  ];
  if (achievement) writes.push(tx.objectStore('achievements').put(achievement));
  await Promise.all([...writes, tx.done]);
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
