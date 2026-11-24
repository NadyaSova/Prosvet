// Игровые действия над всем состоянием сразу: игрок, доска, идущий таймер. SPEC.md §5, §7, §8.
// Чистые функции: время и генератор случайных чисел — в параметрах. Интерфейс только вызывает их и сохраняет итог.

import { BALANCE } from '../config/balance';
import type {
  BoardState,
  Boss,
  Branch,
  LoftState,
  Pigeon,
  PlayerState,
  StopAnswer,
  StopQuestion,
  TaskTemplate,
  ValleyDecor,
  ValleyPlant,
  ValleyState,
} from '../model/types';
import { buildBoard, canReroll, pickTinyTask, refillSlot, repairBoard, type BoardContext } from './board';
import {
  addSession,
  clampSessionMinutes,
  measuredMinutes,
  runningBoss,
  sessionStars,
  startStopwatch,
  winBoss,
} from './bosses';
import { answerPigeon, feathersOf, isOverdue, lateInvite, launchPigeon, returnSilent } from './pigeons';
import {
  applyCompletion,
  applyFeather,
  applyVictory,
  refreshStreak,
  type Completion,
  type FeatherReport,
  type RewardReport,
  type VictoryReport,
} from './rewards';
import type { Rng } from './rng';
import { stopBonus } from './stop-questions';
import { dayOf } from './time';
import {
  correctSettlement,
  endsAt,
  isFinished,
  pauseTimer,
  plannedMinutes,
  resumeTimer,
  settleTimer,
  startTimer,
  type TimerState,
} from './timer';
import { isDistrictOpen, plantForCompletion, plantItem } from './valley';

/** Идущее таймерное задание. Название и ветка хранятся в нём, чтобы разовые задания не нужно было сохранять. */
export interface RunningTask extends TimerState {
  title: string;
  branch: Branch;
}

export interface GameState {
  player: PlayerState;
  board: BoardState;
  timer: RunningTask | null;
  valley: ValleyState;
}

/** Что показать на экране награды. */
export interface CompletedTask {
  title: string;
  branch: Branch;
  report: RewardReport;
  /** Для таймерного задания: засчитанные и запланированные минуты. */
  minutes?: number;
  plannedMinutes?: number;
  /** false — «закончила раньше». */
  full: boolean;
  /** Время вышло, пока приложение было закрыто. */
  whileAway: boolean;
  /** Что выросло в долине. null — район уже полон. */
  planted: ValleyPlant | null;
  /** Это растение заполнило район: тумана больше нет. */
  districtOpened: boolean;
  /** Таймерное задание: из какого шаблона и какой у него вопрос при остановке. */
  templateId?: string;
  ask?: StopQuestion;
  /** Ответ на вопрос, с которым посчитана награда. */
  answer?: StopAnswer;
}

/**
 * Что пользователь поправила на экране награды (docs/phase2-plan.md §3, §4): засчитанные минуты
 * и ответ на вопрос при остановке.
 */
export interface TimerFix {
  minutes?: number;
  answer?: StopAnswer;
}

export interface StreakNews {
  logsBurned: number;
  broken: boolean;
}

/** Множитель награды задания (BALANCE.tasks.rewardFactor); у остальных заданий — нет. */
function rewardFactor(templateId: string): number | undefined {
  return BALANCE.tasks.rewardFactor[templateId];
}

function boardContext(player: PlayerState, now: number): BoardContext {
  return { today: dayOf(now), branchLastTouched: player.branchLastTouched };
}

/** Убирает с доски скрытые и удалённые задания и добирает доску до полной. */
export function ensureBoard(state: GameState, templates: readonly TaskTemplate[], now: number, rng: Rng): GameState {
  const taskIds = repairBoard(state.board.taskIds, templates, boardContext(state.player, now), rng);
  return taskIds === state.board.taskIds ? state : { ...state, board: { ...state.board, taskIds: [...taskIds] } };
}

