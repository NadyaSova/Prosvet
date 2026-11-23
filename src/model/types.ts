// Игровая модель. Только данные, без логики и без отрисовки.

/** Номер календарного дня по местному времени телефона (см. logic/time.ts). */
export type Day = number;

/** Пять направлений поиска работы (SPEC.md §6). */
export const BRANCHES = ['chronicle', 'image', 'speech', 'scouting', 'hunt'] as const;
export type Branch = (typeof BRANCHES)[number];

export const TASK_MINUTES = [5, 10, 15, 25, 30, 45, 60] as const;
export type TaskMinutes = (typeof TASK_MINUTES)[number];

/** Виды мгновенных заданий — у каждого своя награда. */
export type InstantKind = 'application' | 'rejection' | 'interview' | 'journal';

interface TaskTemplateBase {
  id: string;
  branch: Branch;
  title: string;
  description?: string;
  tags?: string[];
  /** false — задание не попадает на доску (например, «Получила отказ» — это отчёт, он доступен всегда). */
  onBoard: boolean;
  /** Пользователь скрыла задание. */
  hidden?: boolean;
}

export type TaskTemplate = TaskTemplateBase &
  ({ kind: 'timed'; minutes: TaskMinutes } | { kind: 'instant'; instant: InstantKind });

export interface StreakState {
  /** Первый день текущей серии; null — серии нет (ещё не было или прервалась). */
  startDay: Day | null;
  /** Последний активный день; после прерывания серии сохраняется — по нему видно «вернулась после перерыва». */
  lastActiveDay: Day | null;
  /** На сколько дней окно продлено сгоревшими поленьями после последнего активного дня. */
  extraDays: number;
  /** Поленья в запасе. */
  logs: number;
  /** Самая большая веха, за которую в этой серии уже дали награду. */
  milestoneReached: number;
}

export type BranchXp = Record<Branch, number>;

export interface PlayerState {
  /** Опыт по веткам; общий опыт — их сумма. */
  xp: BranchXp;
  gold: number;
  stars: number;
  /** Шрамы, которые ещё можно обменять на звезду. */
  scars: number;
  /** Все шрамы за всё время — для «Коллекции шрамов». */
  scarsTotal: number;
  streak: StreakState;
  /** Когда каждую ветку трогали в последний раз — для весов доски. */
  branchLastTouched: Partial<Record<Branch, Day>>;
  /** Выпавший декор (семена, редкости), который ещё не посажен в долину. */
  inventory: string[];
}
