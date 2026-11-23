import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { createRng } from '../logic/rng';
import { emptyValley, plantForCompletion } from '../logic/valley';
import { createPlayer } from '../model/player';
import type { Achievement, Pigeon, TaskTemplate } from '../model/types';
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
import { normalizeLoft, normalizePigeon, normalizePlayer, normalizeTimer, normalizeValley } from './normalize';
import {
  getKv,
  listAchievements,
  listCustomTasks,
  listPigeons,
  loadAppData,
  putAchievement,
  putCustomTask,
  saveGame,
  setKv,
} from './repo';

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

  it('шрамы из старых версий отбрасываются', () => {
    const p = normalizePlayer({ gold: 3, scars: 2, scarsTotal: 5 });
    expect(p.gold).toBe(3);
    expect('scars' in p).toBe(false);
    expect('scarsTotal' in p).toBe(false);
  });

  it('таймер без названия или ветки не загружается', () => {
    const base = { templateId: 'x', startedAt: NOW, durationMs: 60_000 };
    expect(normalizeTimer(base)).toBeNull();
    expect(normalizeTimer({ ...base, title: 'Задание', branch: 'нет такой' })).toBeNull();
    expect(normalizeTimer({ ...base, title: 'Задание', branch: 'hunt' })).toMatchObject({ pausesUsed: 0, branch: 'hunt' });
  });
});

