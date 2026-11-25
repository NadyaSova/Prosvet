// База IndexedDB на телефоне. Данные никуда не уходят с устройства.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RunningTask } from '../logic/game';
import type {
  Achievement,
  BoardState,
  Boss,
  Finding,
  LoftState,
  Pigeon,
  PlayerState,
  Settings,
  ShopState,
  TaskTemplate,
  ValleyState,
  WeekState,
} from '../model/types';

export const DB_NAME = 'prosvet';

/**
 * Версия схемы. Повышается, когда меняются хранилища или формат записей.
 * Та же версия пишется в резервную копию, чтобы старые копии можно было обновить при загрузке.
 */
export const SCHEMA_VERSION = 4;

/** Одиночные записи в хранилище kv: ключ → тип значения. */
export interface KvMap {
  player: PlayerState;
  settings: Settings;
  board: BoardState;
  /** Идущий таймер; null — таймера нет. */
  timer: RunningTask | null;
  /** Недавно показанные фразы — чтобы не повторяться. */
  phrases: PhraseHistory;
  /** Голуби на жёрдочке в голубятне. */
  loft: LoftState;
  /** Что растёт в долине. Появилось на шаге 6; в старых базах и копиях записи нет. */
  valley: ValleyState;
  /** Внешние призы и купоны. Появилось на шаге 8; в старых базах и копиях записи нет. */
  shop: ShopState;
  /** Итоги недели: когда показаны и «что хочется». Появилось на шаге 10 фазы 2; в старых базах и копиях записи нет. */
  week: WeekState;
}

export interface PhraseHistory {
  recent: string[];
}
export type KvKey = keyof KvMap;
export const KV_KEYS: readonly KvKey[] = ['player', 'settings', 'board', 'timer', 'phrases', 'loft', 'valley', 'shop', 'week'];

export interface ProsvetSchema extends DBSchema {
  kv: { key: string; value: unknown };
  /** Свои задания пользователя. Стартовые задания хранятся в коде (data/default-tasks.ts). */
  tasks: { key: string; value: TaskTemplate };
  achievements: { key: string; value: Achievement; indexes: { byUpdatedAt: number } };
  /** Голуби с откликами — и в пути, и вернувшиеся. Перья выводятся из них. */
  pigeons: { key: string; value: Pigeon };
  /** Боссы — во всех состояниях: в работе, побеждённые, отпущенные, в архиве. Появились в версии 3. */
  bosses: { key: string; value: Boss };
  /** Находки после чтения сообществ. Появились в версии 4. */
  findings: { key: string; value: Finding };
}

export const STORE_NAMES = ['kv', 'tasks', 'achievements', 'pigeons', 'bosses', 'findings'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export type ProsvetDb = IDBPDatabase<ProsvetSchema>;

export function openProsvetDb(name = DB_NAME): Promise<ProsvetDb> {
  return openDB<ProsvetSchema>(name, SCHEMA_VERSION, {
    upgrade(db, oldVersion) {
      // Каждая версия — отдельный блок. Старые блоки не менять: по ним обновляются базы,
      // созданные прежними версиями приложения.
      if (oldVersion < 1) {
        db.createObjectStore('kv');
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('achievements', { keyPath: 'id' }).createIndex('byUpdatedAt', 'updatedAt');
      }
      if (oldVersion < 2) {
        db.createObjectStore('pigeons', { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        db.createObjectStore('bosses', { keyPath: 'id' });
      }
      if (oldVersion < 4) {
        db.createObjectStore('findings', { keyPath: 'id' });
      }
    },
    // Открылась новая версия приложения в другой вкладке — закрываем старое соединение, чтобы не мешать обновлению.
    blocking(_current, _blocked, event) {
      (event.target as IDBDatabase).close();
    },
  });
}
