import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DEFAULT_TASKS } from './data/default-tasks';
import { PHRASES, type PhraseContext } from './data/phrases';
import {
  answerPigeonAction,
  cancelTask,
  completeDoneTask,
  completeInstantTask,
  ensureBoard,
  finishTimedTask,
  lateInviteAction,
  onOpen,
  pauseTask,
  plantFromInventory,
  rerollBoard,
  resumeTask,
  returnOverduePigeons,
  sendPigeon,
  startTimedTask,
  tinyTask,
  type CompletedTask,
  type GameState,
  type ReturnedFeather,
  type StreakNews,
  type TimerFix,
} from './logic/game';
import { allSkills, createEntry, updateEntry, type EntryFields } from './logic/journal';
import { pickPhrase } from './logic/phrases';
import { buyCoupon, buyGood, removePrize, savePrize, setCouponGiven, type Good, type PrizeInput } from './logic/shop';
import { cloakView, dueQuestion, feathersOf, markAsked } from './logic/pigeons';
import { viewStreak } from './logic/streak';
import { mergeTemplates } from './logic/tasks';
import { createRng, randomSeed } from './logic/rng';
import { dayOf } from './logic/time';
import { endsAt, isFinished, settleTimer } from './logic/timer';
import type { Achievement, Branch, Finding, LoftState, Pigeon, Settings, ShopState, StopAnswer, TaskTemplate } from './model/types';
import { requestPersistence, type Persistence } from './storage/browser';
import { openProsvetDb, type ProsvetDb } from './storage/db';
import {
  deleteAchievement,
  deleteCustomTask,
  listCustomTasks,
  loadAppData,
  putAchievement,
  putCustomTask,
  saveGame,
  setKv,
  type AppData,
  type SaveExtras,
} from './storage/repo';
import { CustomTaskScreen, type CustomTaskInput, type DoneTaskInput } from './ui/CustomTaskScreen';
import { FeatherScreen, type ShownFeather } from './ui/FeatherScreen';
import { minutesText } from './ui/format';
import { JournalEntryScreen } from './ui/JournalEntryScreen';
import { JournalScreen } from './ui/JournalScreen';
import { LoftScreen } from './ui/LoftScreen';
import { HeroScreen } from './ui/HeroScreen';
import { MainScreen } from './ui/MainScreen';
import { askNotificationPermission, signalTimerEnd } from './ui/notify';
import { RewardScreen, type ShownReward } from './ui/RewardScreen';
import { CouponScreen } from './ui/CouponScreen';
import { PrizeScreen } from './ui/PrizeScreen';
import { go, goHome, journalRoute, replaceRoute, shopRoute, useRoute, valleyRoute } from './ui/router';
import { SettingsScreen } from './ui/SettingsScreen';
import { ShopScreen } from './ui/ShopScreen';
import { TimerScreen } from './ui/TimerScreen';
import { ValleyScreen } from './ui/ValleyScreen';
import { ask } from './ui/confirm';

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

/**
 * Новая запись Летописи — это мгновенное задание «Записать одно достижение» (опыт, золото, карта добычи, серия),
 * откуда бы её ни сделали: с доски, с главного экрана или из списка. Берётся из стартовых заданий напрямую,
 * чтобы запись засчитывалась, даже если пользователь скрыла это задание с доски.
 */
const JOURNAL_TASK = DEFAULT_TASKS.find((t) => t.kind === 'instant' && t.instant === 'journal')!;

/** Мероприятие — мгновенное задание Нитей; на доску не попадает, отмечается на экране «Своё задание». */
const EVENT_TASK = DEFAULT_TASKS.find((t) => t.kind === 'instant' && t.instant === 'event')!;

/** Задание, во время которого полезно открыть Летопись: ветка Летописи или метка journal. */
const opensJournal = (t: TaskTemplate | undefined, branch: Branch) => branch === 'chronicle' || !!t?.tags?.includes('journal');

/** «Запись в Летопись: „Ускорила сборку…“» — для экрана награды. */
function entryRewardTitle(title: string): string {
  const short = title.length > 80 ? `${title.slice(0, 79).trimEnd()}…` : title;
  return `Запись в Летопись: «${short}»`;
}

