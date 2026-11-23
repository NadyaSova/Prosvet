// Главный экран: долина с костром и странницей, семена для посадки, героиня, серия, вопрос голубя,
// доска заданий, «Не хочу ничего», своё задание, разделы: Летопись, голубятня, лавка.
// Нажатие на карточку героини открывает экран героини с ветками.

import { useState } from 'preact/hooks';
import type { GameState, StreakNews } from '../logic/game';
import type { Feather } from '../logic/pigeons';
import { rerollAvailable } from '../logic/game';
import { levelInfo, titleFor, totalXp } from '../logic/progression';
import { viewStreak } from '../logic/streak';
import { dayOf } from '../logic/time';
import { isDistrictOpen } from '../logic/valley';
import type { Pigeon, TaskTemplate } from '../model/types';
import { Progress, TaskCard } from './common';
import { daysText, fireText, plural } from './format';
import { PigeonArt } from './pigeon-art';
import { go } from './router';
import { SectionTiles } from './SectionTiles';
import { PlantRow } from './valley/PlantRow';
import { ValleyView } from './valley/ValleyView';

interface Props {
  game: GameState;
  templates: readonly TaskTemplate[];
  now: number;
  idlePhrase: string;
  news: StreakNews | null;
  onDismissNews: () => void;
  onStart: (t: TaskTemplate) => void;
  onReroll: () => void;
  pickTiny: (skip?: string) => TaskTemplate | undefined;
  pigeonsInFlight: number;
  /** Голубь, который сегодня спрашивает «Компания ответила?». */
  question: { pigeon: Pigeon; day: number } | null;
  onNotYet: (id: string) => void;
  onAnswer: (id: string, outcome: 'rejected' | 'invited') => void;
  /** Перья плаща — для странницы у костра. */
  feathers: readonly Feather[];
  cloakStage: number;
  /** Только что выросшее в долине — для анимации. */
  fresh: string | null;
  onPlant: (item: string) => void;
  /** Сколько купонов куплено и ещё не выдано. */
  coupons: number;
}

function newsText(news: StreakNews): string {
  if (news.broken) return 'Костёр погас, пока тебя не было. Это ничего: любое задание разожжёт его снова.';
  const n = news.logsBurned;
  return `Пока тебя не было, ${plural(n, ['сгорело', 'сгорели', 'сгорели'])} ${n} ${plural(n, ['полено', 'полена', 'поленьев'])}. Серия сохранена.`;
}

