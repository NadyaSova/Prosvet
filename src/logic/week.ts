// Итоги недели (docs/phase2-plan.md §6): сколько времени и в каких ветках, что выросло в долине, как продвинулись
// боссы, голуби и перья, костёр. Без награды. Чистые функции: день и время — в параметрах.

import { BALANCE } from '../config/balance';
import {
  BRANCHES,
  type Achievement,
  type Boss,
  type Branch,
  type Day,
  type DayLog,
  type Pigeon,
  type PlayerState,
  type ValleyDecor,
  type ValleyPlant,
  type ValleyState,
  type WeekState,
} from '../model/types';
import { feathersOf } from './pigeons';
import { viewStreak, type StreakView } from './streak';
import { dayOf } from './time';

export const WEEK_DAYS = 7;

/** День недели: 0 — воскресенье, 6 — суббота. День 0 (1 января 1970) — четверг. */
export function weekday(day: Day): number {
  return (((day + 4) % WEEK_DAYS) + WEEK_DAYS) % WEEK_DAYS;
}

/** Первый день недели, в которую входит day (BALANCE.week.firstWeekday — воскресенье). */
export function weekStart(day: Day): Day {
  return day - ((weekday(day) - BALANCE.week.firstWeekday + WEEK_DAYS) % WEEK_DAYS);
}

/**
 * Записывает засчитанное дело в журнал дней: +1 дело ветке и minutes минут (у мгновенных — 0).
 * Дни идут по порядку; новый день встаёт на своё место, даже если он раньше последнего записанного.
 */
export function logDay(days: readonly DayLog[], day: Day, branch: Branch, minutes: number): DayLog[] {
  const add = (d: DayLog): DayLog => ({
    day,
    minutes: minutes > 0 ? { ...d.minutes, [branch]: (d.minutes[branch] ?? 0) + minutes } : d.minutes,
    done: { ...d.done, [branch]: (d.done[branch] ?? 0) + 1 },
  });
  const i = days.findIndex((d) => d.day >= day);
  if (i >= 0 && days[i]!.day === day) return days.map((d, k) => (k === i ? add(d) : d));
  const fresh = add({ day, minutes: {}, done: {} });
  return i < 0 ? [...days, fresh] : [...days.slice(0, i), fresh, ...days.slice(i)];
}

export interface BranchWeek {
  branch: Branch;
  minutes: number;
  done: number;
}

export interface BossWeek {
  boss: Boss;
  /** Подходы, начатые на этой неделе, и их минуты. */
  sessions: number;
  minutes: number;
  /** Победа на этой неделе. */
  won: boolean;
  /** Заведён на этой неделе. */
  isNew: boolean;
}

export interface WeekSummary {
  /** Первый день недели. */
  week: Day;
  minutes: number;
  /** Дела: задания, подходы, голуби, записи в Летопись. */
  done: number;
  /** В сколько дней что-то засчитано. */
  activeDays: number;
  /** Ветки, в которых что-то было: больше минут — выше. */
  branches: BranchWeek[];
  /** Что выросло в долине — растения и редкости, по порядку появления. */
  plants: ValleyPlant[];
  decor: ValleyDecor[];
  /** Боссы, с которыми что-то было: победа, подходы, новый. */
  bosses: BossWeek[];
  /** Голуби: улетели за неделю, вернулись за неделю (по порядку), в пути сейчас, перьев в плаще сейчас. */
  sent: Pigeon[];
  returned: Pigeon[];
  flying: number;
  feathers: number;
  /** Новые записи в Летописи. */
  entries: number;
  /** Костёр — на сегодня. */
  streak: StreakView;
}

export interface WeekData {
  player: PlayerState;
  valley: ValleyState;
  bosses: readonly Boss[];
  pigeons: readonly Pigeon[];
  achievements: readonly Achievement[];
}

