// Стартовый набор заданий. SPEC.md §7.2. Пользователь сможет добавлять свои и скрывать эти.
// Метка journal — на экране таймера есть кнопка «Открыть Летопись»; drafts — Летопись открывается на черновиках.
// Ветки — уже семь (docs/phase2-plan.md §4.9); сам набор заменит шаг 2 фазы 2. Пока задания Облика — в Летописи,
// задания Речи — в Подготовке, отклик — в Зове. Id прежние: по ним хранятся скрытые задания и доска.

import type { TaskTemplate } from '../model/types';

export const DEFAULT_TASKS: TaskTemplate[] = [
  // Летопись
  { id: 'chronicle-achievement', branch: 'chronicle', kind: 'instant', instant: 'journal', onBoard: true,
    title: 'Записать одно достижение за эту неделю' },
  { id: 'chronicle-fill-draft', branch: 'chronicle', kind: 'timed', minutes: 10, onBoard: true, tags: ['journal', 'drafts'],
    title: 'Дополнить одну черновую запись журнала результатом и цифрами' },
  { id: 'chronicle-hard-task', branch: 'chronicle', kind: 'timed', minutes: 15, onBoard: true, tags: ['journal'],
    title: 'Вспомнить и записать одну сложную задачу за последний месяц' },
  { id: 'chronicle-history', branch: 'chronicle', kind: 'timed', minutes: 25, onBoard: true, tags: ['journal'],
    title: 'Пройтись по истории задач и коммитов за месяц и выписать 3 кандидата в журнал' },

  // Бывший Облик — теперь Летопись
  { id: 'image-one-line', branch: 'chronicle', kind: 'timed', minutes: 5, onBoard: true,
    title: 'Переписать одну строку резюме' },
  { id: 'image-keywords', branch: 'chronicle', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Сравнить резюме с одной вакансией и выписать недостающие ключевые слова' },
  { id: 'image-journal-to-cv', branch: 'chronicle', kind: 'timed', minutes: 15, onBoard: true, tags: ['journal'],
    title: 'Перенести одну запись журнала в формулировку для резюме' },
  { id: 'image-free-session', branch: 'chronicle', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Работа над резюме (свободная сессия)' },
  { id: 'image-linkedin', branch: 'chronicle', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Обновить один раздел профиля LinkedIn' },

  // Подготовка (бывшая Речь)
  { id: 'speech-voice-memo', branch: 'prep', kind: 'timed', minutes: 5, onBoard: true,
    title: 'Наговорить на диктофон минуту о своём текущем проекте' },
  { id: 'speech-written-answer', branch: 'prep', kind: 'timed', minutes: 10, onBoard: true,
    title: 'Ответить письменно на один типовой вопрос собеседования' },
  { id: 'speech-about-me', branch: 'prep', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Отрепетировать вслух «расскажите о себе»' },
  { id: 'speech-tech-topic', branch: 'prep', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Разобрать одну тему для технического собеседования' },

  // Разведка
  { id: 'scouting-three-posts', branch: 'scouting', kind: 'timed', minutes: 5, onBoard: true,
    title: 'Прочитать 3 поста в профильном сообществе' },
  { id: 'scouting-new-community', branch: 'scouting', kind: 'timed', minutes: 10, onBoard: true,
    title: 'Найти одно новое сообщество, канал или группу по теме' },
  { id: 'scouting-company', branch: 'scouting', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Изучить одну интересную компанию' },
  { id: 'scouting-article', branch: 'scouting', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Прочитать одну статью о поиске работы или о рынке' },

  // Охота
  { id: 'hunt-save-vacancy', branch: 'hunt', kind: 'timed', minutes: 5, onBoard: true,
    title: 'Сохранить одну интересную вакансию' },
  { id: 'hunt-browse', branch: 'hunt', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Просмотреть свежие вакансии в одном источнике' },

  // Зов
  { id: 'hunt-apply-session', branch: 'call', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Подготовить и отправить один отклик' },
  // Отметка отправленного отклика и ответов на него — в голубятне (ui/LoftScreen.tsx), не здесь.
];
