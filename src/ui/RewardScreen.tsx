// Экран награды: опыт, золото, карта добычи (переворачивается нажатием), что выросло в долине, уровни, вехи серии, фраза.

import { useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import type { CompletedTask } from '../logic/game';
import type { LootCard as Loot } from '../logic/loot';
import { titleFor } from '../logic/progression';
import { CORRECTION_MAX, CORRECTION_MIN, nudgeMinutes } from '../logic/timer';
import { daysText, minutesText, plural } from './format';
import { BRANCH_NAMES, itemName, plantName } from './labels';

export interface ShownReward extends CompletedTask {
  /** Главная фраза экрана (finish или comeback). */
  phrase: string;
  /** Фраза на карте добычи, если выпала карта-фраза. */
  cardPhrase?: string;
  /** Фраза к вехе серии. */
  streakPhrase?: string;
}

function LootFace({ loot, converted, phrase }: { loot: Loot; converted: boolean; phrase?: string }) {
  switch (loot.kind) {
    case 'phrase':
      return (
        <>
          <p class="loot__phrase">{phrase}</p>
          <div class="loot__sub">+{loot.gold} золота</div>
        </>
      );
    case 'gold':
      return (
        <>
          <div class="loot__big">+{loot.gold}</div>
          <div class="loot__sub">золота</div>
        </>
      );
    case 'seed':
      return (
        <>
          <div class="loot__kind">Семя</div>
          <div class="loot__name">{itemName(loot.item)}</div>
          <div class="loot__sub">Посадишь его в долине</div>
        </>
      );
    case 'log':
      return converted ? (
        <>
          <div class="loot__kind">Полено</div>
          <div class="loot__sub">Запас дров полон — вместо полена {BALANCE.loot.logOverflowGold} золота</div>
        </>
      ) : (
        <>
          <div class="loot__kind">Полено</div>
          <div class="loot__sub">Сгорит само и спасёт серию, если пропустишь день</div>
        </>
      );
    case 'star':
      return (
        <>
          <div class="loot__big loot__star">★</div>
          <div class="loot__sub">Звезда — для внешних призов</div>
        </>
      );
    case 'rare':
      return (
        <>
          <div class="loot__kind">Редкость</div>
          <div class="loot__name">{itemName(loot.item)}</div>
          <div class="loot__sub">Украсит долину</div>
        </>
      );
  }
}

/** «Засчитано», «Засчитано 12 минут из 30», «Засчитано 45 минут» — и что время вышло без тебя. */
function kickerOf(reward: ShownReward): string {
  const { minutes, plannedMinutes } = reward;
  let text = 'Засчитано';
  if (minutes !== undefined && minutes !== plannedMinutes) {
    text += ` ${minutesText(minutes)}${minutes < (plannedMinutes ?? 0) ? ` из ${plannedMinutes}` : ''}`;
  }
  return reward.whileAway ? `Время вышло, пока тебя не было. ${text}` : text;
}

/** Правка времени (docs/phase2-plan.md §3): сколько засчитать, в обе стороны. */
function TimeCorrection({ reward, onCorrect }: { reward: ShownReward; onCorrect: (minutes: number) => void }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(reward.minutes ?? 0);
  const planned = reward.plannedMinutes ?? 0;

  if (!open) {
    return (
      <button
        type="button"
        class="link-button reward__fix"
        onClick={() => {
          setMinutes(reward.minutes ?? 0);
          setOpen(true);
        }}
      >
        Поправить время
      </button>
    );
  }
  return (
    <div class="card reward__correct">
      <span class="field__label">Сколько засчитать</span>
      <div class="stepper">
        <button
          type="button"
          class="icon-button"
          aria-label="Меньше"
          disabled={minutes <= CORRECTION_MIN}
          onClick={() => setMinutes(nudgeMinutes(minutes, -1))}
        >
          −
        </button>
        <span class="stepper__value" aria-live="polite">
          {minutesText(minutes)}
        </span>
        <button
          type="button"
          class="icon-button"
          aria-label="Больше"
          disabled={minutes >= CORRECTION_MAX}
          onClick={() => setMinutes(nudgeMinutes(minutes, 1))}
        >
          +
        </button>
      </div>
      <p class="muted small">
        Задание было на {minutesText(planned)}.{' '}
        {minutes >= planned ? 'Засчитается полностью, с картой добычи.' : 'Меньше — без карты добычи.'}
      </p>
      <div class="reward__correct-buttons">
        <button type="button" class="button button--secondary" onClick={() => setOpen(false)}>
          Отмена
        </button>
        <button
          type="button"
          class="button"
          disabled={minutes === reward.minutes}
          onClick={() => {
            onCorrect(minutes);
            setOpen(false);
          }}
        >
          Засчитать
        </button>
      </div>
    </div>
  );
}

interface Props {
  reward: ShownReward;
  onClose: () => void;
  onLoft?: () => void;
  /** Правка времени таймерного задания; нет — править нельзя. */
  onCorrect?: (minutes: number) => void;
}

export function RewardScreen({ reward, onClose, onLoft, onCorrect }: Props) {
  const [flipped, setFlipped] = useState(false);
  const r = reward.report;
  const baseGold = r.gold - r.lootGold;
  const lootStars = r.loot?.kind === 'star' ? 1 : 0;
  const milestoneStars = r.streakMilestones.length * BALANCE.streak.starsPerMilestone;
  const levelStars = r.stars - lootStars - milestoneStars - r.taskStars;

  return (
    <main class="screen reward">
      <p class="reward__kicker">{kickerOf(reward)}</p>
      <h1 class="reward__title">{reward.title}</h1>
      {onCorrect && reward.minutes !== undefined && <TimeCorrection reward={reward} onCorrect={onCorrect} />}

      <div class="reward__gains">
        <div>
          <b>+{r.xp}</b> опыта <span class="muted">· {BRANCH_NAMES[r.branch]}</span>
        </div>
        <div>
          <b>+{baseGold}</b> золота
        </div>
        {r.taskStars > 0 && (
          <div>
            <b>+{r.taskStars}</b> ★
          </div>
        )}
      </div>

      {r.loot ? (
        <button
          type="button"
          class={`loot ${flipped ? 'loot--flipped' : ''}`}
          onClick={() => setFlipped(true)}
          aria-label={flipped ? 'Карта добычи' : 'Перевернуть карту добычи'}
        >
          <div class="loot__inner">
            <div class="loot__face loot__back">
              <div class="loot__mark">✦</div>
              <div>Карта добычи</div>
              <div class="loot__sub">нажми, чтобы перевернуть</div>
            </div>
            <div class="loot__face loot__front">
              <LootFace loot={r.loot} converted={r.logConverted} phrase={reward.cardPhrase} />
            </div>
          </div>
        </button>
      ) : (
        <p class="muted small">Карта добычи — за полное время.</p>
      )}

      <ul class="reward__news">
        {reward.planted && <li>Новое в долине: {plantName(reward.planted)}</li>}
        {reward.districtOpened && <li>Туман ушёл из долины целиком. Долина открыта.</li>}
        {r.newLevel !== null && (
          <li>
            Новый уровень {r.newLevel} — {titleFor(r.newLevel)}
            {levelStars > 0 && <> · +{levelStars} ★</>}
          </li>
        )}
        {r.newBranchLevel !== null && (
          <li>
            {BRANCH_NAMES[r.branch]}: уровень {r.newBranchLevel}
          </li>
        )}
        {r.streakMilestones.map((m) => (
          <li key={m}>
            Серия {daysText(m)} · +{BALANCE.streak.starsPerMilestone} ★
            {reward.streakPhrase && <div class="muted small">{reward.streakPhrase}</div>}
          </li>
        ))}
        {r.logsBurned > 0 && (
          <li>
            {plural(r.logsBurned, ['Сгорело', 'Сгорели', 'Сгорели'])} {r.logsBurned}{' '}
            {plural(r.logsBurned, ['полено', 'полена', 'поленьев'])} — серия спасена.
          </li>
        )}
        {r.comeback && <li>Костёр снова горит.</li>}
      </ul>

      {reward.phrase !== reward.cardPhrase && <p class="phrase">{reward.phrase}</p>}

      <button type="button" class="button reward__next" onClick={onClose}>
        Дальше
      </button>
      {onLoft && (
        <button type="button" class="link-button" onClick={onLoft}>
          Отправила отклик? В голубятню
        </button>
      )}
    </main>
  );
}
