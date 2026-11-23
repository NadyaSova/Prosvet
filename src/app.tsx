import { useEffect, useState } from 'preact/hooks';
import { openProsvetDb, type ProsvetDb } from './storage/db';
import { requestPersistence, type Persistence } from './storage/browser';
import { loadAppData, type AppData } from './storage/repo';
import { DataSection } from './ui/DataSection';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; db: ProsvetDb; data: AppData }
  | { kind: 'error'; message: string };

// Временный экран: долина, костёр и доска заданий появятся на следующих шагах.
export function App() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  // null — браузер ещё не ответил. Загрузка приложения этого ответа не ждёт.
  const [persistence, setPersistence] = useState<Persistence | null>(null);

  useEffect(() => {
    (async () => {
      const db = await openProsvetDb();
      setState({ kind: 'ready', db, data: await loadAppData(db, Date.now()) });
    })().catch((e: unknown) => setState({ kind: 'error', message: String(e) }));
    requestPersistence().then(setPersistence, () => setPersistence('unsupported'));
  }, []);

  return (
    <main class="placeholder">
      <img class="placeholder__icon" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
      <h1>Просвет</h1>
      <p>Долина ещё спит под хмарью. Скоро здесь станет светлее.</p>

      {state.kind === 'error' && <p class="error">Не удалось открыть данные: {state.message}</p>}
      {state.kind === 'ready' && (
        <DataSection
          db={state.db}
          data={state.data}
          persistence={persistence}
          onChange={(data) => setState({ ...state, data })}
        />
      )}
    </main>
  );
}