/** Перетянуть доску: все три задания новые. null — сегодня бесплатное перетягивание уже было. */
export function rerollBoard(state: GameState, templates: readonly TaskTemplate[], now: number, rng: Rng): GameState | null {
  const today = dayOf(now);
  const { board } = state;
  if (!canReroll(board.rerolls, today)) return null;
  const taskIds = buildBoard(templates, boardContext(state.player, now), rng, board.taskIds);
  const count = board.rerolls?.day === today ? board.rerolls.count + 1 : 1;
  return { ...state, board: { taskIds, rerolls: { day: today, count } } };
}

/** Задание для «Не хочу ничего». skip — задание, которое уже предлагали (кнопка «Другое»). */
export function tinyTask(
  state: GameState,
  templates: readonly TaskTemplate[],
  now: number,
  rng: Rng,
  skip?: string,
): TaskTemplate | undefined {
  // pickTinyTask только старается не брать задания с доски. Коротких заданий мало (в стартовом наборе — два,
  // оба в Летописи), поэтому «Другое» может взять и задание с доски, лишь бы не то же самое.
  const ctx = boardContext(state.player, now);
  const board = state.board.taskIds;
  const others = skip ? templates.filter((t) => t.id !== skip) : templates;
  return pickTinyTask(others, ctx, rng, board) ?? pickTinyTask(templates, ctx, rng, board);
}

export function startTimedTask(
  state: GameState,
  task: { templateId: string; title: string; branch: Branch; minutes: number },
  now: number,
  bosses: readonly Boss[] = [],
): GameState {
  if (state.timer) throw new Error('Таймер уже идёт');
  if (runningBoss(bosses)) throw new Error('Идёт подход к боссу');
  return { ...state, timer: { ...startTimer(task.templateId, task.minutes, now), title: task.title, branch: task.branch } };
}

export function pauseTask(state: GameState, now: number): GameState {
  return state.timer ? { ...state, timer: pauseTimer(state.timer, now) } : state;
}

export function resumeTask(state: GameState, now: number): GameState {
  return state.timer ? { ...state, timer: resumeTimer(state.timer, now) } : state;
}

/** Отмена: без награды и без штрафа. */
export function cancelTask(state: GameState): GameState {
  return { ...state, timer: null };
}

/** Засчитанное задание с доски уступает место новому. */
function afterCompletion(
  state: GameState,
  player: PlayerState,
  templateId: string,
  templates: readonly TaskTemplate[],
  now: number,
  rng: Rng,
): GameState {
  const ctx = boardContext(player, now);
  const index = state.board.taskIds.indexOf(templateId);
  const taskIds = index >= 0 ? refillSlot(state.board.taskIds, index, templates, ctx, rng) : state.board.taskIds;
  return ensureBoard({ ...state, player, board: { ...state.board, taskIds }, timer: null }, templates, now, rng);
}

/** Засчитанное задание выращивает растение в долине. */
function withPlant(
  state: GameState,
  c: Completion,
  now: number,
  rng: Rng,
): { state: GameState; planted: ValleyPlant | null; districtOpened: boolean } {
  const r = plantForCompletion(state.valley, c, now, rng);
  if (!r) return { state, planted: null, districtOpened: false };
  return { state: { ...state, valley: r.valley }, planted: r.plant, districtOpened: isDistrictOpen(r.valley) };
}

/**
 * Завершает таймерное задание: время вышло — полная награда с картой добычи;
 * «закончила раньше» — награда за отработанные минуты, без карты.
 * Если время вышло раньше now (приложение было закрыто), задание засчитывается в день, когда время вышло.
 * fix.minutes — время, поправленное пользователем (docs/phase2-plan.md §3): засчитывается оно, а не измеренное.
 * fix.answer — ответ на вопрос при остановке (§4): бонус сверх награды за время, если ответ к вопросу этого задания.
 * Чтобы поправить уже засчитанное, интерфейс повторяет вызов на состоянии до завершения с тем же сидом генератора.
 * null — таймера нет или отработано меньше минимума (засчитывать нечего).
 */
