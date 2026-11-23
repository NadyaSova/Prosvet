// Полный список заданий: стартовые и свои; скрытые помечены.

import type { TaskTemplate } from '../model/types';

export function mergeTemplates(
  defaults: readonly TaskTemplate[],
  custom: readonly TaskTemplate[],
  hiddenIds: readonly string[],
): TaskTemplate[] {
  const hidden = new Set(hiddenIds);
  const customIds = new Set(custom.map((t) => t.id));
  return [...defaults.filter((t) => !customIds.has(t.id)), ...custom].map((t) =>
    hidden.has(t.id) ? { ...t, hidden: true } : t,
  );
}
