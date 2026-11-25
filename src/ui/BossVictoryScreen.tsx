// Победа над конечным боссом (docs/phase2-plan.md §5.2): туман рассеивается, сооружение проявляется целиком,
// крупный бонус со звездой. Это не задание: карты добычи и дня серии нет — работа засчитана подходами.

import type { VictoryReport } from '../logic/rewards';
import { titleFor } from '../logic/progression';
import type { Boss } from '../model/types';
import { BossArt } from './boss-art';
import { GoldIcon, XpIcon } from './common';
import { BRANCH_NAMES } from './labels';
import { LANDMARK_NAMES } from './valley/landmark-art';

export interface ShownVictory {
  boss: Boss;
  report: VictoryReport;
  phrase: string;
}

export function BossVictoryScreen({ victory, onClose }: { victory: ShownVictory; onClose: () => void }) {
  const { boss, report: r } = victory;
  return (
    <main class="screen reward victory">
      <p class="reward__kicker">Победа</p>
      <h1 class="reward__title">{boss.title}</h1>

      <div class="card victory__picture">
        <BossArt boss={boss} class="victory__art" reveal />
        {boss.place.landmark && <p class="victory__name">{LANDMARK_NAMES[boss.place.landmark]}</p>}
        <p class="muted small">Туман рассеялся. Сооружение останется в долине.</p>
      </div>

      <div class="reward__gains">
        <div>
          <b>+{r.xp}</b> <XpIcon branch={r.branch} />
        </div>
        <div>
          <b>+{r.gold}</b> <GoldIcon />
        </div>
        <div>
          <b>+{r.stars}</b> <span class="wallet__star">★</span>
        </div>
      </div>

      <ul class="reward__news">
        {r.newLevel !== null && (
          <li>
            Новый уровень {r.newLevel} — {titleFor(r.newLevel)}
          </li>
        )}
        {r.newBranchLevel !== null && (
          <li>
            {BRANCH_NAMES[r.branch]}: уровень {r.newBranchLevel}
          </li>
        )}
      </ul>

      {boss.victoryNote && <p class="boss__note boss__note--victory victory__note">{boss.victoryNote}</p>}

      <p class="phrase">{victory.phrase}</p>

      <button type="button" class="button reward__next" onClick={onClose}>
        Дальше
      </button>
    </main>
  );
}
