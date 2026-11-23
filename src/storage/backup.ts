// Резервная копия: все данные в один JSON-файл и обратно. SPEC.md §14.3.

import { BALANCE } from '../config/balance';
import type { Achievement, Settings, TaskTemplate } from '../model/types';
import { KV_KEYS, SCHEMA_VERSION, STORE_NAMES, type KvKey, type ProsvetDb } from './db';
import { normalizeSettings } from './normalize';

export interface Snapshot {
  app: 'prosvet';
  schemaVersion: number;
  /** Когда сделана копия (ISO). */
  exportedAt: string;
  data: {
    kv: Partial<Record<KvKey, unknown>>;
    tasks: TaskTemplate[];
    achievements: Achievement[];
  };
}

/** Ошибка загрузки копии; message можно показывать пользователю. */
export class BackupError extends Error {}

/**
 * Обновление копий, сделанных старыми версиями: ключ — версия копии, функция переводит её в следующую.
 * Пока версия одна, список пуст.
 */
const SNAPSHOT_MIGRATIONS: Record<number, (s: Snapshot) => Snapshot> = {};

/**
 * Собирает копию всех данных. Заодно отмечает в настройках, что копия сделана,
 * и эта отметка попадает в саму копию.
 */
export async function exportSnapshot(db: ProsvetDb, now: number): Promise<Snapshot> {
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  const kvStore = tx.objectStore('kv');
  const settings: Settings = { ...normalizeSettings(await kvStore.get('settings'), now), lastBackupAt: now };
  await kvStore.put(settings, 'settings');

  const kv: Snapshot['data']['kv'] = {};
  for (const key of KV_KEYS) {
    const value = await kvStore.get(key);
    if (value !== undefined) kv[key] = value;
  }
  const tasks = await tx.objectStore('tasks').getAll();
  const achievements = await tx.objectStore('achievements').getAll();
  await tx.done;

  return {
    app: 'prosvet',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    data: { kv, tasks, achievements },
  };
}

export function serializeSnapshot(s: Snapshot): string {
  return JSON.stringify(s, null, 2);
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function hasIds(list: unknown): list is { id: string }[] {
  return Array.isArray(list) && list.every((item) => isObject(item) && typeof item.id === 'string');
}

const NOT_A_BACKUP = 'Этот файл не похож на резервную копию Просвета.';

/** Читает и проверяет файл копии, обновляет его до текущей версии. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError(NOT_A_BACKUP);
  }
  if (!isObject(raw) || raw.app !== 'prosvet' || !isObject(raw.data)) throw new BackupError(NOT_A_BACKUP);

  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new BackupError(NOT_A_BACKUP);
  if (version > SCHEMA_VERSION) {
    throw new BackupError('Копия сделана в более новой версии приложения. Обнови приложение и попробуй снова.');
  }

  const { kv, tasks, achievements } = raw.data;
  if (!isObject(kv) || !hasIds(tasks) || !hasIds(achievements)) throw new BackupError(NOT_A_BACKUP);

  const knownKv: Snapshot['data']['kv'] = {};
  for (const key of KV_KEYS) if (kv[key] !== undefined) knownKv[key] = kv[key];

  let snapshot: Snapshot = {
    app: 'prosvet',
    schemaVersion: version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    data: { kv: knownKv, tasks: tasks as TaskTemplate[], achievements: achievements as Achievement[] },
  };
  while (snapshot.schemaVersion < SCHEMA_VERSION) {
    const migrate = SNAPSHOT_MIGRATIONS[snapshot.schemaVersion];
    if (!migrate) throw new BackupError(`Не умею обновлять копии версии ${snapshot.schemaVersion}.`);
    snapshot = migrate(snapshot);
  }
  return snapshot;
}

/** Заменяет все данные данными из копии. Всё в одной транзакции: либо заменится всё, либо ничего. */
export async function importSnapshot(db: ProsvetDb, s: Snapshot): Promise<void> {
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  const kv = tx.objectStore('kv');
  const tasks = tx.objectStore('tasks');
  const achievements = tx.objectStore('achievements');
  await Promise.all([kv.clear(), tasks.clear(), achievements.clear()]);
  for (const key of KV_KEYS) {
    const value = s.data.kv[key];
    if (value !== undefined) await kv.put(value, key);
  }
  for (const t of s.data.tasks) await tasks.put(t);
  for (const a of s.data.achievements) await achievements.put(a);
  await tx.done;
}

/** Имя файла копии по местной дате: prosvet-2026-11-23.json. */
export function backupFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `prosvet-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** Пора ли напомнить о копии: прошло reminderDays с последней копии (или с первого запуска). */
export function needsBackupReminder(settings: Settings, now: number): boolean {
  const since = settings.lastBackupAt ?? settings.createdAt;
  return now - since >= BALANCE.backup.reminderDays * 86_400_000;
}
