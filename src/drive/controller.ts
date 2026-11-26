// Сохранение в Google Drive во время работы приложения (docs/phase2-plan.md §7.1).
// Нажатие «Сохранить в Drive» берёт ключ Google (если старый истёк) и сохраняет. Пока ключ действует
// (около часа), приложение раз в BALANCE.backup.driveCheckSeconds и при сворачивании смотрит, изменились ли
// данные, и тогда сохраняет само. Ключ истёк — ждёт следующего нажатия.

import { BALANCE } from '../config/balance';
import type { Settings } from '../model/types';
import { exportSnapshot, markBackup, parseSnapshot, serializeSnapshot, withBackupMark, type Snapshot } from '../storage/backup';
import type { ProsvetDb } from '../storage/db';
import { DriveError, createDriveApi } from './api';
import { AuthError, authReady, driveConfigured, loadAuth, prepareAuth, requestToken, storeAuth, tokenValid, type StoredAuth } from './auth';
import { backupsOf, snapshotFingerprint, syncAll, type BackupFile, type DocCache } from './sync';

export interface DriveState {
  /** Client ID задан — Drive можно включить. */
  configured: boolean;
  /** Вход Google загружен: можно нажимать. */
  ready: boolean;
  busy: boolean;
  /** До какого времени действует ключ; null — нужно нажатие. */
  until: number | null;
  /** Сохраняет само, пока ключ действует. */
  auto: boolean;
  /** Последнее сохранение в Drive за этот запуск приложения. */
  savedAt: number | null;
  error: string | null;
}

let db: ProsvetDb | null = null;
let onSaved: (s: Settings) => void = () => {};
let auth: StoredAuth | null = null;
let ready = false;
let busy = false;
let savedAt: number | null = null;
let error: string | null = null;
/** Отпечаток данных, сохранённых последними: не изменились — не сохраняем. */
let lastFingerprint: string | null = null;
const cache: DocCache = new Map();
let queue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

export function driveState(now = Date.now()): DriveState {
  return {
    configured: driveConfigured(),
    ready,
    busy,
    until: tokenValid(auth, now) ? auth.expiresAt : null,
    auto: !!auth?.auto && tokenValid(auth, now),
    savedAt,
    error,
  };
}

export function subscribeDrive(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const emit = () => listeners.forEach((fn) => fn());

function message(e: unknown): string {
  if (e instanceof DriveError || e instanceof AuthError) return e.message;
  return `Не получилось: ${String(e)}`;
}

function fail(e: unknown) {
  if (e instanceof DriveError && e.unauthorized) {
    auth = null;
    storeAuth(null);
    error = 'Вход Google истёк. Нажми «Сохранить в Drive».';
  } else {
    error = message(e);
  }
}

/** Загружает вход Google заранее — чтобы окно Google открылось прямо по нажатию. */
export function prepareDrive(): void {
  if (!driveConfigured() || ready) return;
  prepareAuth().then(
    () => {
      ready = authReady();
      emit();
    },
    (e: unknown) => {
      error = message(e);
      emit();
    },
  );
}

/** Ключ Google: действующий — сразу, иначе окно Google. Вызывать прямо из нажатия, без await перед этим. */
function token(): Promise<string> {
  if (tokenValid(auth, Date.now())) return Promise.resolve(auth.token);
  return requestToken().then((t) => {
    auth = { ...t, auto: auth?.auto ?? false };
    storeAuth(auth);
    emit();
    return t.token;
  });
}

function enableAuto() {
  if (!auth || auth.auto) return;
  auth = { ...auth, auto: true };
  storeAuth(auth);
}

/** Сохраняет копию и документы. Без force — только если данные изменились с прошлого сохранения. */
function sync(force: boolean): Promise<void> {
  const run = async () => {
    const now = Date.now();
    if (!db || !tokenValid(auth, now)) return;
    const snapshot = await exportSnapshot(db, now, false);
    const fp = snapshotFingerprint(snapshot);
    if (!force && fp === lastFingerprint) return;
    busy = true;
    emit();
    try {
      const marked = withBackupMark(snapshot, now);
      await syncAll(createDriveApi(auth.token), marked, serializeSnapshot(marked), now, cache);
      lastFingerprint = fp;
      savedAt = now;
      error = null;
      onSaved(await markBackup(db, now));
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
      emit();
    }
  };
  queue = queue.then(run, run);
  return queue;
}

/** Само, пока ключ действует и сохранение включено нажатием. */
function autoSync() {
  if (auth?.auto && tokenValid(auth, Date.now())) void sync(false);
  else emit();
}

/**
 * Подключает Drive к запущенному приложению. onSettings — новые настройки после сохранения
 * (в них отметка «последняя копия»).
 */
export function startDrive(database: ProsvetDb, onSettings: (s: Settings) => void): () => void {
  db = database;
  onSaved = onSettings;
  if (!driveConfigured()) return () => {};
  auth = loadAuth();
  if (auth?.auto && tokenValid(auth, Date.now())) prepareDrive();
  autoSync();
  const id = setInterval(autoSync, BALANCE.backup.driveCheckSeconds * 1000);
  const onHide = () => {
    if (document.visibilityState === 'hidden') autoSync();
  };
  document.addEventListener('visibilitychange', onHide);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onHide);
  };
}

/** Нажатие «Сохранить в Drive»: ключ (если нужно — окно Google), сохранение, дальше — само. */
export function saveToDrive(): Promise<void> {
  error = null;
  return token().then(
    () => {
      enableAuto();
      return sync(true);
    },
    (e: unknown) => {
      fail(e);
      emit();
    },
  );
}

/** Нажатие «Восстановить из Drive»: список копий, свежие сверху. */
export function listDriveBackups(): Promise<BackupFile[]> {
  error = null;
  return token().then(
    async (t) => {
      busy = true;
      emit();
      try {
        return backupsOf(await createDriveApi(t).listAll());
      } finally {
        busy = false;
        emit();
      }
    },
  ).catch((e: unknown) => {
    fail(e);
    emit();
    throw e;
  });
}

/** Скачивает и проверяет копию (ошибка формата — BackupError). */
export async function downloadDriveBackup(id: string): Promise<Snapshot> {
  if (!tokenValid(auth, Date.now())) throw new DriveError('Вход Google истёк. Нажми «Восстановить из Drive» ещё раз.');
  busy = true;
  emit();
  try {
    return parseSnapshot(await createDriveApi(auth.token).download(id));
  } catch (e) {
    if (e instanceof DriveError) fail(e);
    throw e;
  } finally {
    busy = false;
    emit();
  }
}

/** Данные восстановлены из копии: дальше сохранять само, как после «Сохранить в Drive». */
export function afterRestore(): void {
  enableAuto();
  lastFingerprint = null;
  autoSync();
}

export { message as driveErrorText };
