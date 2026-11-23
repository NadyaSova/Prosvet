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

/** Задание одной строкой: название, ветка и время, справа кнопка ▶. В children — например, «Другое». */
export function TaskCard({ task, onStart, children }: { task: TaskTemplate; onStart: () => void; children?: ComponentChildren }) {
  const action = task.kind === 'timed' ? 'Начать' : 'Записать';
  return (
    <article class={`task task--${task.branch}`}>
      <div class="task__body">
        <div class="task__title">{task.title}</div>
        <div class="task__meta small">
          <span class="task__branch">{BRANCH_NAMES[task.branch]}</span>
          <span class="muted"> · {task.kind === 'timed' ? minutesText(task.minutes) : 'сразу'}</span>
        </div>
        {children}
      </div>
      <button type="button" class="play-button" aria-label={`${action}: ${task.title}`} onClick={onStart}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.5 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L10 4.74a1 1 0 0 0-1.5.86z" fill="currentColor" />
        </svg>
      </button>
    </article>
  );
}
