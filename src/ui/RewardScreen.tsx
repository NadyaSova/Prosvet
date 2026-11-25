// Экран награды: опыт, золото, карта добычи (переворачивается нажатием), что выросло в долине, уровни, вехи серии, фраза.
// У таймерных заданий — правка времени (ссылка в строке прибавки) и вопрос при остановке — записка внизу
// («Отправила?», находка, итог разбора вакансии).

import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import type { BossSessionDone, CompletedTask } from '../logic/game';
import type { LootCard as Loot } from '../logic/loot';
import { titleFor } from '../logic/progression';
import { CORRECTION_MAX, CORRECTION_MIN, nudgeMinutes } from '../logic/timer';
import type { LoftState, StopAnswer, Verdict } from '../model/types';
import { daysText, minutesText, plural } from './format';
import { GoldIcon, XpIcon } from './common';
import { BRANCH_NAMES, GARDEN_GROWTH, itemName, plantName } from './labels';
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

/** Строка над названием: «Засчитано» — и что время вышло без тебя. */
function kickerOf(reward: ShownReward): string {
  if (reward.boss) return 'Подход засчитан';
  return reward.whileAway ? 'Время вышло, пока тебя не было. Засчитано' : 'Засчитано';
}

/** Что изменилось у босса после подхода: туман или место. */
function growthText(boss: BossSessionDone): string {
  if (boss.kind === 'finite' || !boss.garden || boss.growth === 'fog') return 'Туман над боссом стал тоньше';
  return GARDEN_GROWTH[boss.garden][boss.growth];
}

/** Подсказка в правке времени: что будет с картой добычи. */
function correctionHint(reward: ShownReward, minutes: number): string {
  if (reward.boss) {
    const from = BALANCE.bosses.lootFromMinutes;
    return minutes >= from ? 'С картой добычи.' : `Меньше ${minutesText(from)} — без карты добычи.`;
  }
  const planned = reward.plannedMinutes ?? 0;
  return `Задание было на ${minutesText(planned)}. ${minutes >= planned ? 'Засчитается полностью, с картой добычи.' : 'Меньше — без карты добычи.'}`;
}

/** Засчитанное время под названием: «25 минут», «12 минут из 30». Без таймера — ничего. */
function timeOf(reward: ShownReward): string | undefined {
  const { minutes, plannedMinutes } = reward;
  if (minutes === undefined) return undefined;
  return `${minutesText(minutes)}${minutes < (plannedMinutes ?? 0) ? ` из ${plannedMinutes}` : ''}`;
}

/**
 * Правка времени (docs/phase2-plan.md §3): сколько засчитать, в обе стороны.
 * Открывается ссылкой «поправить» в строке под названием («25 минут · поправить») и встаёт на место строки прибавки.
 */
function TimeCorrection({ reward, onCorrect, onClose }: { reward: ShownReward; onCorrect: (minutes: number) => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState(reward.minutes ?? 0);
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
      <p class="muted small">{correctionHint(reward, minutes)}</p>
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

/**
 * Метка бонуса за ответ: «+5 [росток] +3 [монета]». Росток — цветом ветки задания.
 * Стоит справа в строке выбранного ответа (у находки — под линией для письма); появляется плавно.
 */
function BonusTag({ reward }: { reward: ShownReward }) {
  const b = reward.report.bonus;
  if (!b) return null;
  return (
    <span class="bonus-tag">
      <span class="bonus-tag__part">
        +{b.xp} <XpIcon branch={reward.branch} />
      </span>
      <span class="bonus-tag__part">
        +{b.gold} <GoldIcon />
      </span>
    </span>
  );
}

/** Текстовая ссылка внутри строки: «поправить». */
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
 * tag — метка справа в строке выбранного ответа (бонус).
 * onPick нет — ответ уже не поменять (награду пересчитать нельзя): галочки только показывают выбранное.
 */
function Answers<T extends string>({
  options,
  value,
  onPick,
  tag,
}: {
  options: [T, string][];
  value?: T;
  onPick?: (v: T) => void;
  tag?: ComponentChildren;
}) {
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
          {value === v && tag}
        </button>
      ))}
    </div>
  );
}

/** Строка под галочками: «Время засчитано. Решишь потом.» */
function Result({ children }: { children: ComponentChildren }) {
  return <p class="reward-note__result small">{children}</p>;
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
  if (pigeon.sentTo) return <p class="reward-note__summary">Голубь улетел: «{pigeon.sentTo}»</p>;
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
    </>
  );
}

const YES_NO = {
  sent: { question: 'Отправила?', yes: 'Да, отправила', no: 'Пока нет' },
  found: { question: 'Нашлась подходящая вакансия?', yes: 'Да, нашлась', no: 'Нет' },
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
        tag={<BonusTag reward={reward} />}
      />
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
      <Answers<Verdict>
        options={VERDICTS}
        value={answered}
        onPick={onAnswer && ((verdict) => onAnswer({ ask: 'verdict', verdict }))}
        tag={<BonusTag reward={reward} />}
      />
      {answered === 'think' && <Result>Время засчитано. Решишь потом.</Result>}
    </>
  );
}

/**
 * Строка на линии для письма: находка после чтения сообществ, заметка к подходу к боссу.
 * Записанный текст остаётся на линии, кнопки нет; под линией слева «✓ записано», справа — tag (метка бонуса).
 * Поправила текст — отметка пропадает, снова кнопка. onSave нет — записать уже нельзя: только показать записанное.
 */