export function finishTimedTask(
  state: GameState,
  templates: readonly TaskTemplate[],
  now: number,
  rng: Rng,
  fix: TimerFix = {},
): { state: GameState; done: CompletedTask } | null {
  const t = state.timer;
  if (!t) return null;
  const measured = settleTimer(t, now);
  if (!measured) return null;
  const settled = fix.minutes === undefined ? measured : correctSettlement(t, fix.minutes);
  const at = isFinished(t, now) ? Math.min(now, endsAt(t) ?? now) : now;
  const ask = templates.find((x) => x.id === t.templateId)?.ask;
  const completion: Completion = {
    kind: 'timed',
    branch: t.branch,
    minutes: settled.minutes,
    full: settled.full,
    factor: rewardFactor(t.templateId),
    bonus: stopBonus(ask, fix.answer),
  };
  const { state: player, report } = applyCompletion(state.player, completion, at, rng);
  const grown = withPlant(afterCompletion(state, player, t.templateId, templates, now, rng), completion, at, rng);
  return {
    state: grown.state,
    done: {
      title: t.title,
      branch: t.branch,
      report,
      minutes: settled.minutes,
      plannedMinutes: plannedMinutes(t),
      full: settled.full,
      whileAway: false,
      planted: grown.planted,
      districtOpened: grown.districtOpened,
      templateId: t.templateId,
      ...(ask && { ask }),
      ...(ask && fix.answer?.ask === ask && { answer: fix.answer }),
    },
  };
}

/** Засчитывает мгновенное задание (например, запись в журнал). */
export function completeInstantTask(
  state: GameState,
  template: TaskTemplate,
  templates: readonly TaskTemplate[],
  now: number,
  rng: Rng,
): { state: GameState; done: CompletedTask } {
  if (template.kind !== 'instant') throw new Error('Задание не мгновенное');
  const completion: Completion = { kind: 'instant', branch: template.branch, instant: template.instant };
  const { state: player, report } = applyCompletion(state.player, completion, now, rng);
  const after = { ...afterCompletion(state, player, template.id, templates, now, rng), timer: state.timer };
  const grown = withPlant(after, completion, now, rng);
  return {
    state: grown.state,
    done: {
      title: template.title,
      branch: template.branch,
      report,
      full: true,
      whileAway: false,
      planted: grown.planted,
      districtOpened: grown.districtOpened,
    },
  };
}

/**
 * «Уже сделала» на экране «Своё задание»: дело без таймера, засчитывается сразу как полное таймерное задание
 * на столько минут (опыт, золото, карта добычи, серия, растение). Доска не меняется, идущий таймер — тоже.
 */
export function completeDoneTask(
  state: GameState,
  task: { title: string; branch: Branch; minutes: number },
  now: number,
  rng: Rng,
): { state: GameState; done: CompletedTask } {
  const completion: Completion = { kind: 'timed', branch: task.branch, minutes: task.minutes, full: true };
  const { state: player, report } = applyCompletion(state.player, completion, now, rng);
  const grown = withPlant({ ...state, player }, completion, now, rng);
  return {
    state: grown.state,
    done: {
      title: task.title,
      branch: task.branch,
      report,
      minutes: task.minutes,
      plannedMinutes: task.minutes,
      full: true,
      whileAway: false,
      planted: grown.planted,
      districtOpened: grown.districtOpened,
    },
  };
}

/**
 * При открытии приложения и при возвращении в него: засчитывает таймер, если время вышло,
 * проверяет серию (сгоревшие поленья, прерванная серия) и приводит доску в порядок.
 * fix — поправленное время таймера и ответ на вопрос при остановке (см. finishTimedTask).
 */
export function onOpen(
  state: GameState,
  templates: readonly TaskTemplate[],
  now: number,
  rng: Rng,
  fix: TimerFix = {},
): { state: GameState; done: CompletedTask | null; news: StreakNews } {
  let next = state;
  let done: CompletedTask | null = null;
  if (next.timer && isFinished(next.timer, now)) {
    const r = finishTimedTask(next, templates, now, rng, fix)!;
    next = r.state;
    done = { ...r.done, whileAway: true };
  }
  const streak = refreshStreak(next.player, now);
  if (streak.state !== next.player) next = { ...next, player: streak.state };
  next = ensureBoard(next, templates, now, rng);
  return { state: next, done, news: { logsBurned: streak.logsBurned, broken: streak.broken } };
}

