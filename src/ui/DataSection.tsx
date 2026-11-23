// Раздел «Данные» в настройках: защита от очистки, резервная копия, восстановление.

import { useState } from 'preact/hooks';
import {
  BackupError,
  backupFileName,
  exportSnapshot,
  importSnapshot,
  needsBackupReminder,
  parseSnapshot,
  serializeSnapshot,
} from '../storage/backup';
import { downloadText, type Persistence } from '../storage/browser';
import type { Settings } from '../model/types';
import type { ProsvetDb } from '../storage/db';
import { loadAppData, type AppData } from '../storage/repo';

interface Props {
  db: ProsvetDb;
  settings: Settings;
  /** null — браузер ещё не ответил. */
  persistence: Persistence | null;
  onChange: (data: AppData) => void;
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const PERSISTENCE_TEXT: Record<Persistence, string> = {
  persisted: 'Браузер не будет удалять данные сам.',
  'not-persisted': 'Браузер может удалить данные, если на телефоне кончится место. Делай резервные копии.',
  unsupported: 'Браузер не умеет защищать данные от очистки. Делай резервные копии.',
};

export function DataSection({ db, settings, persistence, onChange }: Props) {
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function backup() {
    const now = Date.now();
    const snapshot = await exportSnapshot(db, now);
    downloadText(serializeSnapshot(snapshot), backupFileName(now));
    onChange(await loadAppData(db, now));
    setMessage({ text: 'Копия сохранена в «Загрузки».' });
  }

  async function restore(file: File) {
    try {
      const snapshot = parseSnapshot(await file.text());
      const when = snapshot.exportedAt ? dateFormat.format(new Date(snapshot.exportedAt)) : 'неизвестной даты';
      if (!confirm(`Заменить все данные копией от ${when}? Текущие данные пропадут.`)) return;
      await importSnapshot(db, snapshot);
      onChange(await loadAppData(db, Date.now()));
      setMessage({ text: 'Данные восстановлены.' });
    } catch (e) {
      setMessage({ text: e instanceof BackupError ? e.message : `Не получилось: ${String(e)}`, error: true });
    }
  }

  return (
    <section class="card data">
      <h2>Данные</h2>
      <p>Всё хранится только на этом телефоне. {persistence && PERSISTENCE_TEXT[persistence]}</p>
      <p>
        Первый запуск: {dateFormat.format(settings.createdAt)}
        <br />
        Последняя копия: {settings.lastBackupAt ? dateFormat.format(settings.lastBackupAt) : 'ещё не делала'}
      </p>
      {needsBackupReminder(settings, Date.now()) && <p class="data__reminder">Давно не было копии — самое время.</p>}

      <div class="data__buttons">
        <button type="button" class="button" onClick={backup}>
          Сохранить копию
        </button>
        <label class="button button--secondary">
          Восстановить из копии
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              input.value = '';
              if (file) void restore(file);
            }}
          />
        </label>
      </div>
      {message && <p class={message.error ? 'error' : 'data__ok'}>{message.text}</p>}
    </section>
  );
}
