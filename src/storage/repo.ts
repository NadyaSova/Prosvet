// Чтение и запись данных приложения.

import type { GameState, RunningTask } from '../logic/game';
import { createLoft } from '../logic/pigeons';
import type { Rng } from '../logic/rng';
import type { Achievement, BoardState, LoftState, Pigeon, PlayerState, Settings, TaskTemplate } from '../model/types';
import type { KvKey, KvMap, PhraseHistory, ProsvetDb } from './db';
import {
  createSettings,
  normalizeBoard,
  normalizeLoft,
  normalizePhrases,
  normalizePigeons,
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
  loft: LoftState;
  pigeons: Pigeon[];
}

/** Загружает данные; при первом запуске создаёт игрока, настройки и жёрдочку с голубями. */
export async function loadAppData(db: ProsvetDb, now: number, rng: Rng = Math.random): Promise<AppData> {
  const [rawPlayer, rawSettings, rawBoard, rawTimer, rawPhrases, rawLoft, rawPigeons] = await Promise.all([
    getKv(db, 'player'),
    getKv(db, 'settings'),
    getKv(db, 'board'),
    getKv(db, 'timer'),
    getKv(db, 'phrases'),
    getKv(db, 'loft'),
    db.getAll('pigeons'),
  ]);
  const loft = normalizeLoft(rawLoft);
  const data: AppData = {
    player: normalizePlayer(rawPlayer),
    settings: rawSettings === undefined ? createSettings(now) : normalizeSettings(rawSettings, now),
    board: normalizeBoard(rawBoard),
    timer: normalizeTimer(rawTimer),
    phrases: normalizePhrases(rawPhrases),
    loft: loft ?? createLoft(rng),
    pigeons: sortPigeons(normalizePigeons(rawPigeons)),
  };
  if (rawPlayer === undefined) await setKv(db, 'player', data.player);
  if (rawSettings === undefined) await setKv(db, 'settings', data.settings);
  if (!loft) await setKv(db, 'loft', data.loft);
  return data;
}

/** Что ещё сохранить вместе с игрой. */
export interface SaveExtras {
  achievement?: Achievement;
  /** Новые и изменённые голуби. */
  pigeons?: readonly Pigeon[];
  loft?: LoftState;
}

/**
 * Сохраняет игру одной транзакцией: игрока, доску и таймер, а если переданы — запись журнала, голубей и жёрдочку.
 * Так награда и то, за что она дана, не могут разойтись: либо записалось всё, либо ничего.
 */
export async function saveGame(db: ProsvetDb, game: GameState, extras: SaveExtras = {}): Promise<void> {
  const tx = db.transaction(['kv', 'achievements', 'pigeons'], 'readwrite');
  const kv = tx.objectStore('kv');
  const writes: Promise<unknown>[] = [
    kv.put(game.player, 'player'),
    kv.put(game.board, 'board'),
    kv.put(game.timer, 'timer'),
  ];
  if (extras.achievement) writes.push(tx.objectStore('achievements').put(extras.achievement));
  if (extras.loft) writes.push(kv.put(extras.loft, 'loft'));
  for (const p of extras.pigeons ?? []) writes.push(tx.objectStore('pigeons').put(p));
  await Promise.all([...writes, tx.done]);
}

/** Голуби, свежие сверху. */
function sortPigeons(list: Pigeon[]): Pigeon[] {
  return list.sort((a, b) => b.sentAt - a.sentAt);
}

export async function listPigeons(db: ProsvetDb): Promise<Pigeon[]> {
  return sortPigeons(normalizePigeons(await db.getAll('pigeons')));
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
