// Резервная копия: все данные в один JSON-файл и обратно. SPEC.md §14.3.

import { BALANCE } from '../config/balance';
import type { Achievement, Boss, Finding, Pigeon, Settings, TaskTemplate } from '../model/types';
import { KV_KEYS, SCHEMA_VERSION, STORE_NAMES, type KvKey, type ProsvetDb } from './db';
import { normalizeBosses, normalizeFindings, normalizePigeons, normalizeSettings } from './normalize';

export interface Snapshot {
  app: 'prosvet';
  schemaVersion: number;
  /** Когда сделана копия (ISO). */
  exportedAt: string;
  data: {
    kv: Partial<Record<KvKey, unknown>>;
    tasks: TaskTemplate[];
    achievements: Achievement[];
    pigeons: Pigeon[];
    /** Появились в версии 3. */
    bosses: Boss[];
    /** Появились в версии 4. */
    findings: Finding[];
  };
}

/** Ошибка загрузки копии; message можно показывать пользователю. */
export class BackupError extends Error {}

/**
 * Обновление копий, сделанных старыми версиями: ключ — версия копии, функция переводит её в следующую.
 */
const SNAPSHOT_MIGRATIONS: Record<number, (s: Snapshot) => Snapshot> = {
  // Версия 2: голубятня. В старых копиях голубей нет.
  1: (s) => ({ ...s, schemaVersion: 2, data: { ...s.data, pigeons: [] } }),
  // Версия 3: боссы. В старых копиях боссов нет.
  2: (s) => ({ ...s, schemaVersion: 3, data: { ...s.data, bosses: [] } }),
  // Версия 4: находки. В старых копиях находок нет.
  3: (s) => ({ ...s, schemaVersion: 4, data: { ...s.data, findings: [] } }),
};

/**
 * Собирает копию всех данных. Заодно (mark) отмечает в настройках, что копия сделана,
 * и эта отметка попадает в саму копию. Без mark данные не меняются: так Drive сначала смотрит,
 * изменилось ли что-нибудь, а отметку ставит после того, как копия записана (markBackup).
 */
export async function exportSnapshot(db: ProsvetDb, now: number, mark = true): Promise<Snapshot> {
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  const kvStore = tx.objectStore('kv');
  if (mark) {
    const settings: Settings = { ...normalizeSettings(await kvStore.get('settings'), now), lastBackupAt: now };
    await kvStore.put(settings, 'settings');
  }

  const kv: Snapshot['data']['kv'] = {};
  for (const key of KV_KEYS) {
    const value = await kvStore.get(key);
    if (value !== undefined) kv[key] = value;
  }
  const tasks = await tx.objectStore('tasks').getAll();
  const achievements = await tx.objectStore('achievements').getAll();
  const pigeons = await tx.objectStore('pigeons').getAll();
  const bosses = await tx.objectStore('bosses').getAll();
  const findings = await tx.objectStore('findings').getAll();
  await tx.done;

  return {
    app: 'prosvet',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    data: { kv, tasks, achievements, pigeons, bosses, findings },
  };
}

/** Копия с отметкой о себе: settings.lastBackupAt = now — как у копии, сделанной с mark. */
export function withBackupMark(s: Snapshot, now: number): Snapshot {
  const settings = { ...normalizeSettings(s.data.kv.settings, now), lastBackupAt: now };
  return { ...s, exportedAt: new Date(now).toISOString(), data: { ...s.data, kv: { ...s.data.kv, settings } } };
}

/** Отмечает в настройках, что копия сделана; возвращает новые настройки. */
export async function markBackup(db: ProsvetDb, now: number): Promise<Settings> {
  const tx = db.transaction('kv', 'readwrite');
  const kv = tx.objectStore('kv');
  const settings: Settings = { ...normalizeSettings(await kv.get('settings'), now), lastBackupAt: now };
  await kv.put(settings, 'settings');
  await tx.done;
  return settings;
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

  const { kv, tasks, achievements, pigeons, bosses, findings } = raw.data;
  if (!isObject(kv) || !hasIds(tasks) || !hasIds(achievements)) throw new BackupError(NOT_A_BACKUP);
  // Голуби появились в версии 2.
  if (version >= 2 && !hasIds(pigeons)) throw new BackupError(NOT_A_BACKUP);
  // Боссы — в версии 3.
  if (version >= 3 && !hasIds(bosses)) throw new BackupError(NOT_A_BACKUP);
  // Находки — в версии 4.
  if (version >= 4 && !hasIds(findings)) throw new BackupError(NOT_A_BACKUP);

  const knownKv: Snapshot['data']['kv'] = {};
  for (const key of KV_KEYS) if (kv[key] !== undefined) knownKv[key] = kv[key];

  let snapshot: Snapshot = {
    app: 'prosvet',
    schemaVersion: version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    data: {
      kv: knownKv,
      tasks: tasks as TaskTemplate[],
      achievements: achievements as Achievement[],
      pigeons: version >= 2 ? normalizePigeons(pigeons as unknown[]) : [],
      bosses: version >= 3 ? normalizeBosses(bosses as unknown[]) : [],
      findings: version >= 4 ? normalizeFindings(findings as unknown[]) : [],
    },
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
  const pigeons = tx.objectStore('pigeons');
  const bosses = tx.objectStore('bosses');
  const findings = tx.objectStore('findings');
  await Promise.all([kv.clear(), tasks.clear(), achievements.clear(), pigeons.clear(), bosses.clear(), findings.clear()]);
  for (const key of KV_KEYS) {
    const value = s.data.kv[key];
    if (value !== undefined) await kv.put(value, key);
  }
  for (const t of s.data.tasks) await tasks.put(t);
  for (const a of s.data.achievements) await achievements.put(a);
  for (const p of s.data.pigeons) await pigeons.put(p);
  for (const b of s.data.bosses) await bosses.put(b);
  for (const f of s.data.findings) await findings.put(f);
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
