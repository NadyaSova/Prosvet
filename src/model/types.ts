// Игровая модель. Только данные, без логики и без отрисовки.

/** Номер календарного дня по местному времени телефона (см. logic/time.ts). */
export type Day = number;

/** Пять направлений поиска работы (SPEC.md §6). */
export const BRANCHES = ['chronicle', 'image', 'speech', 'scouting', 'hunt'] as const;
export type Branch = (typeof BRANCHES)[number];

export const TASK_MINUTES = [5, 10, 15, 25, 30, 45, 60] as const;
export type TaskMinutes = (typeof TASK_MINUTES)[number];

/**
 * Виды мгновенных заданий — у каждого своя награда.
 * application — голубь улетел с откликом (голубятня).
 */
export type InstantKind = 'application' | 'journal';

interface TaskTemplateBase {
  id: string;
  branch: Branch;
  title: string;
  description?: string;
  tags?: string[];
  /** false — задание не попадает на доску. */
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
  streak: StreakState;
  /** Когда каждую ветку трогали в последний раз — для весов доски. */
  branchLastTouched: Partial<Record<Branch, Day>>;
  /** Выпавший декор (семена, редкости), который ещё не посажен в долину. */
  inventory: string[];
}

/** Запись Летописи — журнала достижений. SPEC.md §10.2. */
export interface Achievement {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Коротко: что сделала. */
  title: string;
  /** Проект, задача, ситуация. */
  context?: string;
  /** Что конкретно сделала и как. */
  action?: string;
  /** Результат, по возможности с цифрами. */
  result?: string;
  skills?: string[];
  status: 'draft' | 'complete';
}

/** Вид голубя. SPEC.md §9.4: несколько поз, размеров и 4 цвета. Перо — того же цвета и размера. */
export const PIGEON_POSES = ['sit', 'preen', 'look'] as const;
export const PIGEON_SIZES = ['small', 'medium', 'large'] as const;
export const PIGEON_COLORS = ['slate', 'white', 'rose', 'lilac'] as const;
export type PigeonPose = (typeof PIGEON_POSES)[number];
export type PigeonSize = (typeof PIGEON_SIZES)[number];
export type PigeonColor = (typeof PIGEON_COLORS)[number];

export interface PigeonLook {
  pose: PigeonPose;
  size: PigeonSize;
  color: PigeonColor;
}

/** silence — 15 дней без ответа; rejected — «Отказали»; invited — «Позвали дальше». */
export type PigeonOutcome = 'silence' | 'rejected' | 'invited';

/** Голубь с откликом. SPEC.md §9.4. */
export interface Pigeon {
  id: string;
  company: string;
  look: PigeonLook;
  /** Когда отправлен отклик. */
  sentAt: number;
  status: 'flying' | 'returned';
  outcome?: PigeonOutcome;
  returnedAt?: number;
  /** Позвали дальше уже после того, как голубь вернулся с обычным пером. */
  lateInvite?: boolean;
  /** Когда последний раз спрашивали «ответили?». */
  lastAskedAt?: number;
}

/** Голубятня: голуби, которые ждут на жёрдочке. */
export interface LoftState {
  perch: PigeonLook[];
}

/** Доска заданий. */
export interface BoardState {
  /** Шаблоны заданий на доске. */
  taskIds: string[];
  /** Перетягивания доски за день. */
  rerolls: { day: Day; count: number } | null;
}

export interface Settings {
  /** Когда приложение открыли впервые. */
  createdAt: number;
  /** Когда последний раз сохраняли резервную копию. */
  lastBackupAt: number | null;
  /** Стартовые задания, которые пользователь скрыла. */
  hiddenTaskIds: string[];
}
