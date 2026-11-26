import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { createRng } from '../logic/rng';
import { dayOf } from '../logic/time';
import { emptyValley, plantForCompletion } from '../logic/valley';
import { createPlayer } from '../model/player';
import type { Achievement, Boss, Finding, Pigeon, TaskTemplate } from '../model/types';
import {
  BackupError,
  backupFileName,
  exportSnapshot,
  importSnapshot,
  markBackup,
  needsBackupReminder,
  parseSnapshot,
  serializeSnapshot,
  withBackupMark,
} from './backup';
import { openProsvetDb, SCHEMA_VERSION } from './db';
import {
  normalizeBoss,
  normalizeBosses,
  normalizeFinding,
  normalizeLoft,
  normalizePigeon,
  normalizePlayer,
  normalizeShop,
  normalizeTimer,
  normalizeValley,
} from './normalize';
import {
  getKv,
  listAchievements,
  listBosses,
  listCustomTasks,
  listFindings,
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
  id: 'custom-1', branch: 'prep', kind: 'timed', minutes: 25, onBoard: true, title: 'Своё задание',
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
    expect(p.xp.call).toBe(0);
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

describe('ветки фазы 1: Облик → Летопись, Речь → Подготовка', () => {
  it('опыт Облика складывается с Летописью, опыт Речи переходит в Подготовку', () => {
    const p = normalizePlayer({
      xp: { chronicle: 40, image: 25, speech: 30, scouting: 5, hunt: 12 },
      branchLastTouched: { chronicle: 100, image: 104, speech: 90, hunt: 101 },
    });
    expect(p.xp).toEqual({ chronicle: 65, scouting: 5, hunt: 12, call: 0, threads: 0, prep: 30, craft: 0 });
    expect(p.branchLastTouched).toEqual({ chronicle: 104, prep: 90, hunt: 101 });
  });

  it('незнакомые ключи опыта отбрасываются', () => {
    expect(normalizePlayer({ xp: { hunt: 3, нечто: 9, chronicle: 'x' } }).xp).toEqual({ ...createPlayer().xp, hunt: 3 });
  });

  it('идущий таймер старой ветки продолжается в новой', () => {
    const t = { templateId: 'image-linkedin', title: 'LinkedIn', startedAt: NOW, durationMs: 60_000 };
    expect(normalizeTimer({ ...t, branch: 'image' })?.branch).toBe('chronicle');
    expect(normalizeTimer({ ...t, branch: 'speech' })?.branch).toBe('prep');
  });

  it('растения долины и свои задания переходят в новые ветки', async () => {
    const v = normalizeValley({
      plants: [
        { id: 'a', kind: 'birch', size: 'medium', slot: 0, seed: 1, plantedAt: 1, branch: 'image' },
        { id: 'b', kind: 'willow', size: 'large', slot: 1, seed: 2, plantedAt: 2, branch: 'speech' },
      ],
    })!;
    expect(v.plants.map((p) => [p.kind, p.branch])).toEqual([['birch', 'chronicle'], ['willow', 'prep']]);

    const db = await freshDb();
    await db.put('tasks', { ...customTask, id: 'old-image', branch: 'image' as never });
    await db.put('tasks', { ...customTask, id: 'old-speech', branch: 'speech' as never });
    await db.put('tasks', { ...customTask, id: 'broken', branch: 'нет такой' as never });
    expect((await listCustomTasks(db)).map((t) => [t.id, t.branch])).toEqual([['old-image', 'chronicle'], ['old-speech', 'prep']]);
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

  it('при запуске записи загружаются по дате создания, статус сохраняется, испорченные отбрасываются', async () => {
    const db = await freshDb();
    await putAchievement(db, { ...achievement('old', NOW), updatedAt: NOW + 5 });
    await putAchievement(db, { ...achievement('new', NOW + 1), skills: ['CI', 'ci', ' '], status: 'complete' });
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

  it('для Drive: выгрузка без отметки, отметка — отдельно, после записи копии', async () => {
    const db = await filledDb();
    const later = NOW + 5 * DAY_MS;
    const snap = await exportSnapshot(db, later, false);
    expect((snap.data.kv.settings as { lastBackupAt: number | null }).lastBackupAt).toBeNull();
    expect((await loadAppData(db, later)).settings.lastBackupAt).toBeNull();
    const marked = withBackupMark(snap, later);
    expect((marked.data.kv.settings as { lastBackupAt: number }).lastBackupAt).toBe(later);
    expect(parseSnapshot(serializeSnapshot(marked)).data.achievements).toEqual(snap.data.achievements);
    expect((await markBackup(db, later)).lastBackupAt).toBe(later);
    expect((await loadAppData(db, later)).settings.lastBackupAt).toBe(later);
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

  it('база версии 1 обновляется до текущей без потери данных', async () => {
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
    expect(db.version).toBe(SCHEMA_VERSION);
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
    plantForCompletion(emptyValley(), { kind: 'timed', branch: 'prep', minutes: 30, full: true }, NOW, createRng(1))!.valley;

  it('новый игрок — пустая долина, она сохраняется', async () => {
    const db = await freshDb();
    const data = await loadAppData(db, NOW);
    expect(data.valley).toEqual(emptyValley());
    expect(await getKv(db, 'valley')).toEqual(emptyValley());
  });

  it('база старше долины: долина вырастает по опыту и больше не пересоздаётся', async () => {
    const db = await freshDb();
    // Опыт Облика (фаза 1) уходит в Летопись: вырастает дуб, а не берёза.
    await setKv(db, 'player', { ...createPlayer(), xp: { ...createPlayer().xp, hunt: 31, image: 15 } as never });
    const data = await loadAppData(db, NOW, createRng(1));
    expect(data.valley.plants.map((p) => p.kind).sort()).toEqual(['oak', 'pine', 'pine']);
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

describe('лавка', () => {
  const coupon = { id: 'c1', title: 'Массаж', price: 3, boughtAt: NOW, status: 'bought' as const };
  const shop = { prizes: [{ id: 'p1', title: 'Массаж', price: 3, icon: '💆', createdAt: NOW }], coupons: [coupon] };

  it('новый игрок — призов и купонов нет; долина старше лавки получает пустой лагерь', async () => {
    const db = await freshDb();
    await setKv(db, 'valley', { plants: [], decor: [] } as never);
    const data = await loadAppData(db, NOW);
    expect(data.shop).toEqual({ prizes: [], coupons: [] });
    expect(data.valley.camp).toEqual([]);
  });

  it('купон пишется вместе со звёздами и попадает в копию', async () => {
    const source = await freshDb();
    const data = await loadAppData(source, NOW);
    await saveGame(source, { ...data, player: { ...data.player, stars: 1 } }, { shop });
    const loaded = await loadAppData(source, NOW);
    expect(loaded.shop).toEqual(shop);
    expect(loaded.player.stars).toBe(1);

    const target = await freshDb();
    await importSnapshot(target, parseSnapshot(serializeSnapshot(await exportSnapshot(source, NOW))));
    expect((await loadAppData(target, NOW)).shop).toEqual(shop);
  });

  it('испорченные призы и купоны отбрасываются, у выданного купона есть дата выдачи', () => {
    expect(normalizeShop('мусор')).toEqual({ prizes: [], coupons: [] });
    const s = normalizeShop({
      prizes: [shop.prizes[0], { id: 'p2', title: '', price: 2 }, { id: 'p3', title: 'Даром', price: 0 }, { id: 'p4', title: 'Ок', price: 2, icon: 7 }],
      coupons: [coupon, { ...coupon, id: 'c2', status: 'given', boughtAt: NOW + 1 }, { id: 'c3', title: 'Без даты', price: 1 }],
    });
    expect(s.prizes.map((p) => p.id)).toEqual(['p1', 'p4']);
    expect(s.prizes[1]).not.toHaveProperty('icon');
    expect(s.coupons.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(s.coupons[0]).toMatchObject({ status: 'given', givenAt: NOW + 1 });
  });

  it('вещи лагеря без повторов, неизвестные отбрасываются', () => {
    expect(normalizeValley({ plants: [], decor: [], camp: ['tent', 'tent', 'замок', 'lantern'] })?.camp).toEqual(['tent', 'lantern']);
  });
});

describe('боссы', () => {
  const boss: Boss = {
    id: 'b1', title: 'Интервью в «Ромашке»', kind: 'finite', branch: 'prep', status: 'active',
    place: { landmark: 'windmill', seed: 7 }, sessions: [{ startedAt: NOW, minutes: 30, note: 'продукт' }],
    stopwatch: { startedAt: NOW + DAY_MS }, createdAt: NOW,
  };
  const emptyGame = () => ({ player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() });

  it('новый игрок — боссов нет', async () => {
    expect((await loadAppData(await freshDb(), NOW)).bosses).toEqual([]);
  });

  it('босс и награда за подход пишутся вместе', async () => {
    const db = await freshDb();
    const data = await loadAppData(db, NOW);
    await saveGame(db, { ...data, player: { ...data.player, gold: 15 } }, { bosses: [boss] });
    const again = await loadAppData(db, NOW);
    expect(again.player.gold).toBe(15);
    expect(again.bosses).toEqual([boss]);
    expect(await listBosses(db)).toEqual([boss]);
  });

  it('база версии 2 обновляется до версии 3: голуби на месте, боссов нет', async () => {
    const name = `test-upgrade-${dbCounter++}`;
    const v2 = await openDB(name, 2, {
      upgrade(db) {
        db.createObjectStore('kv');
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('achievements', { keyPath: 'id' }).createIndex('byUpdatedAt', 'updatedAt');
        db.createObjectStore('pigeons', { keyPath: 'id' });
      },
    });
    await v2.put('pigeons', { id: 'p', company: 'К', sentAt: NOW, status: 'flying', look: { pose: 'sit', size: 'small', color: 'white' } });
    v2.close();
    const db = await openProsvetDb(name);
    const data = await loadAppData(db, NOW);
    expect(data.pigeons.map((p) => p.id)).toEqual(['p']);
    expect(data.bosses).toEqual([]);
  });

  it('копия с боссами — туда и обратно; копия версии 2 загружается без боссов', async () => {
    const source = await freshDb();
    await loadAppData(source, NOW);
    await saveGame(source, emptyGame(), { bosses: [boss] });
    const text = serializeSnapshot(await exportSnapshot(source, NOW));
    const target = await freshDb();
    await saveGame(target, emptyGame(), { bosses: [{ ...boss, id: 'лишний' }] });
    await importSnapshot(target, parseSnapshot(text));
    expect(await listBosses(target)).toEqual([boss]);

    const v2 = parseSnapshot(JSON.stringify({ app: 'prosvet', schemaVersion: 2, data: { kv: {}, tasks: [], achievements: [], pigeons: [] } }));
    expect(v2.data.bosses).toEqual([]);
    expect(() => parseSnapshot(JSON.stringify({ app: 'prosvet', schemaVersion: 3, data: { kv: {}, tasks: [], achievements: [], pigeons: [] } })))
      .toThrow(BackupError);
  });

  it('испорченные боссы отбрасываются, недостающее восстанавливается', () => {
    expect(normalizeBoss({ id: 'x', title: 'Б', kind: 'other', branch: 'prep' })).toBeNull();
    expect(normalizeBoss({ id: 'x', title: ' ', kind: 'finite', branch: 'prep' })).toBeNull();
    expect(normalizeBoss({ id: 'x', title: 'Б', kind: 'finite', branch: 'nope' })).toBeNull();
    const b = normalizeBoss({
      id: 'x', title: 'Б', kind: 'endless', branch: 'speech', status: 'won', place: { seed: 5 },
      sessions: [{ startedAt: NOW, minutes: 20 }, { minutes: 5 }, { startedAt: NOW, minutes: 0 }],
    })!;
    expect(b).toMatchObject({ branch: 'prep', status: 'active', sessions: [{ startedAt: NOW, minutes: 20 }] });
    expect(b.place.garden).toBeDefined();
    expect(b.place.landmark).toBeUndefined();
    const ended = normalizeBoss({ ...boss, status: 'released', endedAt: undefined })!;
    expect(ended.stopwatch).toBeUndefined();
    expect(ended.endedAt).toBe(NOW);
  });

  it('секундомер остаётся только у запущенного последним', () => {
    const list = normalizeBosses([boss, { ...boss, id: 'b2', stopwatch: { startedAt: NOW + 2 * DAY_MS } }]);
    expect(list.filter((b) => b.stopwatch).map((b) => b.id)).toEqual(['b2']);
  });
});

describe('находки', () => {
  const finding: Finding = { id: 'f1', createdAt: NOW, text: 'Митап по Rust в Хайфе' };
  const emptyGame = () => ({ player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() });

  it('находка и бонус за неё пишутся вместе; повторная запись того же id не дублирует', async () => {
    const db = await freshDb();
    const data = await loadAppData(db, NOW);
    await saveGame(db, { ...data, player: { ...data.player, gold: 4 } }, { finding });
    await saveGame(db, { ...data, player: { ...data.player, gold: 4 } }, { finding });
    expect((await loadAppData(db, NOW)).player.gold).toBe(4);
    expect(await listFindings(db)).toEqual([finding]);
  });

  it('база версии 3 обновляется до версии 4: боссы на месте, находок нет', async () => {
    const name = `test-upgrade-${dbCounter++}`;
    const v3 = await openDB(name, 3, {
      upgrade(db) {
        db.createObjectStore('kv');
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('achievements', { keyPath: 'id' }).createIndex('byUpdatedAt', 'updatedAt');
        db.createObjectStore('pigeons', { keyPath: 'id' });
        db.createObjectStore('bosses', { keyPath: 'id' });
      },
    });
    await v3.put('bosses', { id: 'b', title: 'Б', kind: 'endless', branch: 'scouting', status: 'active', place: { seed: 1 }, sessions: [], createdAt: NOW });
    v3.close();
    const db = await openProsvetDb(name);
    expect((await loadAppData(db, NOW)).bosses.map((b) => b.id)).toEqual(['b']);
    expect(await listFindings(db)).toEqual([]);
  });

  it('копия с находками — туда и обратно; копия версии 3 загружается без находок', async () => {
    const source = await freshDb();
    await loadAppData(source, NOW);
    await saveGame(source, emptyGame(), { finding });
    const text = serializeSnapshot(await exportSnapshot(source, NOW));
    const target = await freshDb();
    await saveGame(target, emptyGame(), { finding: { ...finding, id: 'лишняя' } });
    await importSnapshot(target, parseSnapshot(text));
    expect(await listFindings(target)).toEqual([finding]);

    const v3 = parseSnapshot(
      JSON.stringify({ app: 'prosvet', schemaVersion: 3, data: { kv: {}, tasks: [], achievements: [], pigeons: [], bosses: [] } }),
    );
    expect(v3.data.findings).toEqual([]);
    expect(() =>
      parseSnapshot(JSON.stringify({ app: 'prosvet', schemaVersion: 4, data: { kv: {}, tasks: [], achievements: [], pigeons: [], bosses: [] } })),
    ).toThrow(BackupError);
  });

  it('испорченные находки отбрасываются, пробелы убираются', () => {
    expect(normalizeFinding({ id: 'x', text: '  ' })).toBeNull();
    expect(normalizeFinding({ text: 'без id' })).toBeNull();
    expect(normalizeFinding({ id: 'x', text: '  Канал  о  найме ' })).toEqual({ id: 'x', createdAt: 0, text: 'Канал о найме' });
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

describe('итоги недели', () => {
  it('первый запуск создаёт запись: эта неделя считается увиденной', async () => {
    const db = await freshDb();
    const data = await loadAppData(db, NOW);
    // 23 ноября 2026 — понедельник, неделя началась в воскресенье 22-го.
    const sunday = dayOf(new Date(2026, 10, 22).getTime());
    expect(data.week).toEqual({ seen: sunday, wishes: [] });
    expect(await getKv(db, 'week')).toEqual(data.week);
  });

  it('журнал дней и «что хочется» попадают в резервную копию и возвращаются из неё', async () => {
    const db = await freshDb();
    const player = { ...createPlayer(), days: [{ day: 20_000, minutes: { craft: 30 }, done: { craft: 1 } }] };
    await setKv(db, 'player', player);
    await setKv(db, 'week', { seen: 20_000, wishes: [{ week: 20_000, text: 'Тестовое' }] });
    const snapshot = parseSnapshot(serializeSnapshot(await exportSnapshot(db, NOW)));
    const other = await freshDb();
    await importSnapshot(other, snapshot);
    const data = await loadAppData(other, NOW);
    expect(data.player.days).toEqual(player.days);
    expect(data.week.wishes).toEqual([{ week: 20_000, text: 'Тестовое' }]);
  });
});
