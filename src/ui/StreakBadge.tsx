// Серия в шапке главного экрана: огонёк и число дней, рядом полено с запасом.
// Нажатие показывает, до какого дня горит огонь, и правило окна в 3 дня.

import type { FireLevel, StreakView } from '../logic/streak';
import { BALANCE } from '../config/balance';
import { daysText, plural } from './format';

/** Огонёк: цвет и яркость — по костру в долине. */
export function FlameIcon({ fire, class: cls }: { fire: FireLevel; class?: string }) {
  return (
    <svg class={`flame flame--${fire} ${cls ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path
        class="flame__outer"
        d="M12 2.5c.6 3-1.2 4.6-2.9 6.4C7.4 10.7 6 12.6 6 15.2 6 18.6 8.7 21.5 12 21.5s6-2.9 6-6.3c0-2.4-1.1-4.2-2.3-5.6-.3 1.3-1 2.2-1.9 2.6.4-3.6-.8-6.6-1.8-8z"
      />
      <path class="flame__inner" d="M12 12.2c.3 1.5-.6 2.3-1.3 3.1-.5.6-.9 1.2-.9 2 0 1.3 1 2.3 2.2 2.3s2.2-1 2.2-2.3c0-1.7-1.1-3.4-2.2-5.1z" />
    </svg>
  );
}

function LogIcon() {
  return (
    <svg class="streak-badge__log" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="9" width="17" height="7" rx="3.5" fill="var(--color-log)" />
      <ellipse cx="19.5" cy="12.5" rx="2.2" ry="3.5" fill="#c99a6b" />
      <ellipse cx="19.5" cy="12.5" rx="1" ry="1.8" fill="none" stroke="var(--color-log)" stroke-width="0.8" />
    </svg>
  );
}

export function StreakBadge({ view, open, onToggle }: { view: StreakView; open: boolean; onToggle: () => void }) {
  const label =
    (view.value > 0 ? `Серия: ${daysText(view.value)}` : 'Серии пока нет') +
    (view.logs > 0 ? `, поленьев в запасе: ${view.logs}` : '');
  return (
    <button type="button" class="streak-badge" aria-label={label} aria-expanded={open} onClick={onToggle}>
      <FlameIcon fire={view.fire} class="streak-badge__flame" />
      <span class="streak-badge__value">{view.value}</span>
      {view.logs > 0 && (
        <>
          <LogIcon />
          <span class="streak-badge__logs">{view.logs}</span>
        </>
      )}
    </button>
  );
}

/** Подробности серии под шапкой — открываются нажатием на огонёк. */
export function StreakDetails({ view, fireText }: { view: StreakView; fireText: string }) {
  const free = BALANCE.streak.windowDays - 1;
  return (
    <section class="notice streak-details" role="status">
      <div>
        <p class="streak-details__value">{view.value > 0 ? `Серия: ${daysText(view.value)}` : 'Серии пока нет'}</p>
        <p>{fireText}</p>
        {view.logs > 0 && (
          <p class="muted small">
            {plural(view.logs, ['Полено', 'Полена', 'Поленьев'])} в запасе: {view.logs}. Полено сгорает само и продлевает огонь на день.
          </p>
        )}
        <p class="muted small">
          После задания можно пропустить {daysText(free)}: огонь погаснет, только если и {BALANCE.streak.windowDays}-й день пройдёт без дел.
        </p>
      </div>
    </section>
  );
}
