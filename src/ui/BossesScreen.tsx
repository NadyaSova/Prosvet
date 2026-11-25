// Раздел «Боссы» (docs/phase2-plan.md §5): большие задачи вне доски. Конечные — сооружения под туманом,
// бесконечные — места, которые наполняются. Внизу — архив: победы, отпущенные и свёрнутые.

import { daysSinceLast, stopwatchMs } from '../logic/bosses';
import type { Boss } from '../model/types';
import { BossArt } from './boss-art';
import { BackBar } from './common';
import { agoText, dateText, plural, stopwatchText } from './format';
import { BRANCH_NAMES } from './labels';
import { go } from './router';

/** Строка под названием: идёт подход, сколько подходов и когда последний. */
function statusText(boss: Boss, now: number): string {
  if (boss.stopwatch) return `идёт подход · ${stopwatchText(stopwatchMs(boss, now))}`;
  const n = boss.sessions.length;
  if (n === 0) return 'ещё не начинала';
  return `${n} ${plural(n, ['подход', 'подхода', 'подходов'])} · последний ${agoText(daysSinceLast(boss, now)!)}`;
}

/** Строка босса в архиве: чем закончился и когда. */
function endText(boss: Boss): string {
  const when = boss.endedAt ? ` ${dateText(boss.endedAt)}` : '';
  if (boss.status === 'won') return `победа${when}`;
  if (boss.status === 'released') return `отпущен${when}`;
  return boss.endedAt ? `в архиве с${when}` : 'в архиве';
}

function BossRow({ boss, line }: { boss: Boss; line: string }) {
  return (
    <button type="button" class={`boss-row task--${boss.branch}`} onClick={() => go(`boss/${encodeURIComponent(boss.id)}`)}>
      {boss.status !== 'released' ? <BossArt boss={boss} class="boss-row__art" still /> : <span class="boss-row__art boss-row__art--empty" />}
      <span class="boss-row__body">
        <span class="boss-row__title">{boss.title}</span>
        <span class="small">
          <span class="task__branch">{BRANCH_NAMES[boss.branch]}</span>
          <span class={boss.stopwatch ? 'boss-row__running' : 'muted'}> · {line}</span>
        </span>
      </span>
    </button>
  );
}

interface Props {
  bosses: readonly Boss[];
  now: number;
}

export function BossesScreen({ bosses, now }: Props) {
  const active = bosses.filter((b) => b.status === 'active');
  const finite = active.filter((b) => b.kind === 'finite');
  const endless = active.filter((b) => b.kind === 'endless');
  const ended = bosses.filter((b) => b.status !== 'active').sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));

  return (
    <main class="screen bosses">
      <BackBar
        title="Боссы"
        info="Босс — большое дело вне доски: интервью, тестовое, послужной список, новая тема. К нему подходят с секундомером, по одному подходу."
      />

      <button type="button" class="button" onClick={() => go('bosses/new')}>
        Новый босс
      </button>

      {finite.length > 0 && (
        <section class="bosses__group">
          <h2>Под туманом</h2>
          <p class="muted small bosses__hint">
            Каждый подход снимает слой тумана.
            <br />
            Конец битвы объявляет игрок.
          </p>
          {finite.map((b) => (
            <BossRow key={b.id} boss={b} line={statusText(b, now)} />
          ))}
        </section>
      )}

      {endless.length > 0 && (
        <section class="bosses__group">
          <h2>Места, которые растут</h2>
          <p class="muted small bosses__hint">
            Каждый подход добавляет месту жизни.
            <br />
            Финальной битвы здесь нет.
          </p>
          {endless.map((b) => (
            <BossRow key={b.id} boss={b} line={statusText(b, now)} />
          ))}
        </section>
      )}

      {ended.length > 0 && (
        <details class="card returned">
          <summary>
            <h2>Архив · {ended.length}</h2>
          </summary>
          <div class="bosses__archive">
            {ended.map((b) => (
              <BossRow key={b.id} boss={b} line={endText(b)} />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
