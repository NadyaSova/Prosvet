// Вопросы при остановке таймера (docs/phase2-plan.md §4): «Отправила?», находка, «нашлась подходящая?»,
// итог разбора вакансии. Ответ даёт бонус сверх награды за время; без ответа награда за время остаётся.

import { BALANCE } from '../config/balance';
import type { StopAnswer, StopQuestion } from '../model/types';

export interface StopBonus {
  xp: number;
  gold: number;
}

/** Находка: пробелы по краям убраны, длина ограничена. Пустая строка — находки нет. */
export function cleanFinding(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, BALANCE.tasks.findingMaxLength).trim();
}

/**
 * Бонус за ответ. null — ответа нет, он не к вопросу этого задания или бонуса за него нет
 * («пока нет», «подумать», пустая находка).
 */
export function stopBonus(question: StopQuestion | undefined, answer: StopAnswer | undefined): StopBonus | null {
  if (!answer || answer.ask !== question) return null;
  const b = BALANCE.tasks.stopBonus;
  switch (answer.ask) {
    case 'sent':
      return answer.yes ? b.sent : null;
    case 'found':
      return answer.yes ? b.found : null;
    case 'finding':
      return cleanFinding(answer.text) ? b.finding : null;
    case 'verdict':
      return answer.verdict === 'think' ? null : b.verdict;
  }
}
