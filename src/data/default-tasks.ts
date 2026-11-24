// Стартовый набор заданий — от реального процесса поиска работы, docs/phase2-plan.md §4.
// Заменил стартовый пул фазы 1 (SPEC.md §7.2). Пользователь может добавлять свои задания и скрывать эти.
// Метка journal — на экране таймера есть кнопка «Открыть Летопись»; drafts — Летопись открывается на черновиках.
// Id заданий, которые остались по смыслу прежними, не менялись: по ним хранятся скрытые задания и доска
// (поэтому у Подготовки id начинаются с speech-, а у отклика — с hunt-).
// Вопросы при остановке («Отправила?», находка, итог разбора) — шаг 4 фазы 2, здесь их нет.

import type { TaskTemplate } from '../model/types';

export const DEFAULT_TASKS: TaskTemplate[] = [
  // Летопись — §4.1
  { id: 'chronicle-achievement', branch: 'chronicle', kind: 'instant', instant: 'journal', onBoard: true,
    title: 'Быстрая запись в Летопись: одной строкой, что сделала' },
  { id: 'chronicle-question', branch: 'chronicle', kind: 'timed', minutes: 5, onBoard: true, tags: ['journal'],
    title: 'Вопрос дня: что сегодня или на этой неделе было нестандартного? «Ничего» — тоже ответ' },
  { id: 'chronicle-fill-draft', branch: 'chronicle', kind: 'timed', minutes: 10, onBoard: true, tags: ['journal', 'drafts'],
    title: 'Дооформить запись Летописи: контекст, как сделала, результат, навыки — и по возможности цифра' },
  { id: 'chronicle-history', branch: 'chronicle', kind: 'timed', minutes: 20, onBoard: true, tags: ['journal'],
    title: 'Раскопки: пройти по задачам, коммитам или переписке за период или проект и выписать достижения' },

  // Разведка — §4.2
  { id: 'scouting-communities', branch: 'scouting', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Почитать сообщества: группы, каналы, ленту LinkedIn' },

  // Охота — §4.3
  { id: 'hunt-browse', branch: 'hunt', kind: 'timed', minutes: 20, onBoard: true,
    title: 'Поиск вакансий: пройти один источник и разложить на «интересно» и «мимо»' },
  { id: 'hunt-review', branch: 'hunt', kind: 'timed', minutes: 15, onBoard: true,
    title: 'Разобрать одну вакансию: требования, офис и дорога, язык, занятость, вилка, свежесть, кто разместил. Откликаться, нет или подумать?' },

  // Зов — §4.4. Отметка отправленного отклика и ответов на него — в голубятне (ui/LoftScreen.tsx).
  { id: 'hunt-apply-session', branch: 'call', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Отклик: резюме под вакансию через Claude, сопроводительное письмо, отправить' },

  // Нити — §4.5. Награда «Написать» — ×1,5 (BALANCE.tasks.rewardFactor).
  { id: 'threads-write', branch: 'threads', kind: 'timed', minutes: 20, onBoard: true,
    title: 'Написать: знакомому, в сообщество или комментарий под постом' },
  // Мероприятие на доску не попадает: отмечается в любой день на экране «Своё задание», «Уже сделала».
  { id: 'threads-event', branch: 'threads', kind: 'instant', instant: 'event', onBoard: false,
    title: 'Сходила на мероприятие' },

  // Подготовка — §4.6
  { id: 'speech-about-me', branch: 'prep', kind: 'timed', minutes: 20, onBoard: true, tags: ['journal'],
    title: 'Рассказ о себе вслух — или одна история из Летописи. Можно с Claude в роли интервьюера' },
  { id: 'speech-tech-topic', branch: 'prep', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Техническая подготовка: алгоритмы, проектирование систем или свой стек' },

  // Ремесло — §4.7
  { id: 'craft-study', branch: 'craft', kind: 'timed', minutes: 30, onBoard: true,
    title: 'Учёба: закрыть пробел, найденный по вакансиям' },
];