// Голубятня. SPEC.md §9.4. Голуби хранятся отдельно от GameState: функции возвращают изменённых голубей,
// интерфейс сохраняет их вместе с игроком одной транзакцией.

/** Голубь вернулся — что показать на экране пера. */
export interface ReturnedFeather {
  pigeon: Pigeon;
  report: FeatherReport;
  /** Голубь вернулся сам после 15 дней без ответа. */
  silent: boolean;
}

/** Отклик: голубь улетает, это мгновенное задание Зова (опыт, золото, карта добычи, серия). */
export function sendPigeon(
  state: GameState,
  loft: LoftState,
  perchIndex: number,
  company: string,
  now: number,
  rng: Rng,
  id: string,
): { state: GameState; loft: LoftState; pigeon: Pigeon; done: CompletedTask } {
  const launched = launchPigeon(loft, perchIndex, company, now, rng, id);
  const completion: Completion = { kind: 'instant', branch: 'call', instant: 'application' };
  const { state: player, report } = applyCompletion(state.player, completion, now, rng);
  const grown = withPlant({ ...state, player }, completion, now, rng);
  return {
    state: grown.state,
    loft: launched.loft,
    pigeon: launched.pigeon,
    done: {
      title: `Голубь улетел: «${launched.pigeon.company}»`,
      branch: 'call',
      report,
      full: true,
      whileAway: false,
      planted: grown.planted,
      districtOpened: grown.districtOpened,
    },
  };
}

function withFeather(
  state: GameState,
  pigeons: readonly Pigeon[],
  updated: Pigeon,
  golden: boolean,
  silent: boolean,
): { state: GameState; pigeon: Pigeon; feather: ReturnedFeather } {
  const before = feathersOf(pigeons).length;
  const { state: player, report } = applyFeather(state.player, golden, before);
  return { state: { ...state, player }, pigeon: updated, feather: { pigeon: updated, report, silent } };
}

function findPigeon(pigeons: readonly Pigeon[], id: string): Pigeon {
  const p = pigeons.find((x) => x.id === id);
  if (!p) throw new Error('Голубь не найден');
  return p;
}

/** «Отказали» или «Позвали дальше»: голубь возвращается с пером или золотым пером. */
export function answerPigeonAction(
  state: GameState,
  pigeons: readonly Pigeon[],
  id: string,
  outcome: 'rejected' | 'invited',
  now: number,
): { state: GameState; pigeon: Pigeon; feather: ReturnedFeather } {
  const updated = answerPigeon(findPigeon(pigeons, id), outcome, now);
  return withFeather(state, pigeons, updated, outcome === 'invited', false);
}

/** Позвали уже после возвращения с обычным пером: ещё и золотое перо. */
export function lateInviteAction(
  state: GameState,
  pigeons: readonly Pigeon[],
  id: string,
): { state: GameState; pigeon: Pigeon; feather: ReturnedFeather } {
  const updated = lateInvite(findPigeon(pigeons, id));
  return withFeather(state, pigeons, updated, true, false);
}

/**
 * При открытии приложения и при возвращении в него: голуби, которые в пути 15 дней и больше,
 * возвращаются сами с обычным пером. По порядку отправки — так пороги плаща считаются правильно.
 */
export function returnOverduePigeons(
  state: GameState,
  pigeons: readonly Pigeon[],
  now: number,
): { state: GameState; changed: Pigeon[]; feathers: ReturnedFeather[] } {
  const overdue = pigeons.filter((p) => isOverdue(p, now)).sort((a, b) => a.sentAt - b.sentAt);
  if (overdue.length === 0) return { state, changed: [], feathers: [] };
  let next = state;
  let all = [...pigeons];
  const changed: Pigeon[] = [];
  const feathers: ReturnedFeather[] = [];
  for (const p of overdue) {
    const r = withFeather(next, all, returnSilent(p), false, true);
    next = r.state;
    all = all.map((x) => (x.id === p.id ? r.pigeon : x));
    changed.push(r.pigeon);
    feathers.push(r.feather);
  }
  return { state: next, changed, feathers };
}

