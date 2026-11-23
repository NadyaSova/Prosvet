// Голубь вернулся с пером: опыт, звёзды, порог плаща, фраза. Это не задание — серии и карты добычи здесь нет.

import { BALANCE } from '../config/balance';
import type { ReturnedFeather } from '../logic/game';
import { cloakView } from '../logic/pigeons';
import { titleFor } from '../logic/progression';
import { daysText, feathersText } from './format';
import { BRANCH_NAMES, FEATHER_NAMES } from './labels';
import { FeatherArt, PigeonArt } from './pigeon-art';

export interface ShownFeather extends ReturnedFeather {
  phrase: string;
}

export function FeatherScreen({ feather, onClose }: { feather: ShownFeather; onClose: () => void }) {
  const { pigeon, report: r, silent } = feather;
  const goldenStars = r.golden ? BALANCE.pigeons.goldenFeatherStars : 0;
  const thresholdStars = r.thresholds.length * BALANCE.cloak.starsPerThreshold;
  const levelStars = r.stars - goldenStars - thresholdStars;

  let kicker = 'Голубь вернулся';
  if (r.golden) kicker = 'Позвали дальше';
  else if (silent) kicker = `${daysText(BALANCE.pigeons.returnAfterDays)} без ответа — голубь вернулся сам`;

  return (
    <main class="screen reward feather">
      <p class="reward__kicker">{kicker}</p>
      <h1 class="reward__title">«{pigeon.company}»</h1>

      <div class={`feather__scene ${r.golden ? 'feather__scene--golden' : ''}`}>
        <PigeonArt class="feather__pigeon" look={pigeon.look} />
        <FeatherArt class="feather__feather" color={r.golden ? 'gold' : pigeon.look.color} size={pigeon.look.size} />
      </div>
      <p class="feather__name">{FEATHER_NAMES[r.golden ? 'gold' : pigeon.look.color]}</p>

      <div class="reward__gains">
        <div>
          <b>+{r.xp}</b> опыта <span class="muted">· {BRANCH_NAMES.hunt}</span>
        </div>
        {r.gold > 0 && (
          <div>
            <b>+{r.gold}</b> золота
          </div>
        )}
        {goldenStars > 0 && (
          <div>
            <b>+{goldenStars}</b> <span class="wallet__star">★</span>
          </div>
        )}
      </div>

      <ul class="reward__news">
        {r.thresholds.map((t) => {
          const title = cloakView(t).title;
          return (
            <li key={t}>
              В плаще {feathersText(t)} — титул «{title}»
              {' '}·{' '}+{BALANCE.cloak.starsPerThreshold}{' '}
              <span class="wallet__star">★</span>
            </li>
          );
        })}
        {r.newLevel !== null && (
          <li>
            Новый уровень {r.newLevel} — {titleFor(r.newLevel)}
            {levelStars > 0 && <> · +{levelStars} ★</>}
          </li>
        )}
        {r.newBranchLevel !== null && (
          <li>
            {BRANCH_NAMES.hunt}: уровень {r.newBranchLevel}
          </li>
        )}
      </ul>

      <p class="phrase">{feather.phrase}</p>

      <button type="button" class="button reward__next" onClick={onClose}>
        Вшить в плащ
      </button>
    </main>
  );
}
