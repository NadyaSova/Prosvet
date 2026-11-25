// Главный экран сверху вниз: шапка с огоньком серии, долина с костром и странницей, семена для посадки,
// фраза, заметки (костёр, вопрос голубя), героиня, разделы (Летопись, голубятня, лавка),
// доска заданий с записками, «Не хочу ничего» и «Своё задание».
// Нажатие на записку снимает её с доски (#/note/<id>, TaskNote): там «Начать».
// Нажатие на огонёк показывает подробности серии, на карточку героини — экран героини с ветками.

import { useEffect, useRef, useState } from 'preact/hooks';
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
import { go, noteRoute, useRoute } from './router';
import { Ladybug } from './Ladybug';
import { TaskNote } from './TaskNote';
import { SectionTiles } from './SectionTiles';
import { StreakBadge, StreakDetails } from './StreakBadge';
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
  /** Сколько боссов в работе. */
  bosses: number;
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
  bosses,
}: Props) {
  const [tiny, setTiny] = useState<TaskTemplate | null>(null);
  const [streakOpen, setStreakOpen] = useState(false);
  const [rerollHint, setRerollHint] = useState(false);
  const plankRef = useRef<HTMLDivElement>(null);
  // Подсказка «можно завтра» гаснет сама через несколько секунд.
  useEffect(() => {
    if (!rerollHint) return;
    const id = setTimeout(() => setRerollHint(false), 3500);
    return () => clearTimeout(id);
  }, [rerollHint]);
  const { player } = game;
  const today = dayOf(now);
  const level = levelInfo(totalXp(player.xp));
  const streak = viewStreak(player.streak, today);
  const byId = new Map(templates.map((t) => [t.id, t]));
  const board = game.board.taskIds.map((id) => byId.get(id)).filter((t) => t !== undefined);
  const canReroll = rerollAvailable(game.board, now);
  const noteId = noteRoute(useRoute());
  const note = noteId === null ? undefined : byId.get(noteId);
  const openNote = (t: TaskTemplate) => go(`note/${encodeURIComponent(t.id)}`);

  return (
    <main class="screen home">
      <header class="home__top">
        <div class="home__start">
          <span class="home__name">Просвет</span>
          <StreakBadge view={streak} open={streakOpen} onToggle={() => setStreakOpen(!streakOpen)} />
        </div>
        <button type="button" class="icon-button" aria-label="Настройки" onClick={() => go('settings')}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7h16M4 17h16" />
            <circle cx="9" cy="7" r="2.4" fill="var(--color-sky)" />
            <circle cx="15" cy="17" r="2.4" fill="var(--color-sky)" />
          </svg>
        </button>
      </header>

      {streakOpen && <StreakDetails view={streak} fireText={fireText(streak, today, player.streak.lastActiveDay !== null)} />}

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
        {isDistrictOpen(game.valley) && <p class="muted small valley-card__open">Долина открыта: тумана больше нет.</p>}
      </section>

      <p class="phrase">{idlePhrase}</p>

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

      <button type="button" class="card hero hero--link" onClick={() => go('hero')}>
        <span class="hero__row">
          <span class="hero__name">
            <span class="hero__level" title={`Уровень ${level.level}`} aria-label={`Уровень ${level.level}`}>
              {level.level}
            </span>
            <span class="hero__title">{titleFor(level.level)}</span>
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
        {/* Точное число опыта — на экране героини. */}
        <Progress value={level.xpIntoLevel} max={level.xpForNext} />
      </button>

      <section class="board" aria-label="Доска заданий">
        <div class="board__plank" ref={plankRef}>
          {board.length === 0 && <p class="board__empty">Все задания скрыты. Включи хотя бы несколько в настройках.</p>}
          {board.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={() => openNote(t)} />
          ))}
          {board.length > 0 && <Ladybug plankRef={plankRef} notes={board.map((t) => t.id).join(' ')} />}
          {/* Круглые кнопки внизу доски: своё задание и смена заданий. Если сегодня уже меняла, нажатие объясняет, почему нельзя. */}
          <div class="board__tools">
            <button type="button" class="board__knob" aria-label="Своё задание" onClick={() => go('custom')}>
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <path d="M12 5.5v13M5.5 12h13" />
              </svg>
            </button>
            {board.length > 0 && (
              <button
                type="button"
                class={`board__knob${canReroll ? '' : ' board__knob--spent'}`}
                aria-label={canReroll ? 'Сменить задания' : 'Сменить задания можно завтра'}
                onClick={() => (canReroll ? onReroll() : setRerollHint(true))}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1" />
                  <path d="M17.8 3.6v3.6h-3.6M6.2 20.4v-3.6h3.6" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* «Ничего не хочется…» — бумажный ярлычок, засунутый под нижний край доски.
            Нажатие разворачивает его в записку с крошечным заданием. */}
        {tiny ? (
          <div class={`board__tuck board__tuck--open task--${tiny.branch}`}>
            <div class="board__tuck-label small">Совсем немного — и уже засчитано:</div>
            <TaskCard task={tiny} onOpen={() => openNote(tiny)}>
              <span class="board__tuck-links">
                <button type="button" class="link-button task__other" onClick={() => setTiny(pickTiny(tiny.id) ?? null)}>
                  Другое
                </button>
                <button type="button" class="link-button task__other" onClick={() => setTiny(null)}>
                  Свернуть
                </button>
              </span>
            </TaskCard>
          </div>
        ) : (
          <button type="button" class="board__tuck" onClick={() => setTiny(pickTiny() ?? null)}>
            Ничего не хочется…
          </button>
        )}
        {rerollHint && !canReroll && <p class="muted small board__hint">Сменить задания можно завтра.</p>}
      </section>

      <SectionTiles bosses={bosses} pigeonsInFlight={pigeonsInFlight} coupons={coupons} />

      {note && <TaskNote task={note} valley={game.valley} onStart={onStart} />}
    </main>
  );
}
