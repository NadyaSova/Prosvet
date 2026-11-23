// Героиня: титул, уровень и опыт, плащ из перьев, уровни пяти веток.
// Открывается нажатием на карточку героини на главном экране.

import type { Feather } from '../logic/pigeons';
import { cloakView } from '../logic/pigeons';
import { levelInfo, titleFor, totalXp } from '../logic/progression';
import { BALANCE } from '../config/balance';
import { BRANCHES, type PlayerState } from '../model/types';
import { CloakArt } from './cloak-art';
import { BackBar, BranchChip, Progress } from './common';

export function HeroScreen({ player, feathers }: { player: PlayerState; feathers: readonly Feather[] }) {
  const xp = totalXp(player.xp);
  const level = levelInfo(xp);
  const nextTitle = BALANCE.level.titles.find((t) => t.fromLevel > level.level);
  const cloak = cloakView(feathers.length);

  return (
    <main class="screen hero-screen">
      <BackBar title={titleFor(level.level)} />

      <section class="card hero-screen__portrait">
        <CloakArt class="hero-screen__art" feathers={feathers} stage={cloak.stage} />
        <div class="small">
          {cloak.title ? `Плащ: ${cloak.title}` : 'Плащ пока без титула'} · перьев: {cloak.feathers}
        </div>
        {cloak.next && (
          <div class="muted small">
            До титула «{cloak.next.title}» — ещё {cloak.next.feathers - cloak.feathers}
          </div>
        )}
      </section>

      <section class="card hero">
        <div class="hero__row">
          <div>
            <div class="hero__title">Уровень {level.level}</div>
            <div class="muted small">Опыта всего: {xp}</div>
          </div>
          <div class="wallet">
            <span class="wallet__item" title="Золото">
              <span class="wallet__gold" aria-hidden="true" /> {player.gold}
            </span>
            <span class="wallet__item" title="Звёзды">
              <span class="wallet__star" aria-hidden="true">★</span> {player.stars}
            </span>
          </div>
        </div>
        <Progress value={level.xpIntoLevel} max={level.xpForNext} />
        <div class="muted small">
          {level.xpIntoLevel} из {level.xpForNext} опыта до следующего уровня
        </div>
        {nextTitle && (
          <div class="muted small">
            Следующий титул — «{nextTitle.title}», на {nextTitle.fromLevel}-м уровне
          </div>
        )}
      </section>

      <section class="card branches">
        <h2>Ветки</h2>
        {BRANCHES.map((b) => {
          const info = levelInfo(player.xp[b]);
          return (
            <div class="branch-row" key={b}>
              <BranchChip branch={b} />
              <span class="small">ур. {info.level}</span>
              <Progress value={info.xpIntoLevel} max={info.xpForNext} />
            </div>
          );
        })}
      </section>
    </main>
  );
}
