// Игровая модель. Только данные, без логики и без отрисовки.

/** Номер календарного дня по местному времени телефона (см. logic/time.ts). */
export type Day = number;

/**
 * Семь веток — по одной на категорию поиска работы (docs/phase2-plan.md §4.9):
 * Летопись, Разведка, Охота (отбор вакансий), Зов (отклики), Нити (люди), Подготовка (к интервью), Ремесло (учёба).
 * Ветки фазы 1 «Облик» (image) и «Речь» (speech) переносятся при чтении данных — storage/normalize.ts, migrateBranch.
 */
export const BRANCHES = ['chronicle', 'scouting', 'hunt', 'call', 'threads', 'prep', 'craft'] as const;
export type Branch = (typeof BRANCHES)[number];

export const TASK_MINUTES = [5, 10, 15, 20, 25, 30, 45, 60] as const;
export type TaskMinutes = (typeof TASK_MINUTES)[number];

/**
 * Виды мгновенных заданий — у каждого своя награда.
 * application — голубь улетел с откликом (голубятня); journal — запись в Летопись;
 * event — сходила на мероприятие (экран «Своё задание», «Уже сделала»).
 */
export type InstantKind = 'application' | 'journal' | 'event';

/**
 * Вопрос на экране награды, когда таймер остановлен (docs/phase2-plan.md §4):
 * pigeon — «Отправила отклик?» → голубь улетает (Отклик); sent — «Отправила?» → бонус (Написать);
 * finding — необязательная строка-находка → бонус (Чтение сообществ); found — «Нашлась подходящая?» → бонус
 * (Поиск вакансий); verdict — «Откликаться, нет или подумать?» (Разбор вакансии).
 */
export type StopQuestion = 'pigeon' | 'sent' | 'finding' | 'found' | 'verdict';

/** Итог разбора вакансии: откликаться, нет, подумать. */
export type Verdict = 'apply' | 'skip' | 'think';

/** Ответ на вопрос при остановке. Голубь (pigeon) отправляется отдельным действием, в ответах его нет. */
export type StopAnswer =
  | { ask: 'sent'; yes: boolean }
  | { ask: 'found'; yes: boolean }
  | { ask: 'finding'; text: string }
  | { ask: 'verdict'; verdict: Verdict };

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
  /** Вопрос при остановке таймера. */
  ask?: StopQuestion;
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
  /** Что засчитано по дням — для итогов недели (docs/phase2-plan.md §6). По порядку дней, только активные дни. */
  days: DayLog[];
}

/**
 * Засчитанное за один день: минуты и число дел по веткам. Дело — задание, подход к боссу, отправленный голубь,
 * запись в Летопись. У мгновенных дел минут нет. Ведётся с шага 10 фазы 2; раньше дни не записывались.
 */
export interface DayLog {
  day: Day;
  minutes: Partial<Record<Branch, number>>;
  done: Partial<Record<Branch, number>>;
}

/** Итоги недели (docs/phase2-plan.md §6). */
export interface WeekState {
  /** Начало недели (воскресенье), в которую итоги прошлой недели уже показаны или пропущены. */
  seen: Day;
  /** «Что хочется на этой неделе»: week — начало недели, к которой строка относится. */
  wishes: { week: Day; text: string }[];
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

/**
 * Растения долины. SPEC.md §6, §12.2. Растут за задания по веткам (logic/valley.ts, plantKindFor)
 * и из семян и саженцев (BALANCE.loot.seeds, BALANCE.shop.plants).
 */
export const PLANT_KINDS = [
  'oak', 'birch', 'willow', 'pine', 'flowers', 'bush', 'flax', 'hazel', 'rowan', 'apple', 'lilac', 'sunflower',
] as const;
export type PlantKind = (typeof PLANT_KINDS)[number];

/** Редкий декор из карты добычи (BALANCE.loot.rareDecor). */
export const DECOR_KINDS = ['fireflies', 'rainbow', 'deer'] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];

export const PLANT_SIZES = ['small', 'medium', 'large'] as const;
export type PlantSize = (typeof PLANT_SIZES)[number];

/** Растение в долине. Где оно — номер места в районе; как выглядит — вид, размер и сид. */
export interface ValleyPlant {
  id: string;
  kind: PlantKind;
  size: PlantSize;
  /** Номер места в районе (model/valley-district.ts). */
  slot: number;
  /** Сид разброса: высота, оттенок, форма кроны. Стабилен между запусками. */
  seed: number;
  /** Когда посажено. 0 — посажено при создании долины по уже накопленному опыту. */
  plantedAt: number;
  /** Ветка задания, за которое выросло; у растений из семян нет. */
  branch?: Branch;
}

/** Редкость в долине: светлячки, радуга, олень. Мест растений не занимает. */
export interface ValleyDecor {
  id: string;
  kind: DecorKind;
  /** Номер места редкости этого вида. */
  anchor: number;
  seed: number;
  plantedAt: number;
}

