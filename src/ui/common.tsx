// Мелкие общие элементы экранов.

import type { ComponentChildren } from 'preact';
import type { TaskTemplate } from '../model/types';
import { minutesText } from './format';
import { BRANCH_NAMES } from './labels';
import { goHome } from './router';

export function BackBar({ title }: { title: string }) {
  return (
    <header class="backbar">
      <button type="button" class="icon-button" aria-label="Назад" onClick={goHome}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <h1>{title}</h1>
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

export function TaskCard({ task, onStart, children }: { task: TaskTemplate; onStart: () => void; children?: ComponentChildren }) {
  return (
    <article class={`task task--${task.branch}`}>
      <div class="task__meta">
        <BranchChip branch={task.branch} />
        <span class="muted small">{task.kind === 'timed' ? minutesText(task.minutes) : 'сразу'}</span>
      </div>
      <div class="task__title">{task.title}</div>
      <div class="task__actions">
        <button type="button" class="button" onClick={onStart}>
          {task.kind === 'timed' ? 'Начать' : 'Записать'}
        </button>
        {children}
      </div>
    </article>
  );
}
