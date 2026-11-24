// Галерея: правка времени на экране награды (фаза 2, шаг 3). Награды настоящие — из логики игры,
// «Поправить время» пересчитывает их так же, как в приложении.

import { useState } from 'preact/hooks';
import { DEFAULT_TASKS } from '../data/default-tasks';
import { finishTimedTask, onOpen, startTimedTask, type CompletedTask, type GameState } from '../logic/game';
import { createRng } from '../logic/rng';
import { emptyValley } from '../logic/valley';
import { createPlayer } from '../model/player';
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
  if (c.whileAway) return onOpen(started(), DEFAULT_TASKS, now, rng, minutes).done!;
  return finishTimedTask(started(), DEFAULT_TASKS, now, rng, minutes)!.done;
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