describe('сохранение игры', () => {
  it('игрок, доска, таймер и запись журнала пишутся вместе', async () => {
    const db = await freshDb();
    await loadAppData(db, NOW);
    const timer = { templateId: 'x', title: 'Задание', branch: 'hunt' as const, startedAt: NOW, durationMs: 60_000, pausedAt: null, pausedMs: 0, pausesUsed: 0 };
    await saveGame(db, { player: { ...createPlayer(), gold: 5 }, board: { taskIds: ['a'], rerolls: null }, timer, valley: emptyValley() }, { achievement: achievement('j', NOW) });
    const data = await loadAppData(db, NOW);
    expect(data.player.gold).toBe(5);
    expect(data.board.taskIds).toEqual(['a']);
    expect(data.timer).toEqual(timer);
    expect((await listAchievements(db)).map((a) => a.id)).toEqual(['j']);

    await saveGame(db, { ...data, timer: null });
    expect((await loadAppData(db, NOW)).timer).toBeNull();
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

  it('при запуске записи загружаются по дате создания, статус пересчитывается, испорченные отбрасываются', async () => {
    const db = await freshDb();
    await putAchievement(db, { ...achievement('old', NOW), updatedAt: NOW + 5 });
    await putAchievement(db, {
      ...achievement('new', NOW + 1),
      context: 'Проект', action: 'Сделала', result: 'Вышло', skills: ['CI', 'ci', ' '], status: 'draft',
    });
    await (db as unknown as { put: (s: string, v: unknown) => Promise<unknown> }).put('achievements', { id: 'broken' });
    const data = await loadAppData(db, NOW);
    expect(data.achievements.map((a) => a.id)).toEqual(['new', 'old']);
    expect(data.achievements[0]).toMatchObject({ status: 'complete', skills: ['CI'] });
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

describe('голубятня', () => {
  const pigeon: Pigeon = {
    id: 'p1', company: 'Ромашка', look: { pose: 'preen', size: 'large', color: 'lilac' }, sentAt: NOW, status: 'flying',
  };

  it('при первом запуске создаётся жёрдочка из 5 разных голубей и сохраняется', async () => {
    const db = await freshDb();
    const data = await loadAppData(db, NOW, createRng(1));
    expect(data.loft.perch).toHaveLength(5);
    expect(data.pigeons).toEqual([]);
    expect(await getKv(db, 'loft')).toEqual(data.loft);
    expect((await loadAppData(db, NOW, createRng(2))).loft).toEqual(data.loft);
  });

  it('испорченная жёрдочка не загружается', () => {
    expect(normalizeLoft({ perch: [] })).toBeNull();
    const same = { pose: 'sit', size: 'small', color: 'white' };
    expect(normalizeLoft({ perch: [same, same, same, same, same] })).toBeNull();
  });

  it('голубь и награда за него пишутся вместе', async () => {
    const db = await freshDb();
    const data = await loadAppData(db, NOW);
    const loft = { perch: [...data.loft.perch].reverse() };
    await saveGame(db, { ...data, player: { ...data.player, gold: 5 } }, { pigeons: [pigeon], loft });
    const again = await loadAppData(db, NOW);
    expect(again.player.gold).toBe(5);
    expect(again.pigeons).toEqual([pigeon]);
    expect(again.loft).toEqual(loft);
    expect(await listPigeons(db)).toEqual([pigeon]);
  });

  it('голубь без компании отбрасывается, без вида — получает вид по умолчанию', () => {
    expect(normalizePigeon({ id: 'x', sentAt: NOW })).toBeNull();
    expect(normalizePigeon({ id: 'x', company: 'К', sentAt: NOW })).toMatchObject({ status: 'flying', look: { pose: 'sit' } });
    expect(normalizePigeon({ id: 'x', company: 'К', sentAt: NOW, status: 'returned' })).toMatchObject({ status: 'flying' });
  });

  it('база версии 1 обновляется до версии 2 без потери данных', async () => {
    const name = `test-upgrade-${dbCounter++}`;
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('kv');
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('achievements', { keyPath: 'id' }).createIndex('byUpdatedAt', 'updatedAt');
      },
    });
    await v1.put('kv', { ...createPlayer(), gold: 77 }, 'player');
    await v1.put('achievements', achievement('a', NOW));
    v1.close();

    const db = await openProsvetDb(name);
    expect(db.version).toBe(2);
    const data = await loadAppData(db, NOW);
    expect(data.player.gold).toBe(77);
    expect(data.pigeons).toEqual([]);
    expect((await listAchievements(db)).map((a) => a.id)).toEqual(['a']);
  });

  it('копия с голубями — туда и обратно', async () => {
    const source = await freshDb();
    await loadAppData(source, NOW);
    await saveGame(source, { player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() }, { pigeons: [pigeon] });
    const text = serializeSnapshot(await exportSnapshot(source, NOW));

    const target = await freshDb();
    await saveGame(target, { player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() }, {
      pigeons: [{ ...pigeon, id: 'лишний' }],
    });
    await importSnapshot(target, parseSnapshot(text));
    expect(await listPigeons(target)).toEqual([pigeon]);
    expect((await loadAppData(target, NOW)).loft).toEqual((await loadAppData(source, NOW)).loft);
  });

  it('копия версии 1 (без голубей) загружается', async () => {
    const text = JSON.stringify({
      app: 'prosvet', schemaVersion: 1, exportedAt: '',
      data: { kv: { player: { ...createPlayer(), gold: 12 } }, tasks: [], achievements: [] },
    });
    const snap = parseSnapshot(text);
    expect(snap.schemaVersion).toBe(SCHEMA_VERSION);
    expect(snap.data.pigeons).toEqual([]);
    const db = await freshDb();
    await importSnapshot(db, snap);
    expect((await loadAppData(db, NOW)).player.gold).toBe(12);
  });

  it('копия версии 2 без голубей не загружается', () => {
    const text = JSON.stringify({ app: 'prosvet', schemaVersion: 2, data: { kv: {}, tasks: [], achievements: [] } });
    expect(() => parseSnapshot(text)).toThrow(BackupError);
  });
});

describe('долина', () => {
  const grown = () =>
    plantForCompletion(emptyValley(), { kind: 'timed', branch: 'speech', minutes: 30, full: true }, NOW, createRng(1))!.valley;

  it('новый игрок — пустая долина, она сохраняется', async () => {
    const db = await freshDb();
    const data = await loadAppData(db, NOW);
    expect(data.valley).toEqual(emptyValley());
    expect(await getKv(db, 'valley')).toEqual(emptyValley());
  });

  it('база старше долины: долина вырастает по опыту и больше не пересоздаётся', async () => {
    const db = await freshDb();
    await setKv(db, 'player', { ...createPlayer(), xp: { ...createPlayer().xp, hunt: 31, image: 15 } });
    const data = await loadAppData(db, NOW, createRng(1));
    expect(data.valley.plants.map((p) => p.kind).sort()).toEqual(['birch', 'pine', 'pine']);
    expect((await loadAppData(db, NOW, createRng(2))).valley).toEqual(data.valley);
  });

  it('долина пишется вместе с игрой и попадает в копию', async () => {
    const source = await freshDb();
    const data = await loadAppData(source, NOW);
    await saveGame(source, { ...data, valley: grown() });
    expect((await loadAppData(source, NOW)).valley).toEqual(grown());

    const target = await freshDb();
    await importSnapshot(target, parseSnapshot(serializeSnapshot(await exportSnapshot(source, NOW))));
    expect((await loadAppData(target, NOW)).valley).toEqual(grown());
  });

  it('копия без долины загружается', async () => {
    const text = JSON.stringify({
      app: 'prosvet', schemaVersion: 2, exportedAt: '',
      data: { kv: { player: { ...createPlayer(), gold: 3 } }, tasks: [], achievements: [], pigeons: [] },
    });
    const db = await freshDb();
    await importSnapshot(db, parseSnapshot(text));
    const data = await loadAppData(db, NOW);
    expect(data.player.gold).toBe(3);
    expect(data.valley).toEqual(emptyValley());
  });

  it('испорченные растения отбрасываются, два на одном месте не бывает', () => {
    expect(normalizeValley('мусор')).toBeNull();
    const ok = { id: 'a', kind: 'oak', size: 'large', slot: 3, seed: 7, plantedAt: NOW };
    const v = normalizeValley({
      plants: [ok, { ...ok, id: 'b' }, { ...ok, id: 'c', kind: 'кактус', slot: 4 }, { ...ok, id: 'd', slot: 9999 }],
      decor: [{ id: 'x', kind: 'deer', anchor: 1 }, { id: 'y', kind: 'дракон' }],
    });
    expect(v?.plants.map((p) => p.id)).toEqual(['a']);
    expect(v?.decor).toEqual([{ id: 'x', kind: 'deer', anchor: 1, seed: 0, plantedAt: 0 }]);
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