export function MainScreen({
  game,
  templates,
  now,
  idlePhrase,
  news,
  onDismissNews,
  onStart,
  onReroll,
  pickTiny,
  pigeonsInFlight,
  question,
  onNotYet,
  onAnswer,
  feathers,
  cloakStage,
  fresh,
  onPlant,
  coupons,
}: Props) {
  const [tiny, setTiny] = useState<TaskTemplate | null>(null);
  const { player } = game;
  const today = dayOf(now);
  const level = levelInfo(totalXp(player.xp));
  const streak = viewStreak(player.streak, today);
  const byId = new Map(templates.map((t) => [t.id, t]));
  const board = game.board.taskIds.map((id) => byId.get(id)).filter((t) => t !== undefined);
  const canReroll = rerollAvailable(game.board, now);

  return (
    <main class="screen home">
      <header class="home__top">
        <span class="home__name">Просвет</span>
        <button type="button" class="icon-button" aria-label="Настройки" onClick={() => go('settings')}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7h16M4 17h16" />
            <circle cx="9" cy="7" r="2.4" fill="var(--color-card-strong)" />
            <circle cx="15" cy="17" r="2.4" fill="var(--color-card-strong)" />
          </svg>
        </button>
      </header>

      <section class="valley-card">
        <div class="valley-card__frame">
          <ValleyView valley={game.valley} fire={streak.fire} feathers={feathers} cloakStage={cloakStage} fresh={fresh} />
          <button
            type="button"
            class="icon-button valley-card__expand"
            aria-label="Открыть долину крупно"
            onClick={() => go('valley')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
            </svg>
          </button>
        </div>
        <PlantRow
          valley={game.valley}
          inventory={player.inventory}
          onPlant={onPlant}
          onChoose={(item) => go(`valley/plant/${encodeURIComponent(item)}`)}
        />
        {isDistrictOpen(game.valley) && <p class="muted small valley-card__open">Долина открыта: хмари больше нет.</p>}
      </section>

      <button type="button" class="card hero hero--link" onClick={() => go('hero')}>
        <span class="hero__row">
          <span>
            <span class="hero__title">{titleFor(level.level)}</span>
            <span class="muted small">Уровень {level.level}</span>
          </span>
          <span class="wallet">
            <span class="wallet__item" title="Золото">
              <span class="wallet__gold" aria-hidden="true" /> {player.gold}
            </span>
            <span class="wallet__item" title="Звёзды">
              <span class="wallet__star" aria-hidden="true">★</span> {player.stars}
            </span>
            <svg class="hero__chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </span>
        <Progress value={level.xpIntoLevel} max={level.xpForNext} />
        <span class="muted small">
          {level.xpIntoLevel} из {level.xpForNext} опыта до следующего уровня
        </span>
      </button>

      <section class="card streak">
        <div>
          <div class="streak__value">{streak.value > 0 ? `Серия: ${daysText(streak.value)}` : 'Серии пока нет'}</div>
          <div class="small">{fireText(streak, today, player.streak.lastActiveDay !== null)}</div>
          {streak.logs > 0 && <div class="muted small">Поленья в запасе: {streak.logs}</div>}
        </div>
      </section>

      {news && (
        <div class="notice" role="status">
          <p>{newsText(news)}</p>
          <button type="button" class="link-button" onClick={onDismissNews}>
            Хорошо
          </button>
        </div>
      )}

      {question && (
        <section class="notice question" role="status">
          <PigeonArt class="question__art" look={question.pigeon.look} />
          <div class="question__body">
            <p>
              Голубь в пути {daysText(question.day)}. Компания «{question.pigeon.company}» ответила?
            </p>
            <div class="choices">
              <button type="button" class="choice" onClick={() => onNotYet(question.pigeon.id)}>
                Ещё нет
              </button>
              <button type="button" class="choice" onClick={() => onAnswer(question.pigeon.id, 'invited')}>
                Позвали дальше
              </button>
              <button type="button" class="choice" onClick={() => onAnswer(question.pigeon.id, 'rejected')}>
                Отказали
              </button>
            </div>
          </div>
        </section>
      )}

      <p class="phrase">{idlePhrase}</p>

      <section class="board">
        <div class="board__head">
          <h2>Доска заданий</h2>
          <button type="button" class="link-button" disabled={!canReroll || board.length === 0} onClick={onReroll}>
            {canReroll ? 'Сменить задания' : 'Сменить можно завтра'}
          </button>
        </div>
        {board.length === 0 && <p class="muted">Все задания скрыты. Включи хотя бы несколько в настройках.</p>}
        {board.map((t) => (
          <TaskCard key={t.id} task={t} onStart={() => onStart(t)} />
        ))}
      </section>

      <section class="home__more">
        {tiny ? (
          <div class="tiny">
            <div class="tiny__label">Совсем немного — и уже засчитано:</div>
            <TaskCard task={tiny} onStart={() => onStart(tiny)}>
              <button type="button" class="link-button" onClick={() => setTiny(pickTiny(tiny.id) ?? null)}>
                Другое
              </button>
            </TaskCard>
          </div>
        ) : (
          <button type="button" class="button button--secondary" onClick={() => setTiny(pickTiny() ?? null)}>
            Не хочу ничего
          </button>
        )}
        <button type="button" class="button button--secondary" onClick={() => go('custom')}>
          Своё задание
        </button>
      </section>

      <SectionTiles pigeonsInFlight={pigeonsInFlight} coupons={coupons} />
    </main>
  );
}