/** Итоги недели, начинающейся с week; today — для костра. */
export function weekSummary(data: WeekData, week: Day, today: Day): WeekSummary {
  const has = (day: Day) => day >= week && day < week + WEEK_DAYS;
  const at = (ts: number | undefined) => ts !== undefined && ts > 0 && has(dayOf(ts));

  const logs = data.player.days.filter((d) => has(d.day));
  const branches: BranchWeek[] = BRANCHES.map((branch) => ({
    branch,
    minutes: logs.reduce((s, d) => s + (d.minutes[branch] ?? 0), 0),
    done: logs.reduce((s, d) => s + (d.done[branch] ?? 0), 0),
  }))
    .filter((b) => b.done > 0)
    .sort((a, b) => b.minutes - a.minutes || b.done - a.done);

  const bosses: BossWeek[] = data.bosses
    .map((boss) => {
      const sessions = boss.sessions.filter((s) => at(s.startedAt));
      return {
        boss,
        sessions: sessions.length,
        minutes: sessions.reduce((s, x) => s + x.minutes, 0),
        won: boss.status === 'won' && at(boss.endedAt),
        isNew: at(boss.createdAt),
      };
    })
    .filter((b) => b.sessions > 0 || b.won || (b.isNew && b.boss.status === 'active'))
    .sort((a, b) => Number(b.won) - Number(a.won) || b.minutes - a.minutes);

  const byTime = <T extends { plantedAt: number }>(list: readonly T[]) =>
    list.filter((x) => at(x.plantedAt)).sort((a, b) => a.plantedAt - b.plantedAt);

  return {
    week,
    minutes: branches.reduce((s, b) => s + b.minutes, 0),
    done: branches.reduce((s, b) => s + b.done, 0),
    activeDays: logs.length,
    branches,
    plants: byTime(data.valley.plants),
    decor: byTime(data.valley.decor),
    bosses,
    sent: data.pigeons.filter((p) => at(p.sentAt)).sort((a, b) => a.sentAt - b.sentAt),
    returned: data.pigeons.filter((p) => p.status === 'returned' && at(p.returnedAt)).sort((a, b) => a.returnedAt! - b.returnedAt!),
    flying: data.pigeons.filter((p) => p.status === 'flying').length,
    feathers: feathersOf(data.pigeons).length,
    entries: data.achievements.filter((a) => at(a.createdAt)).length,
    streak: viewStreak(data.player.streak, today),
  };
}

/** Есть ли что показать: дела, вернувшиеся голуби, победы. Пустую неделю итогами не показываем — без упрёка. */
export function hasContent(s: WeekSummary): boolean {
  return s.done > 0 || s.returned.length > 0 || s.bosses.length > 0 || s.plants.length > 0 || s.decor.length > 0;
}

/** Состояние итогов при первом запуске: эта неделя считается уже увиденной, первые итоги — в следующую. */
export function createWeekState(today: Day): WeekState {
  return { seen: weekStart(today), wishes: [] };
}

/**
 * Пора ли показать итоги: наступила неделя, в которую их ещё не показывали. Возвращает начало недели,
 * итоги которой показать (прошлой), и новое состояние. null — в эту неделю уже показаны или пропущены.
 */
export function dueWeek(state: WeekState, today: Day): { week: Day; state: WeekState } | null {
  const current = weekStart(today);
  if (state.seen >= current) return null;
  return { week: current - WEEK_DAYS, state: { ...state, seen: current } };
}

/** «Что хочется на этой неделе» для недели week. */
export function wishFor(state: WeekState, week: Day): string | undefined {
  return state.wishes.find((w) => w.week === week)?.text;
}

/** Одна строка: пробелы по краям и повторы убраны, длина ограничена. */
export function cleanWish(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, BALANCE.week.wishMaxLength).trim();
}

/** Записать или заменить «что хочется» для недели week. Пустая строка убирает запись. */
export function setWish(state: WeekState, week: Day, text: string): WeekState {
  const clean = cleanWish(text);
  const others = state.wishes.filter((w) => w.week !== week);
  return { ...state, wishes: clean ? [...others, { week, text: clean }].sort((a, b) => a.week - b.week) : others };
}