/** Новые и изменённые голуби поверх списка; свежие сверху. */
function mergePigeons(list: readonly Pigeon[], changed: readonly Pigeon[]): Pigeon[] {
  const byId = new Map(list.map((p) => [p.id, p]));
  for (const p of changed) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => b.sentAt - a.sentAt);
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

/**
 * Как пересчитать засчитанный таймер с поправленным временем или с ответом на вопрос при остановке
 * (docs/phase2-plan.md §3, §4): то же действие на состоянии до завершения, с тем же сидом генератора —
 * карта добычи и место растения те же, если они остаются.
 */
interface Redo {
  before: GameState;
  /** Состояние после завершения. Править можно, пока игра с тех пор не менялась. */
  after: GameState;
  seed: number;
  now: number;
  /** Засчитано при открытии приложения (onOpen), а не по концу таймера. */
  open: boolean;
}

type QueuedReward = ShownReward & {
  seq: number;
  redo?: Redo;
  /** Что уже поправлено: минуты и ответ на вопрос. */
  fix?: TimerFix;
  /** Id находки, записанной с этого экрана: при пересчёте она перезаписывается, а не дублируется. */
  findingId?: string;
  /** Куда улетел голубь, отправленный с этого экрана. */
  sentTo?: string;
};

/** Завершение таймера: по концу времени или «закончила раньше» — или при открытии приложения. */
function settleTimed(redo: Omit<Redo, 'after'>, templates: readonly TaskTemplate[], fix: TimerFix = {}) {
  const rng = createRng(redo.seed);
  if (!redo.open) return finishTimedTask(redo.before, templates, redo.now, rng, fix);
  const r = onOpen(redo.before, templates, redo.now, rng, fix);
  return r.done ? { state: r.state, done: r.done } : null;
}

interface GameProps {
  db: ProsvetDb;
  initial: AppData;
  initialCustom: TaskTemplate[];
  persistence: Persistence | null;
}

