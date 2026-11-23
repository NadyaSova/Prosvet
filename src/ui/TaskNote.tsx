// Записка, снятая с доски (#/note/<id>): крупно посреди экрана, поверх главного.
// На ней ветка и время, название и что вырастет в долине; «Начать» (или «Записать») и «Вернуть на доску».
// Системная кнопка «Назад» и нажатие мимо записки тоже возвращают её на доску.

import { useEffect } from 'preact/hooks';
import type { Completion } from '../logic/rewards';
import { isDistrictOpen, plantKindFor, plantSize } from '../logic/valley';
import type { PlantSize, TaskTemplate, ValleyState } from '../model/types';
import { TaskMeta } from './common';
import { plantName } from './labels';
import { goHome, goHomeThen } from './router';
import { PlantArt } from './valley/plant-art';

/** Постоянный сид: у одного задания всегда одна и та же картинка. */
function seedOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

/** Рамка рисунка: растение стоит в точке (0, 0) и растёт вверх. Цветы и кусты ниже деревьев. */
function plantView(low: boolean, size: PlantSize): string {
  const h = { small: 16, medium: 29, large: 42 }[size];
  return low ? `${-h * 0.7} ${-h * 0.8} ${h * 1.4} ${h * 0.9}` : `${-h * 0.6} ${-h * 1.12} ${h * 1.2} ${h * 1.2}`;
}

export function TaskNote({ task, valley, onStart }: { task: TaskTemplate; valley: ValleyState; onStart: (t: TaskTemplate) => void }) {
  // Пока записка открыта, страница под ней не листается.
  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);

  const completion: Completion =
    task.kind === 'timed'
      ? { kind: 'timed', branch: task.branch, minutes: task.minutes, full: true }
      : { kind: 'instant', branch: task.branch, instant: task.instant };
  const size = plantSize(completion);
  const kind = plantKindFor(task.branch, size);
  const grows = !isDistrictOpen(valley);

  return (
    <div class="note-layer" onClick={goHome}>
      <div
        class={`note task--${task.branch}`}
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        onClick={(e) => e.stopPropagation()}
      >
        <TaskMeta task={task} />
        <h2 class="note__title">{task.title}</h2>
        {grows && (
          <div class="note__grow">
            <span class="note__window">
              <svg class="note__plant" viewBox={plantView(kind === 'flowers' || kind === 'bush', size)} aria-hidden="true">
                <PlantArt kind={kind} size={size} seed={seedOf(task.id)} />
              </svg>
            </span>
            <span class="muted small">Вырастет в долине: {plantName({ kind, size })}</span>
          </div>
        )}
        <button type="button" class="button note__start" onClick={() => goHomeThen(() => onStart(task))}>
          {task.kind === 'timed' ? 'Начать' : 'Записать'}
        </button>
        <button type="button" class="link-button" onClick={goHome}>
          Вернуть на доску
        </button>
      </div>
    </div>
  );
}
