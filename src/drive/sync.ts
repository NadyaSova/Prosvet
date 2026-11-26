// Синхронизация с Google Drive (docs/phase2-plan.md §7): резервная копия и документы для чтения.
// Источник истины — приложение: копия и документы каждый раз пишутся целиком из его данных.
//
// В Drive:
//   Просвет/            — папка приложения
//     Копии/            — prosvet-ГГГГ-ММ-ДД.json, по одной на день, хранятся последние BALANCE.backup.driveVersions
//     Боссы/            — по документу на каждого босса с заметками
//     Летопись, Находки, Недели — Google Docs

import { BALANCE } from '../config/balance';
import { dayOf } from '../logic/time';
import type { Snapshot } from '../storage/backup';
import { normalizeAchievements, normalizeBosses, normalizeFindings, normalizeWeek } from '../storage/normalize';
import { DOC_MIME, FOLDER_MIME, type DriveApi, type DriveFile } from './api';
import { docFingerprint, driveDocs, type DocsInput } from './docs';

/** Метка в appProperties, по которой приложение находит свои файлы. */
const TAG = 'prosvet';

const tagOf = (f: DriveFile) => f.appProperties?.[TAG];
const inFolder = (f: DriveFile, folder: DriveFile) => !!f.parents?.includes(folder.id);

export interface Folders {
  root: DriveFile;
  backups: DriveFile;
  bosses: DriveFile;
}

/** Папки приложения: находит по меткам, недостающие создаёт. */
export async function ensureFolders(api: DriveApi, files: DriveFile[]): Promise<Folders> {
  const folder = async (tag: string, name: string, parent?: DriveFile) => {
    const found = files.find((f) => f.mimeType === FOLDER_MIME && tagOf(f) === tag && (!parent || inFolder(f, parent)));
    if (found) return found;
    const made = await api.create({ name, mimeType: FOLDER_MIME, parents: parent ? [parent.id] : undefined, appProperties: { [TAG]: tag } });
    files.push(made);
    return made;
  };
  const root = await folder('root', 'Просвет');
  return { root, backups: await folder('backups', 'Копии', root), bosses: await folder('bosses', 'Боссы', root) };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** «2026-11-26» по местной дате. */
export function isoDay(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Копия в Drive. */
export interface BackupFile {
  id: string;
  name: string;
  /** День копии, «2026-11-26». */
  day: string;
  /** Когда копия последний раз записана. */
  at: number;
}

const modified = (f: DriveFile) => (f.modifiedTime ? Date.parse(f.modifiedTime) : 0);

/** Копии в Drive, свежие сверху. */
export function backupsOf(files: readonly DriveFile[]): BackupFile[] {
  return files
    .filter((f) => tagOf(f) === 'backup')
    .map((f) => ({ id: f.id, name: f.name, day: f.appProperties?.day ?? '', at: modified(f) }))
    .sort((a, b) => b.at - a.at);
}

/**
 * Записывает копию дня. Копия того же дня от этих же данных перезаписывается.
 * origin — когда эти данные впервые появились (settings.createdAt): копию от других данных того же дня
 * (например, приложение поставили заново и ещё не восстановили) не затираем, а пишем рядом.
 * Потом удаляет самые старые копии сверх keep.
 */
export async function saveBackup(
  api: DriveApi,
  files: DriveFile[],
  folders: Folders,
  json: string,
  now: number,
  origin: string,
  keep: number = BALANCE.backup.driveVersions,
): Promise<void> {
  const day = isoDay(now);
  const existing = files.filter((f) => tagOf(f) === 'backup');
  const target = existing.find((f) => f.appProperties?.day === day && f.appProperties?.origin === origin);
  const content = { type: 'application/json', body: json };
  let written: DriveFile;
  if (target) {
    written = await api.update(target.id, {}, content);
  } else {
    const d = new Date(now);
    const taken = existing.some((f) => f.appProperties?.day === day);
    const name = taken ? `prosvet-${day}-${pad(d.getHours())}${pad(d.getMinutes())}.json` : `prosvet-${day}.json`;
    written = await api.create(
      { name, mimeType: 'application/json', parents: [folders.backups.id], appProperties: { [TAG]: 'backup', day, origin } },
      content,
    );
    files.push(written);
  }
  const all = [...existing.filter((f) => f.id !== written.id), { ...written, modifiedTime: written.modifiedTime ?? new Date(now).toISOString() }];
  all.sort((a, b) => modified(b) - modified(a));
  for (const old of all.slice(keep)) {
    await api.remove(old.id);
    files.splice(files.findIndex((f) => f.id === old.id), 1);
  }
}

/**
 * Что уже загружено в этом сеансе: id документа → его содержимое без строки «Обновлено».
 * Документ, который не поменялся, второй раз не загружается.
 */
export type DocCache = Map<string, string>;

/** Пересобирает документы: недостающие создаёт, изменившиеся перезаписывает целиком. */
export async function syncDocs(api: DriveApi, files: DriveFile[], folders: Folders, input: DocsInput, now: number, cache: DocCache): Promise<void> {
  for (const doc of driveDocs(input, now)) {
    const fp = docFingerprint(doc.html);
    const existing = files.find((f) => tagOf(f) === 'doc' && f.appProperties?.doc === doc.key);
    const content = { type: 'text/html', body: doc.html };
    if (existing) {
      if (cache.get(existing.id) === fp && existing.name === doc.title) continue;
      const updated = await api.update(existing.id, existing.name === doc.title ? {} : { name: doc.title }, content);
      existing.name = updated.name ?? doc.title;
      cache.set(existing.id, fp);
    } else {
      const parent = doc.folder === 'bosses' ? folders.bosses : folders.root;
      const made = await api.create(
        { name: doc.title, mimeType: DOC_MIME, parents: [parent.id], appProperties: { [TAG]: 'doc', doc: doc.key } },
        content,
      );
      files.push(made);
      cache.set(made.id, fp);
    }
  }
}

/** Данные для документов — из копии: так копия и документы собраны из одного и того же состояния. */
export function docsInputOf(s: Snapshot, now: number): DocsInput {
  return {
    achievements: normalizeAchievements(s.data.achievements),
    findings: normalizeFindings(s.data.findings),
    bosses: normalizeBosses(s.data.bosses),
    week: normalizeWeek(s.data.kv.week, dayOf(now)),
  };
}

/**
 * Отпечаток данных: изменились ли они с прошлого сохранения. Отметка «последняя копия» не считается —
 * иначе каждое сохранение меняло бы данные и вызывало следующее.
 */
export function snapshotFingerprint(s: Snapshot): string {
  const settings = s.data.kv.settings;
  const kv = typeof settings === 'object' && settings !== null ? { ...s.data.kv, settings: { ...settings, lastBackupAt: null } } : s.data.kv;
  return JSON.stringify({ ...s.data, kv });
}

/** Сохраняет в Drive копию и документы. Копия уже с отметкой о себе (settings.lastBackupAt). */
export async function syncAll(api: DriveApi, snapshot: Snapshot, json: string, now: number, cache: DocCache): Promise<void> {
  const files = await api.listAll();
  const folders = await ensureFolders(api, files);
  const settings = snapshot.data.kv.settings as { createdAt?: unknown } | undefined;
  const origin = String(settings?.createdAt ?? '');
  await saveBackup(api, files, folders, json, now, origin);
  await syncDocs(api, files, folders, docsInputOf(snapshot, now), now, cache);
}
