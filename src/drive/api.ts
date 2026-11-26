// Обмен с Google Drive (REST API v3). Доступ drive.file: приложение видит только файлы, которые создало само.
// Каждый свой файл приложение помечает в appProperties (prosvet = …), по этим меткам и находит их.

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DOC_MIME = 'application/vnd.google-apps.document';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  modifiedTime?: string;
}

export interface NewFile {
  name: string;
  /** Тип файла в Drive; у документа — DOC_MIME (Drive превращает загруженный HTML в Google Doc). */
  mimeType: string;
  parents?: string[];
  appProperties: Record<string, string>;
}

export interface Upload {
  /** Тип загружаемого содержимого: application/json, text/html. */
  type: string;
  body: string;
}

/** То, что нужно синхронизации от Drive. Отдельный интерфейс — чтобы в тестах подставить Drive в памяти. */
export interface DriveApi {
  /** Все свои файлы и папки, кроме удалённых в корзину. */
  listAll(): Promise<DriveFile[]>;
  create(meta: NewFile, content?: Upload): Promise<DriveFile>;
  update(id: string, meta: Partial<Pick<NewFile, 'name' | 'appProperties'>>, content?: Upload): Promise<DriveFile>;
  remove(id: string): Promise<void>;
  download(id: string): Promise<string>;
}

/** Ошибка Drive; unauthorized — вход Google истёк или отозван, нужно войти заново. */
export class DriveError extends Error {
  constructor(
    message: string,
    readonly unauthorized = false,
  ) {
    super(message);
  }
}

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FIELDS = 'id,name,mimeType,parents,appProperties,modifiedTime';

/** Тело multipart/related: метаданные и содержимое одним запросом. */
function multipart(meta: object, content: Upload): { body: string; type: string } {
  const boundary = `prosvet-${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: ${content.type}; charset=UTF-8\r\n\r\n${content.body}\r\n` +
    `--${boundary}--`;
  return { body, type: `multipart/related; boundary=${boundary}` };
}

export function createDriveApi(token: string, fetcher: typeof fetch = fetch): DriveApi {
  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await fetcher(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
    } catch {
      throw new DriveError('Нет связи с Google Drive. Проверь интернет.');
    }
    if (res.status === 401) throw new DriveError('Вход Google истёк.', true);
    if (!res.ok) {
      let detail = '';
      try {
        detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
      } catch {
        // тело не JSON — остаётся код ответа
      }
      throw new DriveError(`Google Drive ответил ошибкой ${res.status}${detail ? `: ${detail}` : ''}`, res.status === 403 && /scope|insufficient/i.test(detail));
    }
    return res;
  }

  async function send(method: 'POST' | 'PATCH', base: string, meta: object, content?: Upload): Promise<DriveFile> {
    if (!content) {
      const res = await call(`${API}${base}?fields=${FIELDS}`, {
        method,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(meta),
      });
      return (await res.json()) as DriveFile;
    }
    const m = multipart(meta, content);
    const res = await call(`${UPLOAD}${base}?uploadType=multipart&fields=${FIELDS}`, {
      method,
      headers: { 'Content-Type': m.type },
      body: m.body,
    });
    return (await res.json()) as DriveFile;
  }

  return {
    async listAll() {
      const files: DriveFile[] = [];
      let pageToken = '';
      do {
        const q = encodeURIComponent('trashed = false');
        const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
        const res = await call(`${API}?q=${q}&pageSize=1000&spaces=drive&fields=nextPageToken,files(${FIELDS})${page}`);
        const json = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
        files.push(...(json.files ?? []));
        pageToken = json.nextPageToken ?? '';
      } while (pageToken);
      return files;
    },
    create: (meta, content) => send('POST', '', meta, content),
    update: (id, meta, content) => send('PATCH', `/${encodeURIComponent(id)}`, meta, content),
    async remove(id) {
      await call(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async download(id) {
      const res = await call(`${API}/${encodeURIComponent(id)}?alt=media`);
      return res.text();
    },
  };
}
