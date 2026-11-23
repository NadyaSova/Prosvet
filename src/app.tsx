import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DEFAULT_TASKS } from './data/default-tasks';
import { PHRASES, type PhraseContext } from './data/phrases';
import {
  cancelTask,
  completeInstantTask,
  ensureBoard,
  finishTimedTask,
  onOpen,
  pauseTask,
  rerollBoard,
  resumeTask,
  startTimedTask,
  tinyTask,
  type CompletedTask,
  type GameState,
  type StreakNews,
} from './logic/game';
import { pickPhrase } from './logic/phrases';
import { mergeTemplates } from './logic/tasks';
import { endsAt, isFinished, settleTimer } from './logic/timer';
import type { Achievement, Branch, Settings, TaskTemplate } from './model/types';
import { requestPersistence, type Persistence } from './storage/browser';
import { openProsvetDb, type ProsvetDb } from './storage/db';
import {
  deleteCustomTask,
  listCustomTasks,
  loadAppData,
  putCustomTask,
  saveGame,
  setKv,
  type AppData,
} from './storage/repo';
import { CustomTaskScreen, type CustomTaskInput } from './ui/CustomTaskScreen';
import { minutesText } from './ui/format';
import { JournalEntryScreen } from './ui/JournalEntryScreen';
import { MainScreen } from './ui/MainScreen';
import { askNotificationPermission, signalTimerEnd } from './ui/notify';
import { RewardScreen, type ShownReward } from './ui/RewardScreen';
import { go, goHome, useRoute } from './ui/router';
import { SettingsScreen } from './ui/SettingsScreen';
import { TimerScreen } from './ui/TimerScreen';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; db: ProsvetDb; data: AppData; custom: TaskTemplate[] }
  | { kind: 'error'; message: string };

export function App() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  // null — браузер ещё не ответил. Загрузка приложения этого ответа не ждёт.
  const [persistence, setPersistence] = useState<Persistence | null>(null);

  useEffect(() => {
    (async () => {
      const db = await openProsvetDb();
      const [data, custom] = await Promise.all([loadAppData(db, Date.now()), listCustomTasks(db)]);
      setState({ kind: 'ready', db, data, custom });
    })().catch((e: unknown) => setState({ kind: 'error', message: String(e) }));
    requestPersistence().then(setPersistence, () => setPersistence('unsupported'));
  }, []);

  if (state.kind === 'loading') return <main class="screen loading" />;
  if (state.kind === 'error') {
    return (
      <main class="screen">
        <p class="error">Не удалось открыть данные: {state.message}</p>
      </main>
    );
  }
  return <Game db={state.db} initial={state.data} initialCustom={state.custom} persistence={persistence} />;
}

