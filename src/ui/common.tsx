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

/**
 * Значок опыта — росток, цветом ветки, к которой идёт опыт (без ветки — зелёный).
 * Стоит рядом с числом вместо слова: «+30 [росток]». Для чтения с экрана — скрытое «опыта».
 */
export function XpIcon({ branch }: { branch?: TaskTemplate['branch'] }) {
  return (
    <>
      <svg class={`xp-icon ${branch ? `task--${branch}` : ''}`} viewBox="0 0 16 16" aria-hidden="true">
        {/* Рисунок заполняет квадрат 16×16 без полей: стебель и два залитых листа. */}
        <path d="M7.1 16 C7 13.2 7.2 10.8 7.9 8.6 L9.5 9 C8.9 11.1 8.7 13.4 8.9 16 Z" />
        <path d="M7.9 10.8 C3.6 11.8 0.2 9.6 0 4.6 C4.8 4.2 8 6.4 7.9 10.8 Z" />
        <path d="M8.6 9 C7.8 4.2 10.6 0.4 16 0 C16.2 5.6 13.6 9.4 8.6 9 Z" />
      </svg>
      <span class="visually-hidden">опыта</span>
    </>
  );
}

/** Значок золота — монета, как в кошельке. Для чтения с экрана — скрытое «золота». */
export function GoldIcon() {
  return (
    <>
      <span class="wallet__gold" aria-hidden="true" />
      <span class="visually-hidden">золота</span>
    </>
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
