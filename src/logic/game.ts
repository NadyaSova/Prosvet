// Игровые действия над всем состоянием сразу: игрок, доска, идущий таймер. SPEC.md §5, §7, §8.
// Чистые функции: время и генератор случайных чисел — в параметрах. Интерфейс только вызывает их и сохраняет итог.

import { BALANCE } from '../config/balance';
import type { BoardState, Branch, PlayerState, TaskTemplate } from '../model/types';
import { buildBoard, canReroll, pickTinyTask, refillSlot, repairBoard, type BoardContext } from './board';
import { applyCompletion, refreshStreak, type RewardReport } from './rewards';
import type { Rng } from './rng';
import { dayOf } from './time';
import { endsAt, isFinished, pauseTimer, resumeTimer, settleTimer, startTimer, type TimerState } from './timer';

/** Идущее таймерное задание. Название и ветка хранятся в нём, чтобы разовые задания не нужно было сохранять. */
export interface RunningTask extends TimerState {
  title: string;
  branch: Branch;
}

export interface GameState {
  player: PlayerState;
  board: BoardState;
  timer: RunningTask | null;
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
}

export interface StreakNews {
  logsBurned: number;
  broken: boolean;
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
  const exclude = skip ? [...state.board.taskIds, skip] : state.board.taskIds;
  return (
    pickTinyTask(templates, boardContext(state.player, now), rng, exclude) ??
    pickTinyTask(templates, boardContext(state.player, now), rng, state.board.taskIds)
  );
}

export function startTimedTask(
  state: GameState,
  task: { templateId: string; title: string; branch: Branch; minutes: number },
  now: number,
): GameState {
  if (state.timer) throw new Error('Таймер уже идёт');
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
  return ensureBoard({ player, board: { ...state.board, taskIds }, timer: null }, templates, now, rng);
}

/**
 * Завершает таймерное задание: время вышло — полная награда с картой добычи;
 * «закончила раньше» — награда за отработанные минуты, без карты.
 * Если время вышло раньше now (приложение было закрыто), задание засчитывается в день, когда время вышло.
 * null — таймера нет или отработано меньше минимума (засчитывать нечего).
 */
export function finishTimedTask(
  state: GameState,
  templates: readonly TaskTemplate[],
  now: number,
  rng: Rng,
): { state: GameState; done: CompletedTask } | null {
  const t = state.timer;
  if (!t) return null;
  const settled = settleTimer(t, now);
  if (!settled) return null;
  const at = settled.full ? Math.min(now, endsAt(t) ?? now) : now;
  const { state: player, report } = applyCompletion(
    state.player,
    { kind: 'timed', branch: t.branch, minutes: settled.minutes, full: settled.full },
    at,
    rng,
  );
  return {
    state: afterCompletion(state, player, t.templateId, templates, now, rng),
    done: {
      title: t.title,
      branch: t.branch,
      report,
      minutes: settled.minutes,
      plannedMinutes: Math.round(t.durationMs / 60_000),
      full: settled.full,
      whileAway: false,
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
  const { state: player, report } = applyCompletion(
    state.player,
    { kind: 'instant', branch: template.branch, instant: template.instant },
    now,
    rng,
  );
  return {
    state: { ...afterCompletion(state, player, template.id, templates, now, rng), timer: state.timer },
    done: { title: template.title, branch: template.branch, report, full: true, whileAway: false },
  };
}

/**
 * При открытии приложения и при возвращении в него: засчитывает таймер, если время вышло,
 * проверяет серию (сгоревшие поленья, прерванная серия) и приводит доску в порядок.
 */
export function onOpen(
  state: GameState,
  templates: readonly TaskTemplate[],
  now: number,
  rng: Rng,
): { state: GameState; done: CompletedTask | null; news: StreakNews } {
  let next = state;
  let done: CompletedTask | null = null;
  if (next.timer && isFinished(next.timer, now)) {
    const r = finishTimedTask(next, templates, now, rng)!;
    next = r.state;
    done = { ...r.done, whileAway: true };
  }
  const streak = refreshStreak(next.player, now);
  if (streak.state !== next.player) next = { ...next, player: streak.state };
  next = ensureBoard(next, templates, now, rng);
  return { state: next, done, news: { logsBurned: streak.logsBurned, broken: streak.broken } };
}

/** Можно ли сегодня перетянуть доску (для кнопки). */
export function rerollAvailable(board: BoardState, now: number): boolean {
  return canReroll(board.rerolls, dayOf(now)) && BALANCE.board.freeRerollsPerDay > 0;
}
