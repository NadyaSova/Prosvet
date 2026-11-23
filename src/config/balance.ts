// Все числа баланса — здесь. Стартовые значения из SPEC.md §8–§9, подкручиваются на практике.
// Правила, которые решила пользователь (окно серии 3 дня, одна пауза и т. п.), помечены [РЕШЕНО].

export const BALANCE = {
  streak: {
    /** [РЕШЕНО] После активного дня D можно пропустить D+1 и D+2; D+3 — последний день, чтобы продлить серию. */
    windowDays: 3,
    /** Сколько поленьев можно держать в запасе. */
    maxLogs: 2,
    /** Вехи серии (в календарных днях с начала серии). Каждая даёт звёзды. */
    milestones: [7, 14, 30, 60, 100],
    starsPerMilestone: 1,
  },

  xp: {
    perTimedMinute: 1,
    instant: { application: 10, journal: 8 },
    /** Порог уровня n: levelStep × n опыта сверх предыдущего уровня. */
    levelStep: 50,
  },

  gold: {
    /** Полное таймерное задание: округление minutes × perTimedMinute. Досрочное — округление вниз. */
    perTimedMinute: 0.5,
    instant: { application: 5, journal: 4 },
  },

  level: {
    /** Звёзды за каждый новый общий уровень персонажа. */
    starsPerOverallLevel: 1,
    /** Титулы по общему уровню: с какого уровня действует. */
    titles: [
      { fromLevel: 1, title: 'Путница' },
      { fromLevel: 3, title: 'Следопытка' },
      { fromLevel: 6, title: 'Садовница' },
      { fromLevel: 10, title: 'Травница' },
      { fromLevel: 15, title: 'Хранительница долины' },
    ],
  },

  loot: {
    /** Веса карт добычи (в сумме 100 — проценты). */
    table: [
      { kind: 'phrase', weight: 45 },
      { kind: 'gold', weight: 25 },
      { kind: 'seed', weight: 14 },
      { kind: 'log', weight: 8 },
      { kind: 'star', weight: 6 },
      { kind: 'rare', weight: 2 },
    ],
    phraseGold: 5,
    goldCardGold: 15,
    /** Если поленьев уже максимум, выпавшее полено превращается в золото. */
    logOverflowGold: 10,
    /** Семена редких растений (декор в долину). Конкретный вид выбирается случайно. */
    seeds: ['rowan', 'apple', 'lilac', 'sunflower'],
    /** Особый декор. */
    rareDecor: ['fireflies', 'rainbow', 'deer'],
  },

  phrases: {
    /** Фраза не повторяется, пока не покажут столько других из того же пула (или весь пул, если он меньше). */
    noRepeatWindow: 10,
  },

  timer: {
    /** [РЕШЕНО] Одна пауза за задание. */
    maxPauses: 1,
    /** Досрочное завершение засчитывается, только если отработано хотя бы столько минут. */
    minPartialMinutes: 1,
  },

  board: {
    size: 3,
    /** Ветка, которую не трогали k дней, получает вес 1 + k × staleBoostPerDay (k не больше maxStaleDays). */
    staleBoostPerDay: 0.5,
    maxStaleDays: 6,
    /** Бесплатных перетягиваний доски в день. */
    freeRerollsPerDay: 1,
  },

  backup: {
    /** Напоминать о резервной копии, если её не делали столько дней. */
    reminderDays: 14,
  },
} as const;

export type LootKind = (typeof BALANCE.loot.table)[number]['kind'];