/** Вещи лагеря из лавки. У каждой — своё постоянное место у костра. */
export const CAMP_KINDS = ['tent', 'lantern', 'kettle'] as const;
export type CampKind = (typeof CAMP_KINDS)[number];

/**
 * Сооружение конечного босса в долине (docs/phase2-plan.md §5.2): на каком месте (logic/valley-district.ts,
 * LANDMARK_SITES) стоит сооружение какого босса. Вид, сид и туман — у самого босса.
 */
export interface ValleyLandmark {
  bossId: string;
  site: number;
}

export interface ValleyState {
  plants: ValleyPlant[];
  decor: ValleyDecor[];
  /** Купленные вещи лагеря; каждая — не больше одной. */
  camp: CampKind[];
  /** Сооружения боссов: под туманом и открытые победой. Места растений под ними заняты. */
  landmarks: ValleyLandmark[];
  /** Места бесконечных боссов: в работе и в архиве. Места растений под ними заняты. */
  gardens: ValleyGarden[];
}

/**
 * Место бесконечного босса в долине (docs/phase2-plan.md §5.3): на каком месте (logic/valley-district.ts,
 * GARDEN_SITES) растёт место какого босса. Вид, сид и число элементов — у самого босса.
 */
export interface ValleyGarden {
  bossId: string;
  site: number;
}

/**
 * Находка — строка, записанная после чтения сообществ (docs/phase2-plan.md §4.2): мероприятие, компания,
 * человек, роль, ресурс. Экрана в приложении нет — читать их будет документ «Находки» на Google Drive (§7).
 */
export interface Finding {
  id: string;
  createdAt: number;
  text: string;
}

/** Внешний приз — шаблон, который пользователь заводит сама. SPEC.md §9.5. */
export interface Prize {
  id: string;
  title: string;
  /** Цена в звёздах. */
  price: number;
  /** Значок (эмодзи) из короткого списка; необязателен. */
  icon?: string;
  createdAt: number;
}

/**
 * Купон — купленный приз. Название, цена и значок копируются из приза: удалить или поменять приз
 * можно, купленные купоны от этого не меняются. У «своего купона» приза нет.
 */
export interface Coupon {
  id: string;
  title: string;
  price: number;
  icon?: string;
  /** Из какого приза; нет — «свой купон». */
  prizeId?: string;
  boughtAt: number;
  /** «куплен» → «выдан» (отмечает пользователь). */
  status: 'bought' | 'given';
  givenAt?: number;
}

/** Внешние призы и купоны. */
export interface ShopState {
  prizes: Prize[];
  /** Свежие сверху. */
  coupons: Coupon[];
}

/**
 * Сооружения конечных боссов (docs/phase2-plan.md §5.2): мост, мельница, обсерватория, оранжерея, ротонда,
 * дом на дереве, акведук, пагода, каменный круг, водопад с радугой, причал с воздушным шаром.
 */
export const LANDMARK_KINDS = [
  'bridge', 'windmill', 'observatory', 'greenhouse', 'rotunda', 'treehouse',
  'aqueduct', 'pagoda', 'stones', 'waterfall', 'balloon',
] as const;
export type LandmarkKind = (typeof LANDMARK_KINDS)[number];

/** Места бесконечных боссов (docs/phase2-plan.md §5.3): пруд с рыбками, цветник, пасека, луг с бабочками. */
export const GARDEN_KINDS = ['pond', 'flowerbed', 'apiary', 'meadow'] as const;
export type GardenKind = (typeof GARDEN_KINDS)[number];

/** Подход к боссу: когда начат, сколько минут засчитано, необязательная заметка. */
export interface BossSession {
  startedAt: number;
  minutes: number;
  note?: string;
}

/**
 * Босс — большая задача вне доски (docs/phase2-plan.md §5). Работа над ним — подходы с секундомером.
 * finite — конечный: сооружение под туманом, победу объявляет пользователь.
 * endless — бесконечный: место в долине, которое наполняется с каждым подходом.
 */
export interface Boss {
  id: string;
  title: string;
  note?: string;
  /** Из какого шаблона заведён (шаблоны — шаг 9 фазы 2). */
  templateId?: string;
  kind: 'finite' | 'endless';
  branch: Branch;
  /** active — в работе; won — победа (конечный); released — отпущен (конечный); archived — в архиве (бесконечный). */
  status: 'active' | 'won' | 'released' | 'archived';
  /**
   * Что стоит в долине: у конечного — сооружение, у бесконечного — место. seed — разброс рисунка.
   * Где стоит сооружение или место — в долине (ValleyState.landmarks и ValleyState.gardens).
   */
  place: { landmark?: LandmarkKind; garden?: GardenKind; seed: number };
  /** Подходы по порядку. */
  sessions: BossSession[];
  /** Идущий секундомер. */
  stopwatch?: { startedAt: number };
  createdAt: number;
  /** Когда победа, отпущен или убран в архив. */
  endedAt?: number;
  /** Заметка при победе: например, разбор интервью. */
  victoryNote?: string;
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
