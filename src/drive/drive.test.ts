import { describe, expect, it } from 'vitest';
import { dayOf } from '../logic/time';
import { weekStart } from '../logic/week';
import type { Achievement, Boss, WeekState } from '../model/types';
import type { Snapshot } from '../storage/backup';
import { DOC_MIME, DriveError, FOLDER_MIME, createDriveApi, type DriveApi, type DriveFile, type NewFile, type Upload } from './api';
import { bossDoc, bossHasNotes, docFingerprint, driveDocs, escapeHtml, findingsDoc, journalDoc, weeksDoc } from './docs';
import { backupsOf, ensureFolders, saveBackup, snapshotFingerprint, syncAll, syncDocs, type DocCache } from './sync';

const NOW = new Date(2026, 10, 26, 14, 5).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Drive в памяти: хранит файлы и считает запросы. */
function fakeDrive() {
  const files = new Map<string, DriveFile & { content?: string }>();
  let n = 0;
  let clock = NOW;
  const calls: string[] = [];
  const api: DriveApi = {
    async listAll() {
      calls.push('list');
      return [...files.values()].map(({ content: _, ...f }) => ({ ...f, parents: f.parents && [...f.parents], appProperties: f.appProperties && { ...f.appProperties } }));
    },
    async create(meta: NewFile, content?: Upload) {
      calls.push(`create ${meta.name}`);
      const f = { id: `f${++n}`, name: meta.name, mimeType: meta.mimeType, parents: meta.parents, appProperties: meta.appProperties, modifiedTime: new Date(clock).toISOString(), content: content?.body };
      files.set(f.id, f);
      const { content: _, ...out } = f;
      return { ...out };
    },
    async update(id, meta, content) {
      calls.push(`update ${id}`);
      const f = files.get(id)!;
      Object.assign(f, meta, { modifiedTime: new Date(clock).toISOString() });
      if (content) f.content = content.body;
      const { content: _, ...out } = f;
      return { ...out };
    },
    async remove(id) {
      calls.push(`remove ${id}`);
      files.delete(id);
    },
    async download(id) {
      return files.get(id)?.content ?? '';
    },
  };
  return { api, files, calls, setClock: (t: number) => (clock = t) };
}

const boss = (over: Partial<Boss> = {}): Boss => ({
  id: 'b1',
  title: 'Интервью в Acme',
  kind: 'finite',
  branch: 'prep',
  status: 'active',
  place: { landmark: 'bridge', seed: 1 },
  sessions: [],
  createdAt: NOW - 5 * DAY,
  ...over,
});

const entry = (over: Partial<Achievement> = {}): Achievement => ({
  id: 'a1',
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
  title: 'Ускорила сборку',
  status: 'draft',
  ...over,
});

const week: WeekState = { seen: 0, wishes: [] };

function snapshot(over: Partial<Snapshot['data']> = {}, settings: object = { createdAt: 111, lastBackupAt: null, hiddenTaskIds: [] }): Snapshot {
  return {
    app: 'prosvet',
    schemaVersion: 4,
    exportedAt: '',
    data: { kv: { settings, week }, tasks: [], achievements: [], pigeons: [], bosses: [], findings: [], ...over },
  };
}