/** Обновляет экран раз в interval мс — для часов таймера и смены дня. */
function useNow(interval: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

interface GameProps {
  db: ProsvetDb;
  initial: AppData;
  initialCustom: TaskTemplate[];
  persistence: Persistence | null;
}

function Game({ db, initial, initialCustom, persistence }: GameProps) {
  const [game, setGame] = useState<GameState>({ player: initial.player, board: initial.board, timer: initial.timer });
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [custom, setCustom] = useState<TaskTemplate[]>(initialCustom);
  const [reward, setReward] = useState<ShownReward | null>(null);
  const [news, setNews] = useState<StreakNews | null>(null);
  const [idlePhrase, setIdlePhrase] = useState('');
  const [startPhrase, setStartPhrase] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const route = useRoute();
  const now = useNow(game.timer ? 1000 : 30_000);

  const templates = useMemo(
    () => mergeTemplates(DEFAULT_TASKS, custom, settings.hiddenTaskIds),
    [custom, settings.hiddenTaskIds],
  );

  // Обработчики таймеров и событий браузера видят свежее состояние через ссылки.
  const gameRef = useRef(game);
  const templatesRef = useRef(templates);
  templatesRef.current = templates;
  const phrasesRef = useRef(initial.phrases.recent);

  function commit(next: GameState, achievement?: Achievement) {
    gameRef.current = next;
    setGame(next);
    saveGame(db, next, achievement).catch((e: unknown) => setSaveError(String(e)));
  }

  function takePhrase(context: PhraseContext): string {
    const r = pickPhrase(PHRASES[context], phrasesRef.current, Math.random);
    phrasesRef.current = r.recent;
    void setKv(db, 'phrases', { recent: r.recent });
    return r.phrase;
  }

  function showReward(done: CompletedTask) {
    const r = done.report;
    const phrase = takePhrase(r.comeback ? 'comeback' : 'finish');
    setReward({
      ...done,
      phrase,
      cardPhrase: r.loot?.kind === 'phrase' ? (r.comeback ? takePhrase('finish') : phrase) : undefined,
      streakPhrase: r.streakMilestones.length > 0 ? takePhrase('streak') : undefined,
    });
  }

  /** Открытие приложения и возвращение в него: таймер, серия, доска. */
  function refresh() {
    const r = onOpen(gameRef.current, templatesRef.current, Date.now(), Math.random);
    if (r.state !== gameRef.current) commit(r.state);
    if (r.done) showReward(r.done);
    if (r.news.logsBurned > 0 || r.news.broken) setNews(r.news);
  }

  useEffect(() => {
    refresh();
    setIdlePhrase(takePhrase('idle'));
    if (gameRef.current.timer) setStartPhrase(takePhrase('start'));
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Конец таймера, пока приложение открыто или свёрнуто, но ещё в памяти.
  useEffect(() => {
    const t = game.timer;
    const end = t && endsAt(t);
    if (!end) return;
    const id = setTimeout(() => {
      const current = gameRef.current.timer;
      if (!current || !isFinished(current, Date.now())) return;
      const r = finishTimedTask(gameRef.current, templatesRef.current, Date.now(), Math.random);
      if (!r) return;
      commit(r.state);
      showReward(r.done);
      void signalTimerEnd(r.done.title);
    }, Math.max(0, end - Date.now()) + 50);
    return () => clearTimeout(id);
  }, [game.timer]);

  function startTimed(task: { templateId: string; title: string; branch: Branch; minutes: number }) {
    if (gameRef.current.timer) return;
    void askNotificationPermission();
    commit(startTimedTask(gameRef.current, task, Date.now()));
    setStartPhrase(takePhrase('start'));
    goHome();
  }

  function startTemplate(t: TaskTemplate) {
    if (t.kind === 'timed') {
      startTimed({ templateId: t.id, title: t.title, branch: t.branch, minutes: t.minutes });
    } else {
      go(`journal/${encodeURIComponent(t.id)}`);
    }
  }

  function finishEarly() {
    const t = gameRef.current.timer;
    if (!t) return;
    const settled = settleTimer(t, Date.now());
    if (!settled) {
      if (confirm('Прошло меньше минуты — засчитывать пока нечего. Отменить задание?')) commit(cancelTask(gameRef.current));
      return;
    }
    if (!settled.full && !confirm(`Закончить сейчас? Засчитается ${minutesText(settled.minutes)}, без карты добычи.`)) return;
    const r = finishTimedTask(gameRef.current, templatesRef.current, Date.now(), Math.random);
    if (!r) return;
    commit(r.state);
    showReward(r.done);
  }

  function cancel() {
    if (confirm('Отменить задание? Награды не будет, но и ничего не потеряешь.')) commit(cancelTask(gameRef.current));
  }

  function saveJournal(task: TaskTemplate, title: string) {
    const at = Date.now();
    const entry: Achievement = { id: crypto.randomUUID(), createdAt: at, updatedAt: at, title, status: 'draft' };
    const r = completeInstantTask(gameRef.current, task, templatesRef.current, at, Math.random);
    commit(r.state, entry);
    showReward(r.done);
    goHome();
  }

  async function startCustom(input: CustomTaskInput) {
    let templateId = `once-${crypto.randomUUID()}`;
    if (input.save) {
      const t: TaskTemplate = {
        id: `custom-${crypto.randomUUID()}`,
        branch: input.branch,
        kind: 'timed',
        minutes: input.minutes,
        onBoard: true,
        title: input.title,
      };
      await putCustomTask(db, t);
      setCustom((list) => [...list, t]);
      templateId = t.id;
    }
    startTimed({ templateId, title: input.title, branch: input.branch, minutes: input.minutes });
  }

  /** Список заданий изменился — убрать с доски то, чего больше нет. */
  function applyTemplates(nextCustom: TaskTemplate[], nextSettings: Settings) {
    const merged = mergeTemplates(DEFAULT_TASKS, nextCustom, nextSettings.hiddenTaskIds);
    templatesRef.current = merged;
    const next = ensureBoard(gameRef.current, merged, Date.now(), Math.random);
    if (next !== gameRef.current) commit(next);
  }

  function toggleHidden(id: string, hidden: boolean) {
    const ids = settings.hiddenTaskIds.filter((x) => x !== id);
    const next: Settings = { ...settings, hiddenTaskIds: hidden ? [...ids, id] : ids };
    setSettings(next);
    void setKv(db, 'settings', next);
    applyTemplates(custom, next);
  }

  async function deleteCustom(id: string) {
    await deleteCustomTask(db, id);
    const nextCustom = custom.filter((t) => t.id !== id);
    const nextSettings: Settings = { ...settings, hiddenTaskIds: settings.hiddenTaskIds.filter((x) => x !== id) };
    setCustom(nextCustom);
    setSettings(nextSettings);
    void setKv(db, 'settings', nextSettings);
    applyTemplates(nextCustom, nextSettings);
  }

  /** После резервной копии (новая дата копии) или восстановления из неё (новые данные целиком). */
  async function dataChanged(data: AppData) {
    const nextCustom = await listCustomTasks(db);
    const loaded: GameState = { player: data.player, board: data.board, timer: data.timer };
    gameRef.current = loaded;
    phrasesRef.current = data.phrases.recent;
    setGame(loaded);
    setSettings(data.settings);
    setCustom(nextCustom);
    templatesRef.current = mergeTemplates(DEFAULT_TASKS, nextCustom, data.settings.hiddenTaskIds);
    refresh();
  }

  let screen;
  const journalId = route.startsWith('journal/') ? decodeURIComponent(route.slice('journal/'.length)) : null;
  const journalTask = journalId ? templates.find((t) => t.id === journalId && t.kind === 'instant') : undefined;

  if (reward) {
    screen = <RewardScreen reward={reward} onClose={() => setReward(null)} />;
  } else if (route === 'settings') {
    screen = (
      <SettingsScreen
        db={db}
        settings={settings}
        persistence={persistence}
        templates={templates}
        customIds={new Set(custom.map((t) => t.id))}
        onToggleHidden={toggleHidden}
        onDeleteCustom={(id) => void deleteCustom(id)}
        onDataChange={(data) => void dataChanged(data)}
      />
    );
  } else if (game.timer) {
    screen = (
      <TimerScreen
        timer={game.timer}
        now={now}
        phrase={startPhrase}
        onPause={() => commit(pauseTask(gameRef.current, Date.now()))}
        onResume={() => commit(resumeTask(gameRef.current, Date.now()))}
        onFinishEarly={finishEarly}
        onCancel={cancel}
      />
    );
  } else if (route === 'custom') {
    screen = <CustomTaskScreen onStart={(input) => void startCustom(input)} />;
  } else if (journalTask) {
    screen = <JournalEntryScreen task={journalTask} onSave={(title) => saveJournal(journalTask, title)} />;
  } else {
    screen = (
      <MainScreen
        game={game}
        templates={templates}
        now={now}
        idlePhrase={idlePhrase}
        news={news}
        onDismissNews={() => setNews(null)}
        onStart={startTemplate}
        onReroll={() => {
          const next = rerollBoard(gameRef.current, templatesRef.current, Date.now(), Math.random);
          if (next) commit(next);
        }}
        pickTiny={(skip) => tinyTask(gameRef.current, templatesRef.current, Date.now(), Math.random, skip)}
      />
    );
  }

  return (
    <>
      {saveError && <p class="error save-error">Не получилось сохранить: {saveError}</p>}
      {screen}
    </>
  );
}