function Game({ db, initial, initialCustom, persistence }: GameProps) {
  const [game, setGame] = useState<GameState>({
    player: initial.player,
    board: initial.board,
    timer: initial.timer,
    valley: initial.valley,
  });
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [custom, setCustom] = useState<TaskTemplate[]>(initialCustom);
  /** Экраны наград — по очереди (например, вышло время таймера, пока писалась запись в журнал). */
  const [rewards, setRewards] = useState<QueuedReward[]>([]);
  const rewardSeq = useRef(0);
  /** Записи Летописи, свежие сверху. */
  const [entries, setEntries] = useState<Achievement[]>(initial.achievements);
  const [pigeons, setPigeons] = useState<Pigeon[]>(initial.pigeons);
  const [loft, setLoft] = useState<LoftState>(initial.loft);
  /** Призы за звёзды и купоны. */
  const [shop, setShop] = useState<ShopState>(initial.shop);
  /** Экраны вернувшихся перьев — по очереди. */
  const [feathers, setFeathers] = useState<ShownFeather[]>([]);
  const [news, setNews] = useState<StreakNews | null>(null);
  const [idlePhrase, setIdlePhrase] = useState('');
  const [startPhrase, setStartPhrase] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Только что выросшее в долине: главный экран покажет, как оно растёт. */
  const [fresh, setFresh] = useState<string | null>(null);
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
  const pigeonsRef = useRef(initial.pigeons);
  const loftRef = useRef(initial.loft);
  const shopRef = useRef(initial.shop);

  function commit(next: GameState, extras: SaveExtras = {}) {
    gameRef.current = next;
    setGame(next);
    if (extras.shop) {
      shopRef.current = extras.shop;
      setShop(extras.shop);
    }
    if (extras.pigeons?.length) {
      pigeonsRef.current = mergePigeons(pigeonsRef.current, extras.pigeons);
      setPigeons(pigeonsRef.current);
    }
    if (extras.loft) {
      loftRef.current = extras.loft;
      setLoft(extras.loft);
    }
    const entry = extras.achievement;
    if (entry) setEntries((list) => [entry, ...list.filter((a) => a.id !== entry.id)]);
    saveGame(db, next, extras).catch((e: unknown) => setSaveError(String(e)));
  }

  function showFeather(f: ReturnedFeather) {
    const phrase = takePhrase(f.report.golden ? 'golden_feather' : 'pigeon_return');
    setFeathers((q) => [...q, { ...f, phrase }]);
  }

  function takePhrase(context: PhraseContext): string {
    const r = pickPhrase(PHRASES[context], phrasesRef.current, Math.random);
    phrasesRef.current = r.recent;
    void setKv(db, 'phrases', { recent: r.recent });
    return r.phrase;
  }

  function showReward(done: CompletedTask, redo?: Redo) {
    if (done.planted) setFresh(done.planted.id);
    const r = done.report;
    const phrase = takePhrase(r.comeback ? 'comeback' : 'finish');
    const shown: ShownReward = {
      ...done,
      phrase,
      cardPhrase: r.loot?.kind === 'phrase' ? (r.comeback ? takePhrase('finish') : phrase) : undefined,
      streakPhrase: r.streakMilestones.length > 0 ? takePhrase('streak') : undefined,
    };
    const seq = ++rewardSeq.current;
    setRewards((q) => [...q, { ...shown, seq, redo }]);
  }

  /** Завершает идущий таймер (сейчас) и показывает награду, которую можно будет поправить. */
  function finishTimer(): CompletedTask | null {
    const redo = { before: gameRef.current, seed: randomSeed(), now: Date.now(), open: false };
    const r = settleTimed(redo, templatesRef.current);
    if (!r) return null;
    commit(r.state);
    showReward(r.done, { ...redo, after: r.state });
    return r.done;
  }

  /**
   * «Поправить время» или ответ на вопрос при остановке: пересчитать задание с новыми минутами или ответом.
   * Находка пишется вместе с наградой за неё.
   */
  function redoReward(item: QueuedReward, fix: TimerFix) {
    const redo = item.redo;
    if (!redo || gameRef.current !== redo.after) return;
    const r = settleTimed(redo, templatesRef.current, fix);
    if (!r) return;
    const a = r.done.answer;
    const finding: Finding | undefined =
      a?.ask === 'finding' ? { id: item.findingId ?? crypto.randomUUID(), createdAt: redo.now, text: a.text } : undefined;
    commit(r.state, finding ? { finding } : {});
    if (r.done.planted) setFresh(r.done.planted.id);
    const loot = r.done.report.loot;
    const shown: QueuedReward = {
      ...item,
      ...r.done,
      answer: r.done.answer,
      fix,
      findingId: finding?.id ?? item.findingId,
      cardPhrase: loot?.kind === 'phrase' ? (item.cardPhrase ?? (r.done.report.comeback ? takePhrase('finish') : item.phrase)) : undefined,
      streakPhrase: r.done.report.streakMilestones.length > 0 ? (item.streakPhrase ?? takePhrase('streak')) : undefined,
      redo: { ...redo, after: r.state },
    };
    setRewards((q) => q.map((x) => (x.seq === item.seq ? shown : x)));
  }

  /** Открытие приложения и возвращение в него: таймер, серия, доска, голуби, которые вернулись сами. */
  function refresh() {
    const now = Date.now();
    const before = gameRef.current;
    const seed = randomSeed();
    const r = onOpen(before, templatesRef.current, now, createRng(seed));
    const back = returnOverduePigeons(r.state, pigeonsRef.current, now);
    if (back.state !== gameRef.current) commit(back.state, { pigeons: back.changed });
    // Если заодно вернулись голуби, пересчитать награду таймера отдельно от них нельзя — тогда без правки.
    if (r.done) showReward(r.done, back.changed.length === 0 ? { before, after: back.state, seed, now, open: true } : undefined);
    back.feathers.forEach(showFeather);
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
      const done = finishTimer();
      if (done) void signalTimerEnd(done.title);
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
      go('journal/new');
    }
  }

  async function finishEarly() {
    const t = gameRef.current.timer;
    if (!t) return;
    const settled = settleTimer(t, Date.now());
    if (!settled) {
      const yes = await ask('Прошло меньше минуты — засчитывать пока нечего. Отменить задание?', {
        ok: 'Отменить',
        cancel: 'Продолжить',
      });
      if (yes && gameRef.current.timer) commit(cancelTask(gameRef.current));
      return;
    }
    if (!settled.full) {
      const yes = await ask(`Закончить сейчас? Засчитается ${minutesText(settled.minutes)}, без карты добычи.`, {
        ok: 'Закончить',
        cancel: 'Продолжить',
      });
      // Пока окно было открыто, таймер мог дойти до конца сам.
      if (!yes || !gameRef.current.timer) return;
    }
    finishTimer();
  }

  async function cancel() {
    const yes = await ask('Отменить задание? Награды не будет, но и ничего не потеряешь.', {
      ok: 'Отменить',
      cancel: 'Продолжить',
    });
    if (yes && gameRef.current.timer) commit(cancelTask(gameRef.current));
  }

  // Летопись

  /** Новая запись засчитывается как мгновенное задание и сохраняется вместе с наградой. */
  function addEntry(fields: EntryFields) {
    const at = Date.now();
    const entry = createEntry(fields, crypto.randomUUID(), at);
    const r = completeInstantTask(gameRef.current, JOURNAL_TASK, templatesRef.current, at, Math.random);
    commit(r.state, { achievement: entry });
    showReward({ ...r.done, title: entryRewardTitle(entry.title) });
    goHome();
  }

  /** Правка записи — не задание: награды нет (дополнить черновик можно таймерным заданием с доски). */
  function editEntry(old: Achievement, fields: EntryFields) {
    const entry = updateEntry(old, fields, Date.now());
    setEntries((list) => list.map((a) => (a.id === entry.id ? entry : a)));
    putAchievement(db, entry).catch((e: unknown) => setSaveError(String(e)));
    goHome();
  }

  function removeEntry(id: string) {
    setEntries((list) => list.filter((a) => a.id !== id));
    deleteAchievement(db, id).catch((e: unknown) => setSaveError(String(e)));
    goHome();
  }

  // Голубятня

  function launch(perchIndex: number, company: string) {
    const r = sendPigeon(gameRef.current, loftRef.current, perchIndex, company, Date.now(), Math.random, crypto.randomUUID());
    commit(r.state, { pigeons: [r.pigeon], loft: r.loft });
    showReward(r.done);
  }

  function answer(id: string, outcome: 'rejected' | 'invited') {
    const r = answerPigeonAction(gameRef.current, pigeonsRef.current, id, outcome, Date.now());
    commit(r.state, { pigeons: [r.pigeon] });
    showFeather(r.feather);
  }

  function lateInvite(id: string) {
    const r = lateInviteAction(gameRef.current, pigeonsRef.current, id);
    commit(r.state, { pigeons: [r.pigeon] });
    showFeather(r.feather);
  }

  /** Поставить редкость из запаса или посадить семя на выбранное место (slot). */
  function plant(item: string, slot?: number) {
    const r = plantFromInventory(gameRef.current, item, Date.now(), Math.random, slot);
    if (!r) return;
    commit(r.state);
    setFresh(r.object.id);
  }

  // Лавка

  function buyGoodAction(good: Good): boolean {
    const r = buyGood(gameRef.current, good, Date.now(), Math.random);
    if (!r) return false;
    commit(r.state);
    if (r.placed) setFresh(r.placed.id);
    return true;
  }

  /** Призы и отметки купонов: звёзды не меняются, игру сохранять не нужно. */
  function saveShop(next: ShopState) {
    shopRef.current = next;
    setShop(next);
    setKv(db, 'shop', next).catch((e: unknown) => setSaveError(String(e)));
  }

  function savePrizeAction(input: PrizeInput, id: string | null) {
    const next = savePrize(shopRef.current, input, id ?? crypto.randomUUID(), Date.now());
    if (!next) return;
    saveShop(next);
    goHome();
  }

  function deletePrize(id: string) {
    saveShop(removePrize(shopRef.current, id));
    goHome();
  }

  /** Купон: звёзды списываются и купон записывается одной транзакцией. Свой купон заменяет форму, чтобы «Назад» вёл в лавку. */
  function buyCouponAction(input: PrizeInput & { prizeId?: string }) {
    const r = buyCoupon(gameRef.current.player, shopRef.current, input, crypto.randomUUID(), Date.now());
    if (!r) return;
    commit({ ...gameRef.current, player: r.player }, { shop: r.shop });
    const path = `coupon/${encodeURIComponent(r.coupon.id)}`;
    if (input.prizeId) go(path);
    else replaceRoute(path);
  }

  function buyPrizeAction(prizeId: string) {
    const prize = shopRef.current.prizes.find((p) => p.id === prizeId);
    if (prize) buyCouponAction({ title: prize.title, price: prize.price, icon: prize.icon, prizeId });
  }

  function notYet(id: string) {
    const p = pigeonsRef.current.find((x) => x.id === id);
    if (p) commit(gameRef.current, { pigeons: [markAsked(p, Date.now())] });
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

  /** «Уже сделала»: засчитывается сразу, без таймера. */
  function doneCustom(input: DoneTaskInput) {
    const at = Date.now();
    const r = input.event
      ? completeInstantTask(gameRef.current, EVENT_TASK, templatesRef.current, at, Math.random)
      : completeDoneTask(gameRef.current, input, at, Math.random);
    commit(r.state);
    showReward(input.event ? { ...r.done, title: `Мероприятие: «${input.title}»` } : r.done);
    goHome();
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
    const loaded: GameState = { player: data.player, board: data.board, timer: data.timer, valley: data.valley };
    gameRef.current = loaded;
    phrasesRef.current = data.phrases.recent;
    pigeonsRef.current = data.pigeons;
    loftRef.current = data.loft;
    shopRef.current = data.shop;
    setGame(loaded);
    setPigeons(data.pigeons);
    setLoft(data.loft);
    setShop(data.shop);
    setEntries(data.achievements);
    setSettings(data.settings);
    setCustom(nextCustom);
    templatesRef.current = mergeTemplates(DEFAULT_TASKS, nextCustom, data.settings.hiddenTaskIds);
    refresh();
  }

  let screen;
  const journal = journalRoute(route);
  const editing = journal?.view === 'edit' ? entries.find((a) => a.id === journal.id) : undefined;
  // Пока пишется запись, награды и перья ждут: иначе экран награды закрыл бы форму вместе с набранным текстом.
  const writing = journal?.view === 'new' || editing !== undefined;
  const reward = writing ? undefined : rewards[0];
  const feather = writing ? undefined : feathers[0];
  const knownSkills = useMemo(() => allSkills(entries), [entries]);

  const flying = pigeons.filter((p) => p.status === 'flying');
  const feathersList = useMemo(() => feathersOf(pigeons), [pigeons]);
  const valleyView = valleyRoute(route);
  const shopView = shopRoute(route);
  const onMain =
    !reward && !feather && !game.timer && !journal && !valleyView && !shopView && !['loft', 'hero', 'settings', 'custom'].includes(route);

  // Анимация роста показывается один раз: через несколько секунд на главном экране или на экране «Долина»
  // растение считается обычным.
  const onValley = valleyView !== null && !reward && !feather && !journal;
  useEffect(() => {
    if (!fresh || !(onMain || onValley)) return;
    const id = setTimeout(() => setFresh(null), 6000);
    return () => clearTimeout(id);
  }, [fresh, onMain, onValley]);
  // Спрашивает самый давний голубь, которому пора.
  const asking = [...flying].reverse().find((p) => dueQuestion(p, now) !== null);
  const question = asking ? { pigeon: asking, day: dueQuestion(asking, now)! } : null;

  if (reward) {
    // Своё задание Зова — ссылка в голубятню; у Отклика вместо неё вопрос «Отправила?».
    const callTask = reward.branch === 'call' && reward.minutes !== undefined && reward.ask !== 'pigeon';
    const close = () => setRewards((q) => q.slice(1));
    const canRedo = reward.redo?.after === game;
    screen = (
      <RewardScreen
        key={reward.seq}
        reward={reward}
        onClose={close}
        onLoft={callTask ? () => { close(); go('loft'); } : undefined}
        onCorrect={canRedo ? (minutes) => redoReward(reward, { ...reward.fix, minutes }) : undefined}
        onAnswer={canRedo ? (answer: StopAnswer) => redoReward(reward, { ...reward.fix, answer }) : undefined}
        pigeon={
          reward.ask === 'pigeon'
            ? {
                loft,
                sentTo: reward.sentTo,
                onSend: (perchIndex, company) => {
                  launch(perchIndex, company);
                  setRewards((q) => q.map((x) => (x.seq === reward.seq ? { ...x, sentTo: company } : x)));
                },
              }
            : undefined
        }
      />
    );
  } else if (feather) {
    screen = <FeatherScreen feather={feather} onClose={() => setFeathers((q) => q.slice(1))} />;
  } else if (journal) {
    // Летопись открывается и во время таймера — например, чтобы дополнить черновик за 10 минут задания.
    screen =
      journal.view === 'new' || editing ? (
        <JournalEntryScreen
          key={editing?.id ?? 'new'}
          entry={editing}
          knownSkills={knownSkills}
          rewardWaiting={rewards.length > 0 || feathers.length > 0}
          onSave={(fields) => (editing ? editEntry(editing, fields) : addEntry(fields))}
          onDelete={editing ? () => removeEntry(editing.id) : undefined}
        />
      ) : (
        <JournalScreen entries={entries} drafts={journal.view === 'list' && journal.drafts} />
      );
  } else if (route === 'loft') {
    screen = (
      <LoftScreen
        pigeons={pigeons}
        loft={loft}
        now={now}
        onSend={launch}
        onAnswer={answer}
        onLateInvite={lateInvite}
      />
    );
  } else if (route === 'hero') {
    screen = <HeroScreen player={game.player} feathers={feathersList} />;
  } else if (valleyView) {
    screen = (
      <ValleyScreen
        valley={game.valley}
        fire={viewStreak(game.player.streak, dayOf(now)).fire}
        feathers={feathersList}
        cloakStage={cloakView(feathersList.length).stage}
        fresh={fresh}
        inventory={game.player.inventory}
        onPlant={(item) => plant(item)}
        onPlantAt={plant}
        choosing={valleyView.choosing}
      />
    );
  } else if (shopView?.view === 'coupon') {
    const coupon = shop.coupons.find((c) => c.id === shopView.id);
    screen = coupon ? (
      <CouponScreen
        coupon={coupon}
        onGiven={(given) => saveShop(setCouponGiven(shopRef.current, coupon.id, given, Date.now()))}
      />
    ) : (
      <ShopScreen tab="stars" player={game.player} valley={game.valley} shop={shop} onBuyGood={buyGoodAction} onBuyPrize={buyPrizeAction} />
    );
  } else if (shopView?.view === 'prize' || shopView?.view === 'own') {
    const prize = shopView.view === 'prize' && shopView.id ? shop.prizes.find((p) => p.id === shopView.id) : undefined;
    screen = (
      <PrizeScreen
        key={route}
        mode={shopView.view === 'own' ? 'own' : 'prize'}
        prize={prize}
        stars={game.player.stars}
        onSave={(input) => (shopView.view === 'own' ? buyCouponAction(input) : savePrizeAction(input, prize?.id ?? null))}
        onDelete={prize ? () => deletePrize(prize.id) : undefined}
      />
    );
  } else if (shopView) {
    screen = (
      <ShopScreen
        tab={shopView.view === 'stars' ? 'stars' : 'gold'}
        player={game.player}
        valley={game.valley}
        shop={shop}
        onBuyGood={buyGoodAction}
        onBuyPrize={buyPrizeAction}
      />
    );
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
    const timerTask = templates.find((t) => t.id === game.timer!.templateId);
    screen = (
      <TimerScreen
        onJournal={
          opensJournal(timerTask, game.timer.branch)
            ? () => go(timerTask?.tags?.includes('drafts') ? 'journal/drafts' : 'journal')
            : undefined
        }
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
    screen = <CustomTaskScreen onStart={(input) => void startCustom(input)} onDone={doneCustom} />;
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
        pigeonsInFlight={flying.length}
        question={question}
        onNotYet={notYet}
        onAnswer={answer}
        feathers={feathersList}
        cloakStage={cloakView(feathersList.length).stage}
        fresh={fresh}
        onPlant={(item) => plant(item)}
        coupons={shop.coupons.filter((c) => c.status === 'bought').length}
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