describe('документы Drive', () => {
  it('в каждом документе — предупреждение, что правки пропадут', () => {
    const docs = driveDocs({ achievements: [], findings: [], bosses: [], week }, NOW);
    expect(docs.map((d) => d.title)).toEqual(['Летопись', 'Находки', 'Недели']);
    for (const d of docs) expect(d.html).toContain('Правки, сделанные здесь, пропадут');
  });

  it('Летопись: записи с частями, текст экранируется', () => {
    const html = journalDoc([entry({ context: 'Проект <X> & Y', result: 'Быстрее на 40%', skills: ['C#'], status: 'complete' })], NOW);
    expect(html).toContain('<h2>Ускорила сборку</h2>');
    expect(html).toContain('<b>Контекст.</b> Проект &lt;X&gt; &amp; Y');
    expect(html).toContain('Навыки: C#');
    expect(html).toContain('Статус: готово');
    expect(html).not.toContain('Как сделала');
  });

  it('Находки: свежие сверху, по дням', () => {
    const html = findingsDoc(
      [
        { id: '1', createdAt: NOW - 2 * DAY, text: 'Митап в Хайфе' },
        { id: '2', createdAt: NOW, text: 'Компания Beta' },
      ],
      NOW,
    );
    expect(html.indexOf('Компания Beta')).toBeLessThan(html.indexOf('Митап в Хайфе'));
    expect(html).toContain('<h2>26 ноября 2026</h2>');
    expect(html).toContain('<h2>24 ноября 2026</h2>');
  });

  it('Недели: что хотелось, по неделям', () => {
    const w = weekStart(dayOf(NOW));
    const html = weeksDoc({ seen: 0, wishes: [{ week: w - 7, text: 'Дописать резюме' }, { week: w, text: ' ' }] }, NOW);
    expect(html).toContain('<h2>15–21 ноября</h2>');
    expect(html).toContain('Хотелось: Дописать резюме');
    expect(html.match(/<h2>/g)).toHaveLength(1);
  });

  it('документ — только у боссов с заметками', () => {
    expect(bossHasNotes(boss())).toBe(false);
    expect(bossHasNotes(boss({ sessions: [{ startedAt: NOW, minutes: 20 }] }))).toBe(false);
    expect(bossHasNotes(boss({ sessions: [{ startedAt: NOW, minutes: 20, note: 'спросили про SQL' }] }))).toBe(true);
    expect(bossHasNotes(boss({ victoryNote: 'Позвали дальше' }))).toBe(true);
    const docs = driveDocs({ achievements: [], findings: [], bosses: [boss(), boss({ id: 'b2', note: 'Подготовить рассказ' })], week }, NOW);
    expect(docs.filter((d) => d.folder === 'bosses').map((d) => d.key)).toEqual(['boss:b2']);
  });

  it('босс: подходы свежие сверху, заметка победы', () => {
    const html = bossDoc(
      boss({
        status: 'won',
        endedAt: NOW,
        victoryNote: 'Разбор: всё прошло',
        sessions: [
          { startedAt: NOW - 2 * DAY, minutes: 30, note: 'первый' },
          { startedAt: NOW - DAY, minutes: 45 },
        ],
      }),
      NOW,
    );
    expect(html).toContain('Конечный босс · Подготовка');
    expect(html).toContain('победа 26 ноября 2026');
    expect(html).toContain('2 подхода, 1 ч 15 мин');
    expect(html).toContain('<h2>Заметка победы</h2><p>Разбор: всё прошло</p>');
    expect(html.indexOf('45 минут')).toBeLessThan(html.indexOf('первый'));
  });

  it('отпечаток не зависит от времени обновления', () => {
    expect(docFingerprint(journalDoc([], NOW))).toBe(docFingerprint(journalDoc([], NOW + HOUR)));
    expect(escapeHtml('"a"')).toBe('&quot;a&quot;');
  });
});

describe('папки и копии в Drive', () => {
  it('папки создаются один раз и потом находятся по меткам', async () => {
    const d = fakeDrive();
    const first = await ensureFolders(d.api, await d.api.listAll());
    expect(first.root.name).toBe('Просвет');
    expect(first.backups.parents).toEqual([first.root.id]);
    expect(first.bosses.mimeType).toBe(FOLDER_MIME);
    const again = await ensureFolders(d.api, await d.api.listAll());
    expect(again.root.id).toBe(first.root.id);
    expect(d.files.size).toBe(3);
  });

  it('копия — одна на день: тот же день перезаписывается, новый день — новый файл', async () => {
    const d = fakeDrive();
    let clockNow = NOW;
    const save = async (json: string) => {
      const files = await d.api.listAll();
      await saveBackup(d.api, files, await ensureFolders(d.api, files), json, clockNow, '111');
    };
    await save('{"v":1}');
    clockNow = NOW + HOUR;
    d.setClock(clockNow);
    await save('{"v":2}');
    let list = backupsOf(await d.api.listAll());
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('prosvet-2026-11-26.json');
    expect(await d.api.download(list[0]!.id)).toBe('{"v":2}');

    clockNow = NOW + DAY;
    d.setClock(clockNow);
    await save('{"v":3}');
    list = backupsOf(await d.api.listAll());
    expect(list.map((b) => b.name)).toEqual(['prosvet-2026-11-27.json', 'prosvet-2026-11-26.json']);
  });

  it('копию других данных того же дня не затирает (приложение поставили заново)', async () => {
    const d = fakeDrive();
    const files = await d.api.listAll();
    const folders = await ensureFolders(d.api, files);
    await saveBackup(d.api, files, folders, 'old', NOW, '111');
    await saveBackup(d.api, files, folders, 'fresh', NOW + HOUR, '999');
    const list = backupsOf(await d.api.listAll());
    expect(list).toHaveLength(2);
    expect(list.map((b) => b.name)).toContain('prosvet-2026-11-26-1505.json');
  });

  it('хранится не больше keep копий, удаляются самые старые', async () => {
    const d = fakeDrive();
    const files = await d.api.listAll();
    const folders = await ensureFolders(d.api, files);
    for (let i = 0; i < 5; i++) {
      d.setClock(NOW + i * DAY);
      await saveBackup(d.api, files, folders, `{"day":${i}}`, NOW + i * DAY, '111', 3);
    }
    const list = backupsOf(await d.api.listAll());
    expect(list.map((b) => b.day)).toEqual(['2026-11-30', '2026-11-29', '2026-11-28']);
  });
});

