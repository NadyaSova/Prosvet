// Главный экран: героиня, костёр (серия), вопрос голубя, доска заданий, «Не хочу ничего», своё задание,
// вход в голубятню, ветки.
// Долина появится на шаге 6.

import { useState } from 'preact/hooks';
import type { GameState, StreakNews } from '../logic/game';
import { rerollAvailable } from '../logic/game';
import { levelInfo, titleFor, totalXp } from '../logic/progression';
import { viewStreak } from '../logic/streak';
import { dayOf } from '../logic/time';
import { BRANCHES, type Pigeon, type TaskTemplate } from '../model/types';
import { BranchChip, Progress, TaskCard } from './common';
import { Flame } from './Flame';
import { daysText, fireText, plural } from './format';
import { PigeonArt } from './pigeon-art';
import { go } from './router';

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

      <section class="card hero">
        <div class="hero__row">
          <div>
            <div class="hero__title">{titleFor(level.level)}</div>
            <div class="muted small">Уровень {level.level}</div>
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
      </section>

      <section class="card streak">
        <Flame level={streak.fire} />
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

      <button type="button" class="card loft-entry" onClick={() => go('loft')}>
        <span class="loft-entry__title">Голубятня</span>
        <span class="muted small">
          {pigeonsInFlight > 0 ? `В пути: ${pigeonsInFlight}` : 'Отправила отклик? Здесь ждут голуби'}
        </span>
      </button>

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
