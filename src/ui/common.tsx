// Мелкие общие элементы экранов.

import type { ComponentChildren } from 'preact';
import type { TaskTemplate } from '../model/types';
import { minutesText } from './format';
import { BRANCH_NAMES } from './labels';
import { goHome } from './router';

/** Шапка экрана: «Назад», заголовок и, если есть, кнопки справа. */
export function BackBar({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <header class="backbar">
      <button type="button" class="icon-button" aria-label="Назад" onClick={goHome}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <h1>{title}</h1>
      {children && <div class="backbar__end">{children}</div>}
    </header>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div class="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div class="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function BranchChip({ branch }: { branch: TaskTemplate['branch'] }) {
  return <span class={`chip chip--${branch}`}>{BRANCH_NAMES[branch]}</span>;
}

/** Ветка и время задания: «Подготовка · 15 минут». */
export function TaskMeta({ task }: { task: TaskTemplate }) {
  return (
    <div class="task__meta small">
      <span class="task__branch">{BRANCH_NAMES[task.branch]}</span>
      <span class="muted"> · {task.kind === 'timed' ? minutesText(task.minutes) : 'сразу'}</span>
    </div>
  );
}

/**
 * Задание-записка на доске: название, ветка и время. Нажатие на записку снимает её с доски (onOpen).
 * Кнопка — название, растянутое на всю записку; children (например, «Другое») лежат поверх и нажимаются отдельно.
 */
export function TaskCard({ task, onOpen, children }: { task: TaskTemplate; onOpen: () => void; children?: ComponentChildren }) {
  return (
    <article class={`task task--${task.branch}`}>
      <button type="button" class="task__open" onClick={onOpen}>
        <span class="task__title">{task.title}</span>
      </button>
      <TaskMeta task={task} />
      {children}
    </article>
  );
}