describe('документы в Drive', () => {
  it('создаются как Google Docs, неизменившиеся второй раз не загружаются', async () => {
    const d = fakeDrive();
    const cache: DocCache = new Map();
    const input = { achievements: [entry()], findings: [], bosses: [boss({ note: 'план' })], week };
    let files = await d.api.listAll();
    const folders = await ensureFolders(d.api, files);
    await syncDocs(d.api, files, folders, input, NOW, cache);
    const docs = [...d.files.values()].filter((f) => f.mimeType === DOC_MIME);
    expect(docs.map((f) => f.name).sort()).toEqual(['Интервью в Acme', 'Летопись', 'Находки', 'Недели']);
    expect(docs.find((f) => f.name === 'Интервью в Acme')!.parents).toEqual([folders.bosses.id]);

    d.calls.length = 0;
    files = await d.api.listAll();
    await syncDocs(d.api, files, folders, input, NOW + HOUR, cache);
    expect(d.calls.filter((c) => c !== 'list')).toEqual([]);

    const changed = { ...input, bosses: [boss({ title: 'Интервью в Acme, финал', note: 'план' })] };
    await syncDocs(d.api, files, folders, changed, NOW + HOUR, cache);
    expect(d.calls.filter((c) => c.startsWith('update'))).toHaveLength(1);
    expect([...d.files.values()].some((f) => f.name === 'Интервью в Acme, финал')).toBe(true);
  });

  it('новый запуск приложения (пустой кэш) перезаписывает документы, а не создаёт новые', async () => {
    const d = fakeDrive();
    await syncAll(d.api, snapshot(), '{}', NOW, new Map());
    const count = d.files.size;
    await syncAll(d.api, snapshot(), '{}', NOW + HOUR, new Map());
    expect(d.files.size).toBe(count);
  });
});

describe('отпечаток данных', () => {
  it('отметка о последней копии не считается изменением', () => {
    const a = snapshot({}, { createdAt: 111, lastBackupAt: null, hiddenTaskIds: [] });
    const b = snapshot({}, { createdAt: 111, lastBackupAt: NOW, hiddenTaskIds: [] });
    expect(snapshotFingerprint(a)).toBe(snapshotFingerprint(b));
    expect(snapshotFingerprint(snapshot({ achievements: [entry()] }))).not.toBe(snapshotFingerprint(a));
  });
});

describe('запросы к Drive', () => {
  function recorder(status = 200, body: unknown = { id: 'x', name: 'n', mimeType: 'm' }) {
    const reqs: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      reqs.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { reqs, fetcher };
  }

  it('файл с содержимым — одним запросом multipart, с ключом в заголовке', async () => {
    const r = recorder();
    await createDriveApi('tok', r.fetcher).create({ name: 'Летопись', mimeType: DOC_MIME, appProperties: { prosvet: 'doc' } }, { type: 'text/html', body: '<p>Привет</p>' });
    const { url, init } = r.reqs[0]!;
    expect(url).toContain('/upload/drive/v3/files?uploadType=multipart');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/^multipart\/related; boundary=/);
    expect(String(init.body)).toContain('"mimeType":"application/vnd.google-apps.document"');
    expect(String(init.body)).toContain('Content-Type: text/html; charset=UTF-8\r\n\r\n<p>Привет</p>');
  });

  it('401 — вход истёк', async () => {
    const r = recorder(401, {});
    await expect(createDriveApi('tok', r.fetcher).listAll()).rejects.toMatchObject({ unauthorized: true });
  });

  it('нет сети — понятная ошибка', async () => {
    const fetcher = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(createDriveApi('tok', fetcher).listAll()).rejects.toBeInstanceOf(DriveError);
  });

  it('список — все страницы', async () => {
    let page = 0;
    const fetcher = (async () => {
      page++;
      const body = page === 1 ? { files: [{ id: 'a' }], nextPageToken: 'p2' } : { files: [{ id: 'b' }] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    expect((await createDriveApi('tok', fetcher).listAll()).map((f) => f.id)).toEqual(['a', 'b']);
  });
});