export function InkLine({
  question,
  hint,
  saved,
  maxLength,
  button,
  onSave,
  tag,
}: {
  question: string;
  hint: string;
  saved?: string;
  maxLength: number;
  button: string;
  onSave?: (text: string) => void;
  tag?: ComponentChildren;
}) {
  const [text, setText] = useState(saved ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  if (!saved && !onSave) return null;
  // Как находка (cleanFinding): пробелы по краям и повторы убраны, длина ограничена.
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, maxLength).trim();
  const isSaved = saved !== undefined && clean === saved;
  function save(e: Event) {
    e.preventDefault();
    if (!clean || isSaved || !onSave) return;
    // Как в голубятне: сначала отпустить поле, чтобы клавиатура Android дописала слово.
    inputRef.current?.blur();
    onSave(clean);
  }
  return (
    <form class="reward-note__form" onSubmit={save}>
      <label class="field">
        <span class="reward-note__question">{question}</span>
        <span class="reward-note__hint small">{hint}</span>
        <input
          type="text"
          class="ink-input"
          ref={inputRef}
          maxLength={maxLength}
          readOnly={!onSave}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
      </label>
      {saved !== undefined && (
        <div class="reward-note__tag-row">
          {isSaved && (
            <span class="reward-note__saved">
              <svg class="reward-note__saved-mark" viewBox="0 0 22 22" aria-hidden="true">
                <path d="M4 11.5 L9 16.5 L19 4" />
              </svg>
              записано
            </span>
          )}
          {tag}
        </div>
      )}
      {onSave && !isSaved && (
        <div class="ink-actions">
          <button type="submit" class="ink-button ink-actions__main" disabled={!clean}>
            {button}
          </button>
        </div>
      )}
    </form>
  );
}

/** Находка после чтения сообществ — бонус за неё меткой под линией. */
function FindingAsk({ reward, onAnswer }: { reward: ShownReward; onAnswer?: (a: StopAnswer) => void }) {
  return (
    <InkLine
      question="Нашлось что-то новое?"
      hint="Мероприятие, компания, человек, роль, ресурс — одной строкой. Можно и пропустить."
      saved={reward.answer?.ask === 'finding' ? reward.answer.text : undefined}
      maxLength={BALANCE.tasks.findingMaxLength}
      button="Записать находку"
      onSave={onAnswer && ((text) => onAnswer({ ask: 'finding', text }))}
      tag={<BonusTag reward={reward} />}
    />
  );
}

/**
 * Заметка к подходу к боссу (docs/phase2-plan.md §5.1) — записка внизу экрана награды, как вопрос при остановке.
 * Бонуса нет: заметку потом видно в журнале подходов и при следующем подходе.
 */
function BossNote({ reward, onNote }: { reward: ShownReward; onNote?: (note: string) => void }) {
  const boss = reward.boss;
  if (!boss || (!onNote && !boss.note)) return null;
  return (
    <section class={`reward-note task--${reward.branch}`}>
      <InkLine
        question="Что было в этот раз?"
        hint="Что нашла, что сделала, с чего начать в следующий раз — одной строкой. Можно и пропустить."
        saved={boss.note}
        maxLength={BALANCE.bosses.sessionNoteMaxLength}
        button="Записать"
        onSave={onNote}
      />
    </section>
  );
}

/**
 * Вопрос при остановке таймера (docs/phase2-plan.md §4) — записка с булавкой цвета ветки, как задание на доске.
 * Стоит последней перед «Дальше»: сначала награда, потом вопрос. Ответ остаётся на записке, бонус — меткой.
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
  /** Подход к боссу: записать заметку к подходу; нет — записать уже нельзя. */
  onNote?: (note: string) => void;
}

export function RewardScreen({ reward, onClose, onLoft, onCorrect, onAnswer, pigeon, onNote }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const r = reward.report;
  const baseGold = r.gold - r.lootGold;
  const lootStars = r.loot?.kind === 'star' ? 1 : 0;
  const milestoneStars = r.streakMilestones.length * BALANCE.streak.starsPerMilestone;
  const levelStars = r.stars - lootStars - milestoneStars - r.taskStars;
  const canCorrect = onCorrect !== undefined && reward.minutes !== undefined;
  const time = timeOf(reward);

  return (
    <main class="screen reward">
      <p class="reward__kicker">{kickerOf(reward)}</p>
      <div class="reward__head">
        <h1 class="reward__title">{reward.title}</h1>
        {time && (
          <p class="reward__time small muted">
            {time}
            {canCorrect && !correcting && (
              <>
                {' · '}
                <InlineLink onClick={() => setCorrecting(true)}>поправить</InlineLink>
              </>
            )}
          </p>
        )}
        {reward.boss?.capped && (
          <p class="reward__time small muted">
            Секундомер шёл дольше {minutesText(BALANCE.bosses.maxSessionMinutes)} — засчитано столько. Если было иначе, поправь.
          </p>
        )}
      </div>

      {canCorrect && correcting ? (
        <TimeCorrection reward={reward} onCorrect={onCorrect} onClose={() => setCorrecting(false)} />
      ) : (
        <div class="reward__gains">
          <div>
            <b>+{r.xp}</b> <XpIcon branch={r.branch} />
          </div>
          <div>
            <b>+{baseGold}</b> <GoldIcon />
          </div>
          {r.taskStars > 0 && (
            <div>
              <b>+{r.taskStars}</b> <span class="wallet__star">★</span>
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
        <p class="muted small">
          {reward.boss ? `Карта добычи — за подход от ${minutesText(BALANCE.bosses.lootFromMinutes)}.` : 'Карта добычи — за полное время.'}
        </p>
      )}

      <ul class="reward__news">
        {reward.boss && <li>{growthText(reward.boss)}</li>}
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
      <BossNote reward={reward} onNote={onNote} />

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
