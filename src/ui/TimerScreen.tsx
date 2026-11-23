// Экран идущего таймера. SPEC.md §7.3: одна пауза, «Закончила раньше», отмена без штрафа.

import type { RunningTask } from '../logic/game';
import { canPause, elapsedMs, remainingMs } from '../logic/timer';
import { BranchChip } from './common';
import { clockText } from './format';

interface Props {
  timer: RunningTask;
  now: number;
  phrase: string;
  onPause: () => void;
  onResume: () => void;
  onFinishEarly: () => void;
  onCancel: () => void;
}

const R = 88;
const CIRCLE = 2 * Math.PI * R;

export function TimerScreen({ timer, now, phrase, onPause, onResume, onFinishEarly, onCancel }: Props) {
  const paused = timer.pausedAt !== null;
  const done = elapsedMs(timer, now) / timer.durationMs;

  return (
    <main class="screen timer">
      <BranchChip branch={timer.branch} />
      <h1 class="timer__title">{timer.title}</h1>

      <div class={`timer__ring ${paused ? 'timer__ring--paused' : ''}`}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r={R} class="timer__track" />
          <circle
            cx="100"
            cy="100"
            r={R}
            class="timer__arc"
            stroke-dasharray={CIRCLE}
            stroke-dashoffset={CIRCLE * (1 - done)}
            transform="rotate(-90 100 100)"
          />
        </svg>
        <div class="timer__center">
          <div class="timer__clock">{clockText(remainingMs(timer, now))}</div>
          {paused && <div class="muted small">на паузе</div>}
        </div>
      </div>

      <p class="phrase">{phrase}</p>

      <div class="timer__buttons">
        {paused ? (
          <button type="button" class="button" onClick={onResume}>
            Продолжить
          </button>
        ) : (
          <button type="button" class="button" disabled={!canPause(timer, now)} onClick={onPause}>
            {timer.pausesUsed > 0 ? 'Пауза уже была' : 'Пауза'}
          </button>
        )}
        <button type="button" class="button button--secondary" onClick={onFinishEarly}>
          Закончила раньше
        </button>
        <button type="button" class="link-button" onClick={onCancel}>
          Отменить задание
        </button>
      </div>

      <p class="muted small timer__hint">
        Можно свернуть приложение или выключить экран — время считается. Пауза — одна на задание.
      </p>
    </main>
  );
}
