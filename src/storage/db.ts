// База IndexedDB на телефоне. Данные никуда не уходят с устройства.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TimerState } from '../logic/timer';
import type { Achievement, BoardState, PlayerState, Settings, TaskTemplate } from '../model/types';

export const DB_NAME = 'prosvet';

/**
 * Версия схемы. Повышается, когда меняются хранилища или формат записей.
 * Та же версия пишется в резервную копию, чтобы старые копии можно было обновить при загрузке.
 */
export const SCHEMA_VERSION = 1;

/** Одиночные записи в хранилище kv: ключ → тип значения. */
export interface KvMap {
  player: PlayerState;
  settings: Settings;
  board: BoardState;
  /** Идущий таймер; null — таймера нет. */
  timer: TimerState | null;
}
export type KvKey = keyof KvMap;
export const KV_KEYS: readonly KvKey[] = ['player', 'settings', 'board', 'timer'];

export interface ProsvetSchema extends DBSchema {
  kv: { key: string; value: unknown };
  /** Свои задания пользователя. Стартовые задания хранятся в коде (data/default-tasks.ts). */
  tasks: { key: string; value: TaskTemplate };
  achievements: { key: string; value: Achievement; indexes: { byUpdatedAt: number } };
}

export const STORE_NAMES = ['kv', 'tasks', 'achievements'] as const;
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
    },
    // Открылась новая версия приложения в другой вкладке — закрываем старое соединение, чтобы не мешать обновлению.
    blocking(_current, _blocked, event) {
      (event.target as IDBDatabase).close();
    },
  });
}
