// Подход к боссу — секундомер (docs/phase2-plan.md §5.1): длительность заранее не задаётся, паузы нет,
// время считается по метке старта и переживает закрытие приложения. Виден прошлый подход и его заметка (§5.3).
// «Закончить подход» — экран награды, там можно поправить время и записать заметку.

import { daysSinceLast, lastSession, stopwatchMs } from '../logic/bosses';
import type { Boss } from '../model/types';
import { BossArt } from './boss-art';
import { BranchChip } from './common';
import { agoText, durationText, stopwatchText } from './format';
import { goHome } from './router';

interface Props {
  boss: Boss;
  now: number;
  phrase: string;
  onFinish: () => void;
  onCancel: () => void;
  /** Босс Летописи: открыть Летопись, не останавливая секундомер. */
  onJournal?: () => void;
  /** Секундомер открыт с экрана босса (а не на главном): стрелка «Назад». */
  back?: boolean;
}

export function StopwatchScreen({ boss, now, phrase, onFinish, onCancel, onJournal, back = false }: Props) {
  const last = lastSession(boss);
  return (
    <main class={`screen timer stopwatch task--${boss.branch}`}>
      {back && (
        <button type="button" class="icon-button stopwatch__back" aria-label="Назад" onClick={goHome}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      )}
      <p class="stopwatch__kicker small">Подход к боссу</p>
      <BranchChip branch={boss.branch} />
      <h1 class="timer__title">{boss.title}</h1>

      <BossArt boss={boss} class="stopwatch__art" />

      <div class="timer__clock stopwatch__clock" role="timer">
        {stopwatchText(stopwatchMs(boss, now))}
      </div>

      {last && (
        <p class="small stopwatch__last">
          В прошлый раз — {agoText(daysSinceLast(boss, now)!)}, {durationText(last.minutes)}
          {last.note && <span class="stopwatch__last-note">«{last.note}»</span>}
        </p>
      )}

      <p class="phrase">{phrase}</p>

      <div class="timer__buttons">
        {onJournal && (
          <button type="button" class="button button--secondary" onClick={onJournal}>
            Открыть Летопись
          </button>
        )}
        <button type="button" class="button" onClick={onFinish}>
          Закончить подход
        </button>
        <button type="button" class="link-button" onClick={onCancel}>
          Отменить подход
        </button>
      </div>

      <p class="muted small timer__hint">
        Можно свернуть приложение или выключить экран — время считается. Паузы нет: в конце время можно поправить.
      </p>
    </main>
  );
}
