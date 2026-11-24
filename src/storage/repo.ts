// Чтение и запись данных приложения.

import type { GameState, RunningTask } from '../logic/game';
import { sortEntries } from '../logic/journal';
import { createLoft } from '../logic/pigeons';
import { valleyFromXp } from '../logic/valley';
import type { Rng } from '../logic/rng';
import type {
  Achievement,
  BoardState,
  LoftState,
  Pigeon,
  PlayerState,
  Settings,
  ShopState,
  TaskTemplate,
  ValleyState,
} from '../model/types';
import type { KvKey, KvMap, PhraseHistory, ProsvetDb } from './db';
import {
  createSettings,
  normalizeAchievements,
  normalizeBoard,
  normalizeLoft,
  normalizePhrases,
  normalizePigeons,
  normalizePlayer,
  normalizeSettings,
  normalizeShop,
  normalizeTasks,
  normalizeTimer,
  normalizeValley,
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
  valley: ValleyState;
  /** Записи Летописи, свежие сверху (по дате создания). */
  achievements: Achievement[];
  shop: ShopState;
}

/**
 * Загружает данные; при первом запуске создаёт игрока, настройки и жёрдочку с голубями.
 * Долины нет (база или копия старше шага 6) — она вырастает по уже накопленному опыту веток.
 */
export async function loadAppData(db: ProsvetDb, now: number, rng: Rng = Math.random): Promise<AppData> {
  const [rawPlayer, rawSettings, rawBoard, rawTimer, rawPhrases, rawLoft, rawPigeons, rawValley, rawAchievements, rawShop] =
    await Promise.all([
      getKv(db, 'player'),
      getKv(db, 'settings'),
      getKv(db, 'board'),
      getKv(db, 'timer'),
      getKv(db, 'phrases'),
      getKv(db, 'loft'),
      db.getAll('pigeons'),
      getKv(db, 'valley'),
      db.getAll('achievements') as Promise<unknown[]>,
      getKv(db, 'shop'),
    ]);
  const player = normalizePlayer(rawPlayer);
  const storedLoft = normalizeLoft(rawLoft);
  const loft = storedLoft ?? createLoft(rng);
  const storedValley = normalizeValley(rawValley);
  const valley = storedValley ?? valleyFromXp(player.xp, rng);
  const data: AppData = {
    player,
    settings: rawSettings === undefined ? createSettings(now) : normalizeSettings(rawSettings, now),
    board: normalizeBoard(rawBoard),
    timer: normalizeTimer(rawTimer),
    phrases: normalizePhrases(rawPhrases),
    loft,
    pigeons: sortPigeons(normalizePigeons(rawPigeons)),
    valley,
    achievements: sortEntries(normalizeAchievements(rawAchievements)),
    shop: normalizeShop(rawShop),
  };
  if (rawPlayer === undefined) await setKv(db, 'player', data.player);
  if (rawSettings === undefined) await setKv(db, 'settings', data.settings);
  if (!storedLoft) await setKv(db, 'loft', data.loft);
  if (!storedValley) await setKv(db, 'valley', data.valley);
  return data;
}

/** Что ещё сохранить вместе с игрой. */
export interface SaveExtras {
  achievement?: Achievement;
  /** Новые и изменённые голуби. */
  pigeons?: readonly Pigeon[];
  loft?: LoftState;
  /** Призы и купоны: покупка купона списывает звёзды той же транзакцией. */
  shop?: ShopState;
}

/**
 * Сохраняет игру одной транзакцией: игрока, доску, таймер и долину, а если переданы — запись журнала, голубей и жёрдочку.
 * Так награда и то, за что она дана, не могут разойтись: либо записалось всё, либо ничего.
 */
export async function saveGame(db: ProsvetDb, game: GameState, extras: SaveExtras = {}): Promise<void> {
  const tx = db.transaction(['kv', 'achievements', 'pigeons'], 'readwrite');
  const kv = tx.objectStore('kv');
  const writes: Promise<unknown>[] = [
    kv.put(game.player, 'player'),
    kv.put(game.board, 'board'),
    kv.put(game.timer, 'timer'),
    kv.put(game.valley, 'valley'),
  ];
  if (extras.achievement) writes.push(tx.objectStore('achievements').put(extras.achievement));
  if (extras.loft) writes.push(kv.put(extras.loft, 'loft'));
  if (extras.shop) writes.push(kv.put(extras.shop, 'shop'));
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

/** Свои задания; ветки фазы 1 переносятся в новые (normalize.ts, migrateBranch). */
export async function listCustomTasks(db: ProsvetDb): Promise<TaskTemplate[]> {
  return normalizeTasks(await db.getAll('tasks'));
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
