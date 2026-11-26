// Раздел «Google Drive» в настройках (docs/phase2-plan.md §7): сохранить копию и документы, восстановить из копии.

import { useEffect, useState } from 'preact/hooks';
import {
  afterRestore,
  downloadDriveBackup,
  driveErrorText,
  driveState,
  listDriveBackups,
  prepareDrive,
  saveToDrive,
  subscribeDrive,
} from '../drive/controller';
import type { BackupFile } from '../drive/sync';
import { BackupError, importSnapshot } from '../storage/backup';
import type { ProsvetDb } from '../storage/db';
import { loadAppData, type AppData } from '../storage/repo';
import { ask } from './confirm';

interface Props {
  db: ProsvetDb;
  onChange: (data: AppData) => void;
}

const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
/** «26 ноября 2026, 14:05». */
const whenText = (t: number) => `${dayMonth.format(t).replace(/\s*г\.$/, '')}, ${clock.format(t)}`;

function useDriveState() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeDrive(() => setTick((n) => n + 1)), []);
  // Срок ключа проходит сам по себе — обновляем раз в минуту.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return driveState();
}

export function DriveSection({ db, onChange }: Props) {
  const s = useDriveState();
  const [backups, setBackups] = useState<BackupFile[] | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(prepareDrive, []);

  if (!s.configured) return null;

  function save() {
    setMessage(null);
    void saveToDrive();
  }

  function openBackups() {
    setMessage(null);
    listDriveBackups().then(setBackups, () => setBackups(null));
  }

  async function restore(b: BackupFile) {
    try {
      const snapshot = await downloadDriveBackup(b.id);
      if (!(await ask(`Заменить все данные копией от ${whenText(b.at)}? Текущие данные пропадут.`, { ok: 'Заменить', cancel: 'Отмена', danger: true }))) return;
      await importSnapshot(db, snapshot);
      onChange(await loadAppData(db, Date.now()));
      setBackups(null);
      afterRestore();
      setMessage({ text: 'Данные восстановлены.' });
    } catch (e) {
      setMessage({ text: e instanceof BackupError ? e.message : driveErrorText(e), error: true });
    }
  }

  let status: string;
  if (s.busy) status = 'Связываюсь с Drive…';
  else if (s.auto && s.until) status = `Сохраняется само до ${clock.format(s.until)}.${s.savedAt ? ` Последний раз — в ${clock.format(s.savedAt)}.` : ''}`;
  else if (!s.ready && !s.error) status = 'Загружаю вход Google…';
  else status = 'Нажми «Сохранить в Drive» — копия и документы сохранятся, а потом около часа будут сохраняться сами.';

  return (
    <section class="card data drive">
      <h2>Google Drive</h2>
      <p>
        Папка «Просвет» на твоём Google Drive: резервные копии (последние 10 дней) и документы для чтения — Летопись, Находки, Недели и
        заметки боссов. Документы собираются из приложения заново, правки в них пропадают.
      </p>
      <p class="muted small">{status}</p>
      {s.error && <p class="error">{s.error}</p>}

      <div class="data__buttons">
        <button type="button" class="button" disabled={!s.ready || s.busy} onClick={save}>
          Сохранить в Drive
        </button>
        <button type="button" class="button button--secondary" disabled={!s.ready || s.busy} onClick={openBackups}>
          Восстановить из Drive
        </button>
      </div>

      {backups && (
        <div class="drive__backups">
          {backups.length === 0 ? (
            <p class="muted small">Копий в Drive пока нет.</p>
          ) : (
            <ul class="drive__list">
              {backups.map((b) => (
                <li key={b.id} class="drive__row">
                  <span>{whenText(b.at)}</span>
                  <button type="button" class="link-button" disabled={s.busy} onClick={() => void restore(b)}>
                    Восстановить
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" class="link-button" onClick={() => setBackups(null)}>
            Скрыть
          </button>
        </div>
      )}
      {message && <p class={message.error ? 'error' : 'data__ok'}>{message.text}</p>}
    </section>
  );
}
