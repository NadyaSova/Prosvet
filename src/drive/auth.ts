// Вход Google (Google Identity Services, модель токена). Без своего сервера Google даёт странице только
// ключ доступа примерно на час, без долгого refresh-токена. Разрешение на Drive даётся один раз; потом, когда
// ключ истёк, новый ключ берётся по нажатию: окно Google мелькает и закрывается без вопросов.
//
// Окно входа браузер разрешает открыть только прямо в ответ на нажатие. Поэтому библиотека Google
// загружается заранее (prepareAuth), а requestToken вызывается синхронно из обработчика нажатия.

import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from '../config/google';

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(r: TokenResponse, scope: string): boolean;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

export interface Token {
  token: string;
  expiresAt: number;
}

/** Ключ считается истёкшим чуть раньше, чтобы не начать сохранение с ключом, который истечёт посреди. */
const MARGIN_MS = 2 * 60_000;

export const tokenValid = (t: Token | null, now: number): t is Token => !!t && t.expiresAt - MARGIN_MS > now;

export class AuthError extends Error {}

const GIS_URL = 'https://accounts.google.com/gsi/client';
let loading: Promise<void> | null = null;
let client: TokenClient | null = null;
let pending: { resolve: (t: Token) => void; reject: (e: Error) => void } | null = null;

export const driveConfigured = () => GOOGLE_CLIENT_ID !== '';

/** Загружает библиотеку Google и готовит вход. После этого requestToken можно вызывать из нажатия. */
export function prepareAuth(): Promise<void> {
  if (!driveConfigured()) return Promise.reject(new AuthError('Google Drive не настроен.'));
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_URL;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (!oauth2) return reject(new AuthError('Не удалось загрузить вход Google.'));
      client = oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (r) => {
          const p = pending;
          pending = null;
          if (!p) return;
          if (r.error || !r.access_token) return p.reject(new AuthError(r.error === 'access_denied' ? 'Доступ к Drive не дан.' : 'Google не пустил.'));
          if (!oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE)) return p.reject(new AuthError('Без галочки «файлы, созданные приложением» сохранять в Drive нельзя.'));
          p.resolve({ token: r.access_token, expiresAt: Date.now() + Number(r.expires_in ?? 3600) * 1000 });
        },
        error_callback: (e) => {
          const p = pending;
          pending = null;
          p?.reject(new AuthError(e.type === 'popup_closed' ? 'Окно Google закрыто.' : 'Окно Google не открылось. Если браузер блокирует всплывающие окна — разреши их для этого сайта.'));
        },
      });
      resolve();
    };
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new AuthError('Не удалось загрузить вход Google. Проверь интернет.'));
    };
    document.head.append(script);
  });
  return loading;
}

export const authReady = () => client !== null;

/** Открывает окно Google. Вызывать прямо из обработчика нажатия, после prepareAuth. */
export function requestToken(): Promise<Token> {
  if (!client) return Promise.reject(new AuthError('Вход Google ещё загружается.'));
  pending?.reject(new AuthError('Окно Google закрыто.'));
  const p = new Promise<Token>((resolve, reject) => {
    pending = { resolve, reject };
  });
  // prompt '' — согласие спрашивается только в первый раз; без него Google каждый раз показывал бы выбор аккаунта.
  client.requestAccessToken({ prompt: '' });
  return p;
}

// Ключ хранится до конца срока, чтобы перезапуск приложения (Android выгружает его в фоне) не требовал нового нажатия.
// В резервную копию не попадает.

const STORE_KEY = 'prosvet.drive';

export interface StoredAuth extends Token {
  /** Сохранять самой, пока ключ действует: включается нажатием «Сохранить в Drive» или восстановлением. */
  auto: boolean;
}

export function loadAuth(): StoredAuth | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<StoredAuth> | null;
    if (!raw || typeof raw.token !== 'string' || typeof raw.expiresAt !== 'number') return null;
    return { token: raw.token, expiresAt: raw.expiresAt, auto: raw.auto === true };
  } catch {
    return null;
  }
}

export function storeAuth(a: StoredAuth | null): void {
  try {
    if (a) localStorage.setItem(STORE_KEY, JSON.stringify(a));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    // хранилище недоступно — ключ живёт до перезапуска
  }
}
