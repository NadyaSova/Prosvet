// Экран награды: опыт, золото, карта добычи (переворачивается нажатием), уровни, вехи серии, фраза.

import { useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import type { CompletedTask } from '../logic/game';
import type { LootCard as Loot } from '../logic/loot';
import { titleFor } from '../logic/progression';
import { daysText, minutesText, plural } from './format';
import { BRANCH_NAMES, itemName } from './labels';

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

export function RewardScreen({ reward, onClose }: { reward: ShownReward; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const r = reward.report;
  const baseGold = r.gold - r.lootGold;
  const lootStars = r.loot?.kind === 'star' ? 1 : 0;
  const milestoneStars = r.streakMilestones.length * BALANCE.streak.starsPerMilestone;
  const levelStars = r.stars - lootStars - milestoneStars;

  let kicker = 'Засчитано';
  if (reward.whileAway) kicker = 'Время вышло, пока тебя не было. Засчитано';
  else if (!reward.full && reward.minutes !== undefined) {
    kicker = `Засчитано ${minutesText(reward.minutes)} из ${reward.plannedMinutes}`;
  }

  return (
    <main class="screen reward">
      <p class="reward__kicker">{kicker}</p>
      <h1 class="reward__title">{reward.title}</h1>

      <div class="reward__gains">
        <div>
          <b>+{r.xp}</b> опыта <span class="muted">· {BRANCH_NAMES[r.branch]}</span>
        </div>
        <div>
          <b>+{baseGold}</b> золота
        </div>
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
    </main>
  );
}
