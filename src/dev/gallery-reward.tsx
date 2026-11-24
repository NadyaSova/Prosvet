// Галерея: правка времени на экране награды (фаза 2, шаг 3) и вопросы при остановке (шаг 4).
// Награды настоящие — из логики игры, «Поправить время» и ответы пересчитывают их так же, как в приложении.

import { useState } from 'preact/hooks';
import { DEFAULT_TASKS } from '../data/default-tasks';
import { finishTimedTask, onOpen, startTimedTask, type CompletedTask, type GameState, type TimerFix } from '../logic/game';
import { createRng } from '../logic/rng';
import { emptyValley } from '../logic/valley';
import { createPlayer } from '../model/player';
import type { LoftState, TaskTemplate } from '../model/types';
import { RewardScreen } from '../ui/RewardScreen';

const NOW = new Date(2026, 10, 24, 12, 0).getTime();
const MIN = 60_000;

interface Case {
  label: string;
  /** Через сколько минут после старта остановили. */
  after: number;
  whileAway?: boolean;
}

const CASES: Case[] = [
  { label: 'Время вышло (30 из 30)', after: 30 },
  { label: '«Закончила раньше» на 12-й минуте', after: 12 },
  { label: 'Время вышло, пока приложение было закрыто', after: 300, whileAway: true },
];

function started(): GameState {
  const g: GameState = { player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() };
  return startTimedTask(g, { templateId: 'once', title: 'Отклик', branch: 'call', minutes: 30 }, NOW);
}

function settle(c: Case, minutes?: number): CompletedTask {
  const rng = createRng(7);
  const now = NOW + c.after * MIN;
  if (c.whileAway) return onOpen(started(), DEFAULT_TASKS, now, rng, { minutes }).done!;
  return finishTimedTask(started(), DEFAULT_TASKS, now, rng, { minutes })!.done;
}

function Sample({ c }: { c: Case }) {
  const [done, setDone] = useState(() => settle(c));
  return (
    <figure class="gallery__phone">
      <RewardScreen
        reward={{ ...done, phrase: 'Туман отступил на шаг и сделал вид, что так и задумывал.' }}
        onClose={() => setDone(settle(c))}
        onCorrect={(minutes) => setDone(settle(c, minutes))}
      />
      <figcaption class="muted small">{c.label}. «Дальше» — вернуть как было</figcaption>
    </figure>
  );
}

export function RewardSection() {
  return (
    <section class="card">
      <h2>Правка времени на экране награды</h2>
      <p class="muted small">Задание «Отклик» на 30 минут. Нажми «Поправить время» — награда пересчитается.</p>
      <div class="gallery__phones">
        {CASES.map((c) => (
          <Sample key={c.label} c={c} />
        ))}
      </div>
    </section>
  );
}

// Вопросы при остановке: пять заданий из стартового набора, время вышло полностью.

const LOFT: LoftState = {
  perch: [
    { pose: 'sit', size: 'large', color: 'slate' },
    { pose: 'preen', size: 'medium', color: 'white' },
    { pose: 'look', size: 'small', color: 'rose' },
    { pose: 'sit', size: 'medium', color: 'lilac' },
    { pose: 'preen', size: 'large', color: 'rose' },
  ],
};

type TimedTask = TaskTemplate & { kind: 'timed' };
const task = (id: string) => DEFAULT_TASKS.find((t) => t.id === id) as TimedTask;

interface AskCase {
  label: string;
  task: TimedTask;
  /** Другое название — проверить короткое. */
  title?: string;
  /** С каким ответом открыть. */
  fix?: TimerFix;
  pigeon?: { initial?: 'yes' | 'no'; sentTo?: string };
}

const ASK_CASES: AskCase[] = [
  { label: 'Отклик: вопрос', task: task('hunt-apply-session'), pigeon: {} },
  { label: 'Отклик: «Да, отправила» — жёрдочка', task: task('hunt-apply-session'), pigeon: { initial: 'yes' } },
  { label: 'Отклик: голубь улетел', task: task('hunt-apply-session'), pigeon: { sentTo: 'Ромашка' } },
  { label: 'Написать: короткое название, вопрос', task: task('threads-write'), title: 'Написать' },
  { label: 'Написать: «Да, отправила»', task: task('threads-write'), fix: { answer: { ask: 'sent', yes: true } } },
  { label: 'Чтение сообществ: вопрос', task: task('scouting-communities') },
  {
    label: 'Чтение сообществ: находка записана',
    task: task('scouting-communities'),
    fix: { answer: { ask: 'finding', text: 'Митап по найму разработчиков в Хайфе, 3 декабря' } },
  },
  { label: 'Поиск вакансий: вопрос', task: task('hunt-browse') },
  { label: 'Поиск вакансий: «Нет»', task: task('hunt-browse'), fix: { answer: { ask: 'found', yes: false } } },
  { label: 'Разбор вакансии: длинное название, вопрос', task: task('hunt-review') },
  { label: 'Разбор вакансии: «Не откликаться»', task: task('hunt-review'), fix: { answer: { ask: 'verdict', verdict: 'skip' } } },
  { label: 'Разбор вакансии: «Подумаю»', task: task('hunt-review'), fix: { answer: { ask: 'verdict', verdict: 'think' } } },
];

function settleTask(t: TimedTask, fix: TimerFix = {}): CompletedTask {
  const g: GameState = { player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() };
  const s = startTimedTask(g, { templateId: t.id, title: t.title, branch: t.branch, minutes: t.minutes }, NOW);
  return finishTimedTask(s, DEFAULT_TASKS, NOW + t.minutes * MIN, createRng(7), fix)!.done;
}

function AskSample({ c }: { c: AskCase }) {
  const [fix, setFix] = useState<TimerFix>(c.fix ?? {});
  const [sentTo, setSentTo] = useState(c.pigeon?.sentTo);
  const [seq, setSeq] = useState(0);
  const done = settleTask(c.task, fix);
  return (
    <figure class="gallery__phone">
      <RewardScreen
        key={seq}
        reward={{ ...done, title: c.title ?? done.title, phrase: 'Туман отступил на шаг и сделал вид, что так и задумывал.' }}
        onClose={() => {
          setFix(c.fix ?? {});
          setSentTo(c.pigeon?.sentTo);
          setSeq((n) => n + 1);
        }}
        onCorrect={(minutes) => setFix((f) => ({ ...f, minutes }))}
        onAnswer={(answer) => setFix((f) => ({ ...f, answer }))}
        pigeon={c.pigeon && { loft: LOFT, sentTo, initial: c.pigeon.initial, onSend: (_i, company) => setSentTo(company) }}
      />
      <figcaption class="muted small">{c.label}. «Дальше» — вернуть как было</figcaption>
    </figure>
  );
}

export function StopQuestionsSection() {
  return (
    <section class="card">
      <h2>Вопросы при остановке</h2>
      <p class="muted small">
        Записка внизу экрана награды, перед «Дальше». Ответ пересчитывает награду: бонус входит в опыт и золото вверху. Галочки остаются на
        записке, под ними — итог; галочку можно переставить. Находка после записи сворачивается в строку с «изменить».
      </p>
      <div class="gallery__phones">
        {ASK_CASES.map((c) => (
          <AskSample key={c.label} c={c} />
        ))}
      </div>
    </section>
  );
}
