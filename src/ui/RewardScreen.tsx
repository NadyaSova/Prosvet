// Экран награды: опыт, золото, карта добычи (переворачивается нажатием), что выросло в долине, уровни, вехи серии, фраза.
// У таймерных заданий — правка времени (ссылка в строке прибавки) и вопрос при остановке — записка внизу
// («Отправила?», находка, итог разбора вакансии).

import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import type { CompletedTask } from '../logic/game';
import type { LootCard as Loot } from '../logic/loot';
import { titleFor } from '../logic/progression';
import { cleanFinding } from '../logic/stop-questions';
import { CORRECTION_MAX, CORRECTION_MIN, nudgeMinutes } from '../logic/timer';
import type { LoftState, StopAnswer, Verdict } from '../model/types';
import { daysText, minutesText, plural } from './format';
import { BRANCH_NAMES, itemName, plantName } from './labels';
import { PigeonSend } from './PigeonSend';

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

/**
 * Правка времени (docs/phase2-plan.md §3): сколько засчитать, в обе стороны.
 * Открывается ссылкой «поправить время» в строке прибавки и встаёт на место этой строки.
 */
function TimeCorrection({ reward, onCorrect, onClose }: { reward: ShownReward; onCorrect: (minutes: number) => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState(reward.minutes ?? 0);
  const planned = reward.plannedMinutes ?? 0;
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
        <button type="button" class="button button--secondary" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          class="button"
          disabled={minutes === reward.minutes}
          onClick={() => {
            onCorrect(minutes);
            onClose();
          }}
        >
          Засчитать
        </button>
      </div>
    </div>
  );
}

/** «+10 опыта и +5 золота» — бонус за ответ. */
function bonusText(reward: ShownReward): string {
  const b = reward.report.bonus;
  return b ? `+${b.xp} опыта и +${b.gold} золота` : '';
}

/** Текстовая ссылка внутри строки: «поправить время», «изменить». */
function InlineLink({ children, onClick }: { children: ComponentChildren; onClick: () => void }) {
  return (
    <button type="button" class="link-button reward__link" onClick={onClick}>
      {children}
    </button>
  );
}

/** Вопрос записки. */
function Question({ children }: { children: ComponentChildren }) {
  return <p class="reward-note__question">{children}</p>;
}

/**
 * Ответы — квадратики-галочки, как в анкете на листке: всё внутри записки «написано на бумаге».
 * Нажатие рисует галочку цветом ветки. Вопрос и ответы остаются на записке — галочку можно переставить.
 * onPick нет — ответ уже не поменять (награду пересчитать нельзя): галочки только показывают выбранное.
 */
