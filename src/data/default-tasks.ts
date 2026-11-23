// Стартовый набор заданий. SPEC.md §7.2. Пользователь сможет добавлять свои и скрывать эти.

import type { TaskTemplate } from '../model/types';

export const DEFAULT_TASKS: TaskTemplate[] = [
  // Летопись
  { id: 'chronicle-achievement', branch: 'chronicle', kind: 'instant', instant: 'journal', onBoard: true,
    title: 'Записать одно достижение за эту неделю' },
  { id: 'chronicle-fill-draft', branch: 'chronicle', kind: 'timed', minutes: 10, onBoard: true,
    title: 'Дополнить одну черновую запись журнала результатом и цифрами' },
  { id: 'chronicle-hard-task', branch: 'chronicle', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Вспомнить и записать одну сложную задачу за последний месяц' },
  { id: 'chronicle-history', branch: 'chronicle', kind: 'timed', minutes: 25, onBoard: true,
    title: 'Пройтись по истории задач и коммитов за месяц и выписать 3 кандидата в журнал' },

  // Облик
  { id: 'image-one-line', branch: 'image', kind: 'timed', minutes: 5, onBoard: true,
    title: 'Переписать одну строку резюме' },
  { id: 'image-keywords', branch: 'image', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Сравнить резюме с одной вакансией и выписать недостающие ключевые слова' },
  { id: 'image-journal-to-cv', branch: 'image', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Перенести одну запись журнала в формулировку для резюме' },
  { id: 'image-free-session', branch: 'image', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Работа над резюме (свободная сессия)' },
  { id: 'image-linkedin', branch: 'image', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Обновить один раздел профиля LinkedIn' },

  // Речь
  { id: 'speech-voice-memo', branch: 'speech', kind: 'timed', minutes: 5, onBoard: true,
    title: 'Наговорить на диктофон минуту о своём текущем проекте' },
  { id: 'speech-written-answer', branch: 'speech', kind: 'timed', minutes: 10, onBoard: true,
    title: 'Ответить письменно на один типовой вопрос собеседования' },
  { id: 'speech-about-me', branch: 'speech', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Отрепетировать вслух «расскажите о себе»' },
  { id: 'speech-tech-topic', branch: 'speech', kind: 'timed', minutes: 30, onBoard: true,
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
  { id: 'hunt-apply-session', branch: 'hunt', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Подготовить и отправить один отклик' },

  // Отчёты: не на доске, доступны всегда.
  { id: 'report-application', branch: 'hunt', kind: 'instant', instant: 'application', onBoard: false,
    title: 'Отправила отклик' },
  { id: 'report-rejection', branch: 'hunt', kind: 'instant', instant: 'rejection', onBoard: false,
    title: 'Получила отказ' },
  { id: 'report-interview', branch: 'hunt', kind: 'instant', instant: 'interview', onBoard: false,
    title: 'Пригласили на собеседование' },
];
