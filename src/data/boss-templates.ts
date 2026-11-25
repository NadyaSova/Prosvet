// Шаблоны боссов (docs/phase2-plan.md §4.1, §4.2, §4.6): готовые названия, вид и ветка.
// Шаблон заполняет форму «Новый босс»; дальше босс — обычный, с отметкой templateId.

import type { Boss, Branch } from '../model/types';

export interface BossTemplate {
  id: string;
  /** Название босса. У шаблона с полем company — подпись в списке, а название собирает bossTitle. */
  title: string;
  kind: Boss['kind'];
  branch: Branch;
  /** Строка под названием в списке шаблонов и пояснение на форме. */
  hint: string;
  /** Подсказка в поле заметки. */
  notePlaceholder?: string;
  /** Название собирается из компании: «Интервью в «Ромашке»». */
  company?: { label: string; title: (company: string) => string };
  /**
   * Разовое дело: пока босс из этого шаблона в работе или побеждён, шаблон показывает его, а не заводит нового.
   * Без отметки — повторяется (интервью, тестовое): пока один в работе, можно завести другой.
   */
  once?: boolean;
  /** Подсказка в записке победы. */
  victoryHint?: string;
}

export const BOSS_TEMPLATES: readonly BossTemplate[] = [
  // Летопись (§4.1). Сам послужной список — вне приложения, босс считает только подходы.
  {
    id: 'chronicle-record',
    title: 'Послужной список',
    kind: 'finite',
    branch: 'chronicle',
    hint: 'Все места работы: компания, период, должность, стек, проекты, обязанности. База для резюме.',
    notePlaceholder: 'Где ведёшь список, с какого места начать',
    once: true,
  },
  {
    id: 'chronicle-linkedin',
    title: 'Профиль в LinkedIn',
    kind: 'finite',
    branch: 'chronicle',
    hint: 'Сделать один раз и забыть. Удобнее после послужного списка.',
    once: true,
  },

  // Разведка (§4.2): темы, к которым возвращаешься.
  { id: 'scouting-roles', title: 'Соседние роли', kind: 'endless', branch: 'scouting', hint: 'Какие роли близки к моему опыту, что они требуют, подхожу ли.', once: true },
  { id: 'scouting-industries', title: 'Отрасли', kind: 'endless', branch: 'scouting', hint: 'Где ещё ценен мой опыт.', once: true },
  {
    id: 'scouting-formats',
    title: 'Форматы работы',
    kind: 'endless',
    branch: 'scouting',
    hint: 'Найм, контракт, несколько клиентов, частичная занятость, удалённо на зарубежную компанию.',
    once: true,
  },
  { id: 'scouting-money', title: 'Деньги', kind: 'endless', branch: 'scouting', hint: 'Вилки по ролям, на которые могу претендовать.', once: true },
  { id: 'scouting-nearby', title: 'Карта поблизости', kind: 'endless', branch: 'scouting', hint: 'Компании в разумной досягаемости — если формат гибридный.', once: true },
  {
    id: 'scouting-pattern',
    title: 'Узор требований',
    kind: 'endless',
    branch: 'scouting',
    hint: 'Взять 10–15 вакансий интересной роли и выписать, что повторяется.',
    notePlaceholder: 'Какая роль',
    once: true,
  },

  // Подготовка (§4.6): событийные, заводятся, когда позвали.
  {
    id: 'prep-interview',
    title: 'Интервью в компании',
    kind: 'finite',
    branch: 'prep',
    hint: 'Когда позвали. Подходы — изучить продукт, подобрать истории, вопросы к ним. Победа — само интервью, как бы оно ни прошло.',
    notePlaceholder: 'Когда, с кем, что за продукт',
    company: { label: 'Какая компания', title: (c) => `Интервью в компании «${c}»` },
    victoryHint: 'Можно записать разбор: что спрашивали, что подтянуть.',
  },
  {
    id: 'prep-test',
    title: 'Тестовое задание',
    kind: 'finite',
    branch: 'prep',
    hint: 'Обычный конечный босс: подходы, пока не сдашь.',
    notePlaceholder: 'Что сделать и к какому сроку',
    company: { label: 'Для какой компании', title: (c) => `Тестовое для «${c}»` },
  },
];

/** Своя тема Разведки (§4.2, «Свой»): бесконечный босс Разведки со своим названием. */
export const OWN_SCOUTING: BossTemplate = {
  id: 'scouting-own',
  title: 'Своя тема',
  kind: 'endless',
  branch: 'scouting',
  hint: 'Тема, к которой хочется возвращаться.',
};

export function findBossTemplate(id: string | undefined): BossTemplate | undefined {
  if (!id) return undefined;
  return id === OWN_SCOUTING.id ? OWN_SCOUTING : BOSS_TEMPLATES.find((t) => t.id === id);
}