function Answers<T extends string>({ options, value, onPick }: { options: [T, string][]; value?: T; onPick?: (v: T) => void }) {
  return (
    <div class="reward-note__ticks">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          class="tick"
          aria-pressed={value === v}
          disabled={!onPick}
          onClick={() => v !== value && onPick?.(v)}
        >
          <span class="tick__box" aria-hidden="true">
            {value === v && (
              <svg viewBox="0 0 22 22">
                <path class="tick__mark" d="M4 11.5 L9 16.5 L19 4" />
              </svg>
            )}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Итог под галочками: бонус или «время засчитано и так». */
function Result({ children }: { children: ComponentChildren }) {
  return <p class="reward-note__result small">{children}</p>;
}

/** Строка на записке: улетевший голубь, записанная находка. «изменить» разворачивает вопрос обратно. */
function Summary({ children, onEdit }: { children: ComponentChildren; onEdit?: () => void }) {
  return (
    <p class="reward-note__summary">
      {children}
      {onEdit && (
        <span class="reward-note__edit">
          {' · '}
          <InlineLink onClick={onEdit}>изменить</InlineLink>
        </span>
      )}
    </p>
  );
}

/** Отправка голубя после Отклика: «Отправила?» → голубь → компания. Голубь улетает отдельным заданием со своей наградой. */
export interface PigeonQuestion {
  loft: LoftState;
  /** Куда уже улетел голубь с этого экрана. */
  sentTo?: string;
  onSend: (perchIndex: number, company: string) => void;
  /** С какого ответа начать (для галереи); обычно — без ответа. */
  initial?: 'yes' | 'no';
}

function PigeonAsk({ pigeon }: { pigeon: PigeonQuestion }) {
  const [choice, setChoice] = useState(pigeon.initial);
  if (pigeon.sentTo) return <Summary>Голубь улетел: «{pigeon.sentTo}»</Summary>;
  return (
    <>
      <Question>Отправила отклик?</Question>
      <Answers
        options={[
          ['yes', 'Да, отправила'],
          ['no', 'Пока нет'],
        ]}
        value={choice}
        onPick={setChoice}
      />
      {choice === 'yes' && (
        <>
          <p class="reward-note__hint small">Выбери голубя — он отнесёт отклик.</p>
          <div class="reward__perch">
            <PigeonSend loft={pigeon.loft} onSend={pigeon.onSend} inNote />
          </div>
        </>
      )}
      {choice === 'no' && <Result>Время засчитано и так.</Result>}
    </>
  );
}

const YES_NO = {
  sent: { question: 'Отправила?', yes: 'Да, отправила', no: 'Пока нет', why: 'за отправленное' },
  found: { question: 'Нашлась подходящая вакансия?', yes: 'Да, нашлась', no: 'Нет', why: 'за подходящую вакансию' },
} as const;

function YesNoAsk({ reward, ask, onAnswer }: { reward: ShownReward; ask: 'sent' | 'found'; onAnswer?: (a: StopAnswer) => void }) {
  const a = reward.answer;
  const answered = a && (a.ask === 'sent' || a.ask === 'found') && a.ask === ask ? a : undefined;
  if (!answered && !onAnswer) return null;
  const t = YES_NO[ask];
  const value = answered ? (answered.yes ? 'yes' : 'no') : undefined;
  return (
    <>
      <Question>{t.question}</Question>
      <Answers
        options={[
          ['yes', t.yes],
          ['no', t.no],
        ]}
        value={value}
        onPick={onAnswer && ((v) => onAnswer({ ask, yes: v === 'yes' }))}
      />
      {value === 'yes' && (
        <Result>
          {bonusText(reward)} — {t.why}.
        </Result>
      )}
      {value === 'no' && <Result>Время засчитано и так.</Result>}
    </>
  );
}

const VERDICTS: [Verdict, string][] = [
  ['apply', 'Откликаться'],
  ['skip', 'Не откликаться'],
  ['think', 'Подумаю'],
];

function VerdictAsk({ reward, onAnswer }: { reward: ShownReward; onAnswer?: (a: StopAnswer) => void }) {
  const a = reward.answer;
  const answered = a?.ask === 'verdict' ? a.verdict : undefined;
  if (!answered && !onAnswer) return null;
  return (
    <>
      <Question>Что решила по вакансии?</Question>
      <Answers<Verdict> options={VERDICTS} value={answered} onPick={onAnswer && ((verdict) => onAnswer({ ask: 'verdict', verdict }))} />
      {answered && answered !== 'think' && <Result>{bonusText(reward)} — за решение.</Result>}
      {answered === 'think' && <Result>Время засчитано. Решишь потом.</Result>}
    </>
  );
}

function FindingAsk({ reward, onAnswer }: { reward: ShownReward; onAnswer?: (a: StopAnswer) => void }) {
  const saved = reward.answer?.ask === 'finding' ? reward.answer.text : undefined;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(saved ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  if (saved && (!editing || !onAnswer)) {
    return (
      <Summary
        onEdit={
          onAnswer &&
          (() => {
            setText(saved);
            setEditing(true);
          })
        }
      >
        Находка: «{saved}» · {bonusText(reward)}
      </Summary>
    );
  }
  if (!onAnswer) return null;
  const answer = onAnswer;
  function save(e: Event) {
    e.preventDefault();
    const clean = cleanFinding(text);
    if (!clean) return;
    // Как в голубятне: сначала отпустить поле, чтобы клавиатура Android дописала слово.
    inputRef.current?.blur();
    answer({ ask: 'finding', text: clean });
    setEditing(false);
  }
  return (
    <form class="reward-note__form" onSubmit={save}>
      <label class="field">
        <span class="reward-note__question">Нашлось что-то новое?</span>
        <span class="reward-note__hint small">Мероприятие, компания, человек, роль, ресурс — одной строкой. Можно и пропустить.</span>
        <input
          type="text"
          class="ink-input"
          ref={inputRef}
          maxLength={BALANCE.tasks.findingMaxLength}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
      </label>
      <div class="ink-actions">
        {saved && (
          <button type="button" class="ink-button ink-button--quiet" onClick={() => setEditing(false)}>
            Отмена
          </button>
        )}
        <button type="submit" class="ink-button ink-actions__main" disabled={!cleanFinding(text)}>
          Записать находку
        </button>
      </div>
    </form>
  );
}

/**
 * Вопрос при остановке таймера (docs/phase2-plan.md §4) — записка с булавкой цвета ветки, как задание на доске.
 * Стоит последней перед «Дальше»: сначала награда, потом вопрос. После ответа сворачивается в строку.
 */
function StopAsk({ reward, onAnswer, pigeon }: { reward: ShownReward; onAnswer?: (a: StopAnswer) => void; pigeon?: PigeonQuestion }) {
  let body;
  switch (reward.ask) {
    case 'pigeon':
      body = pigeon && <PigeonAsk pigeon={pigeon} />;
      break;
    case 'finding':
      body = <FindingAsk reward={reward} onAnswer={onAnswer} />;
      break;
    case 'sent':
    case 'found':
      body = <YesNoAsk reward={reward} ask={reward.ask} onAnswer={onAnswer} />;
      break;
    case 'verdict':
      body = <VerdictAsk reward={reward} onAnswer={onAnswer} />;
      break;
  }
  // Ответа ещё нет, а пересчитать награду уже нельзя — записки нет.
  if (!body || (reward.ask !== 'pigeon' && !onAnswer && !reward.answer)) return null;
  return <section class={`reward-note task--${reward.branch}`}>{body}</section>;
}

interface Props {
  reward: ShownReward;
  onClose: () => void;
  onLoft?: () => void;
  /** Правка времени таймерного задания; нет — править нельзя. */
  onCorrect?: (minutes: number) => void;
  /** Ответ на вопрос при остановке пересчитывает награду; нет — пересчитать нельзя, вопроса нет. */
  onAnswer?: (answer: StopAnswer) => void;
  /** «Отправила отклик?» — отправка голубя. */
  pigeon?: PigeonQuestion;
}

export function RewardScreen({ reward, onClose, onLoft, onCorrect, onAnswer, pigeon }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const r = reward.report;
  const baseGold = r.gold - r.lootGold;
  const lootStars = r.loot?.kind === 'star' ? 1 : 0;
  const milestoneStars = r.streakMilestones.length * BALANCE.streak.starsPerMilestone;
  const levelStars = r.stars - lootStars - milestoneStars - r.taskStars;
  const canCorrect = onCorrect !== undefined && reward.minutes !== undefined;

  return (
    <main class="screen reward">
      <p class="reward__kicker">{kickerOf(reward)}</p>
      <h1 class="reward__title">{reward.title}</h1>

      {canCorrect && correcting ? (
        <TimeCorrection reward={reward} onCorrect={onCorrect} onClose={() => setCorrecting(false)} />
      ) : (
        <div class="reward__gains">
          <div>
            <b>+{r.xp}</b> опыта <span class="muted">· {BRANCH_NAMES[r.branch]}</span>
            {canCorrect && (
              <>
                <span class="muted"> · </span>
                <InlineLink onClick={() => setCorrecting(true)}>поправить время</InlineLink>
              </>
            )}
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
      )}

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

      <StopAsk reward={reward} onAnswer={onAnswer} pigeon={pigeon} />

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