/**
 * Посадить семя или саженец на выбранное место (slot) или поставить редкость из запаса. Предмет уходит из запаса.
 * null — такого предмета в запасе нет, растению негде расти или место не подходит.
 */
export function plantFromInventory(
  state: GameState,
  item: string,
  now: number,
  rng: Rng,
  slot?: number,
): { state: GameState; object: ValleyPlant | ValleyDecor } | null {
  const index = state.player.inventory.indexOf(item);
  if (index < 0) return null;
  const r = plantItem(state.valley, item, now, rng, slot);
  if (!r) return null;
  const inventory = state.player.inventory.filter((_, i) => i !== index);
  return { state: { ...state, player: { ...state.player, inventory }, valley: r.valley }, object: r.object };
}

// Боссы. docs/phase2-plan.md §5. Боссы хранятся отдельно от GameState, как голуби: функции возвращают
// изменённого босса, интерфейс сохраняет его вместе с игроком одной транзакцией.

function findBoss(bosses: readonly Boss[], id: string): Boss {
  const b = bosses.find((x) => x.id === id);
  if (!b) throw new Error('Босс не найден');
  return b;
}

/** Подход к боссу: секундомер. Пока идёт таймер задания или секундомер другого босса — нельзя. */
export function startBossSession(state: GameState, bosses: readonly Boss[], id: string, now: number): Boss {
  if (state.timer) throw new Error('Идёт таймер задания');
  const running = runningBoss(bosses);
  if (running) throw new Error(running.id === id ? 'Секундомер уже идёт' : 'Идёт подход к другому боссу');
  return startStopwatch(findBoss(bosses, id), now);
}

/**
 * Остановка секундомера: подход записан, награда — как за таймерное задание на столько минут
 * (опыт и золото ветке босса, день серии; карта добычи — от BALANCE.bosses.lootFromMinutes минут).
 * Растения в долине подход не сажает: в долине растёт сам босс — редеет туман или наполняется место.
 * minutes — время, поправленное пользователем; как и у таймера, чтобы поправить уже засчитанное,
 * интерфейс повторяет вызов на состоянии до остановки с тем же сидом генератора.
 * null — секундомер не идёт или на нём меньше минимума, а поправленного времени нет (засчитывать нечего).
 */
export function finishBossSession(
  state: GameState,
  bosses: readonly Boss[],
  id: string,
  now: number,
  rng: Rng,
  options: { minutes?: number; note?: string } = {},
): { state: GameState; boss: Boss; done: CompletedTask } | null {
  const boss = findBoss(bosses, id);
  if (!boss.stopwatch) return null;
  const measured = measuredMinutes(boss, now);
  const minutes = options.minutes === undefined ? measured : clampSessionMinutes(options.minutes);
  if (minutes === null) return null;
  const completion: Completion = {
    kind: 'timed',
    branch: boss.branch,
    minutes,
    full: minutes >= BALANCE.bosses.lootFromMinutes,
    stars: sessionStars(boss),
  };
  const { state: player, report } = applyCompletion(state.player, completion, now, rng);
  return {
    state: { ...state, player },
    boss: addSession(boss, minutes, options.note),
    done: {
      title: boss.title,
      branch: boss.branch,
      report,
      minutes,
      full: true,
      whileAway: false,
      planted: null,
      districtOpened: false,
    },
  };
}

/** Победа над конечным боссом: крупный бонус со звездой. */
export function winBossAction(
  state: GameState,
  bosses: readonly Boss[],
  id: string,
  now: number,
  note?: string,
): { state: GameState; boss: Boss; report: VictoryReport } {
  const boss = winBoss(findBoss(bosses, id), now, note);
  const { state: player, report } = applyVictory(state.player, boss.branch);
  return { state: { ...state, player }, boss, report };
}

/** Можно ли сегодня перетянуть доску (для кнопки). */
export function rerollAvailable(board: BoardState, now: number): boolean {
  return canReroll(board.rerolls, dayOf(now)) && BALANCE.board.freeRerollsPerDay > 0;
}
