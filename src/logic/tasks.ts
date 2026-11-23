// Полный список заданий: стартовые (с учётом скрытых) и свои.

import type { TaskTemplate } from '../model/types';

export function mergeTemplates(
  defaults: readonly TaskTemplate[],
  custom: readonly TaskTemplate[],
  hiddenIds: readonly string[],
): TaskTemplate[] {
  const hidden = new Set(hiddenIds);
  const customIds = new Set(custom.map((t) => t.id));
  return [
    ...defaults.filter((t) => !customIds.has(t.id)).map((t) => (hidden.has(t.id) ? { ...t, hidden: true } : t)),
    ...custom,
  ];
}
