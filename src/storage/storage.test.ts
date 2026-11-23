import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../model/player';
import type { Achievement, TaskTemplate } from '../model/types';
import {
  BackupError,
  backupFileName,
  exportSnapshot,
  importSnapshot,
  needsBackupReminder,
  parseSnapshot,
  serializeSnapshot,
} from './backup';
import { openProsvetDb, SCHEMA_VERSION } from './db';
import { normalizePlayer } from './normalize';
import { getKv, listAchievements, listCustomTasks, loadAppData, putAchievement, putCustomTask, setKv } from './repo';

const NOW = new Date(2026, 10, 23, 12, 0).getTime();
const DAY_MS = 86_400_000;
let dbCounter = 0;
/** Каждый тест — в своей базе. */
const freshDb = () => openProsvetDb(`test-${dbCounter++}`);

const achievement = (id: string, updatedAt: number): Achievement => ({
  id, createdAt: updatedAt, updatedAt, title: `Запись ${id}`, status: 'draft',
});
const customTask: TaskTemplate = {
  id: 'custom-1', branch: 'speech', kind: 'timed', minutes: 25, onBoard: true, title: 'Своё задание',
};

describe('первый запуск', () => {
  it('создаёт игрока и настройки и сохраняет их', async () => {
    const db = await freshDb();
    const data = await loadAppData(db, NOW);
    expect(data.player).toEqual(createPlayer());
    expect(data.settings.createdAt).toBe(NOW);
    expect(data.timer).toBeNull();
    expect(await getKv(db, 'player')).toEqual(createPlayer());
    // Повторный запуск позже не перезаписывает дату первого запуска.
    expect((await loadAppData(db, NOW + DAY_MS)).settings.createdAt).toBe(NOW);
  });

  it('сохранённое состояние переживает переоткрытие базы', async () => {
    const name = `test-reopen-${dbCounter++}`;
    const db = await openProsvetDb(name);
    await loadAppData(db, NOW);
    await setKv(db, 'player', { ...createPlayer(), gold: 42 });
    db.close();
    const again = await openProsvetDb(name);
    expect((await loadAppData(again, NOW)).player.gold).toBe(42);
  });
});

describe('старые данные без новых полей', () => {
  it('получают значения по умолчанию', () => {
    const old = { gold: 7, xp: { hunt: 5 }, streak: { logs: 1 } };
    const p = normalizePlayer(old);
    expect(p.gold).toBe(7);
    expect(p.xp.hunt).toBe(5);
    expect(p.xp.image).toBe(0);
    expect(p.streak.logs).toBe(1);
    expect(p.streak.startDay).toBeNull();
    expect(p.inventory).toEqual([]);
  });

  it('мусор вместо игрока — новый игрок', () => {
    expect(normalizePlayer('мусор')).toEqual(createPlayer());
  });
});

describe('журнал и свои задания', () => {
  it('записи журнала — свежие сверху', async () => {
    const db = await freshDb();
    await putAchievement(db, achievement('a', NOW));
    await putAchievement(db, achievement('b', NOW + 2));
    await putAchievement(db, achievement('c', NOW + 1));
    expect((await listAchievements(db)).map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  it('свои задания сохраняются', async () => {
    const db = await freshDb();
    await putCustomTask(db, customTask);
    expect(await listCustomTasks(db)).toEqual([customTask]);
  });
});

describe('резервная копия', () => {
  async function filledDb() {
    const db = await freshDb();
    await loadAppData(db, NOW);
    await setKv(db, 'player', { ...createPlayer(), gold: 99, stars: 3 });
    await setKv(db, 'board', { taskIds: ['image-one-line'], rerolls: null });
    await putCustomTask(db, customTask);
    await putAchievement(db, { ...achievement('a', NOW), title: 'Ускорила сборку в 3 раза', skills: ['CI'] });
    return db;
  }

  it('выгрузка и загрузка возвращают те же данные', async () => {
    const source = await filledDb();
    const text = serializeSnapshot(await exportSnapshot(source, NOW));

    const target = await freshDb();
    await loadAppData(target, NOW + DAY_MS);
    await putAchievement(target, achievement('лишняя', NOW)); // должна исчезнуть
    await importSnapshot(target, parseSnapshot(text));

    const data = await loadAppData(target, NOW + DAY_MS);
    expect(data.player.gold).toBe(99);
    expect(data.player.stars).toBe(3);
    expect(data.board.taskIds).toEqual(['image-one-line']);
    expect(data.settings.createdAt).toBe(NOW);
    expect(await listCustomTasks(target)).toEqual([customTask]);
    expect((await listAchievements(target)).map((a) => a.title)).toEqual(['Ускорила сборку в 3 раза']);
  });

  it('выгрузка отмечает дату копии — и в базе, и в самой копии', async () => {
    const db = await filledDb();
    const later = NOW + 5 * DAY_MS;
    const snap = await exportSnapshot(db, later);
    expect((snap.data.kv.settings as { lastBackupAt: number }).lastBackupAt).toBe(later);
    expect((await loadAppData(db, later)).settings.lastBackupAt).toBe(later);
    expect(snap.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('чужой файл не загружается', () => {
    expect(() => parseSnapshot('не json')).toThrow(BackupError);
    expect(() => parseSnapshot('{"app":"other","schemaVersion":1,"data":{}}')).toThrow(BackupError);
    expect(() => parseSnapshot(JSON.stringify({ app: 'prosvet', schemaVersion: 1, data: { kv: {}, tasks: [{}], achievements: [] } })))
      .toThrow(BackupError);
  });

  it('копия из более новой версии не загружается, с понятным объяснением', () => {
    const text = JSON.stringify({ app: 'prosvet', schemaVersion: SCHEMA_VERSION + 1, data: { kv: {}, tasks: [], achievements: [] } });
    expect(() => parseSnapshot(text)).toThrow(/более новой версии/);
  });

  it('неизвестные ключи из копии отбрасываются', () => {
    const text = JSON.stringify({
      app: 'prosvet', schemaVersion: 1, exportedAt: '',
      data: { kv: { player: {}, лишнее: 1 }, tasks: [], achievements: [] },
    });
    expect(Object.keys(parseSnapshot(text).data.kv)).toEqual(['player']);
  });

  it('имя файла — по местной дате', () => {
    expect(backupFileName(NOW)).toBe('prosvet-2026-11-23.json');
  });
});

describe('напоминание о копии', () => {
  const settings = { createdAt: NOW, lastBackupAt: null, hiddenTaskIds: [] };

  it('через 14 дней после первого запуска, если копий не было', () => {
    expect(needsBackupReminder(settings, NOW + 13 * DAY_MS)).toBe(false);
    expect(needsBackupReminder(settings, NOW + 14 * DAY_MS)).toBe(true);
  });

  it('через 14 дней после последней копии', () => {
    const s = { ...settings, lastBackupAt: NOW + 20 * DAY_MS };
    expect(needsBackupReminder(s, NOW + 30 * DAY_MS)).toBe(false);
    expect(needsBackupReminder(s, NOW + 34 * DAY_MS)).toBe(true);
  });
});
