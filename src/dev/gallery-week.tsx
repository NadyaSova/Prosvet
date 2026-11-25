// Галерея: итоги недели (фаза 2, шаг 10). Насыщенная неделя и тихая; «что хочется» записывается по-настоящему.

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { addSession, createBoss, startStopwatch, winBoss } from '../logic/bosses';
import { createRng } from '../logic/rng';
import { dayOf } from '../logic/time';
import { emptyValley, plantForCompletion } from '../logic/valley';
import { logDay, setWish, weekSummary, wishFor, type WeekData } from '../logic/week';
import { createPlayer } from '../model/player';
import type { Boss, Branch, Pigeon, PlayerState, ValleyState, WeekState } from '../model/types';
import { WeekScreen } from '../ui/WeekScreen';

/** Неделя 22–28 ноября 2026; итоги смотрят в воскресенье 29-го. */
const SUN = dayOf(new Date(2026, 10, 22).getTime());
const TODAY = SUN + 7;
const dayAt = (d: number, h = 12) => new Date(2026, 10, 22 + d, h).getTime();

/** Дела недели: [день недели, ветка, минуты (0 — мгновенное)]. */
type Done = [day: number, branch: Branch, minutes: number];

function playerOf(done: Done[], lastActive: number): PlayerState {
  const p = createPlayer();
  for (const [d, b, m] of done) p.days = logDay(p.days, SUN + d, b, m);
  p.streak = { startDay: SUN - 12, lastActiveDay: SUN + lastActive, extraDays: 0, logs: 1, milestoneReached: 14 };
  return p;
}

/** Долина: растения до недели и за неделю, по-настоящему посаженные. */
function valleyOf(before: Done[], during: Done[]): ValleyState {
  let v = emptyValley();
  const rng = createRng(5);
  const grow = (list: Done[], when: (d: number) => number) => {
    for (const [d, branch, minutes] of list) {
      const c = minutes > 0 ? { kind: 'timed' as const, branch, minutes, full: true } : { kind: 'instant' as const, branch, instant: 'journal' as const };
      const r = plantForCompletion(v, c, when(d), rng);
      if (r) v = r.valley;
    }
  };
  grow(before, (d) => dayAt(-7 + d));
  grow(during, (d) => dayAt(d, 14));
  return v;
}

function boss(id: string, title: string, kind: Boss['kind'], branch: Branch, sessions: [day: number, minutes: number][], seed = 3): Boss {
  let b = createBoss([], { title, kind, branch }, dayAt(-10), createRng(seed), id);
  for (const [d, m] of sessions) b = addSession(startStopwatch(b, dayAt(d, 10)), m);
  return b;
}

const pigeon = (id: string, sent: number, back?: [day: number, outcome: Pigeon['outcome']], color: Pigeon['look']['color'] = 'slate'): Pigeon => ({
  id,
  company: id,
  look: { pose: 'sit', size: 'medium', color },
  sentAt: dayAt(sent),
  status: back ? 'returned' : 'flying',
  ...(back && { outcome: back[1], returnedAt: dayAt(back[0]) }),
});

const RICH_DONE: Done[] = [
  [0, 'chronicle', 0], [0, 'scouting', 15], [1, 'hunt', 20], [1, 'hunt', 15], [1, 'call', 30], [1, 'call', 0],
  [2, 'prep', 20], [2, 'prep', 45], [3, 'chronicle', 20], [3, 'threads', 20], [4, 'craft', 30], [4, 'craft', 30],
  [4, 'prep', 50], [5, 'scouting', 15], [5, 'chronicle', 0], [6, 'call', 30], [6, 'call', 0],
];

const RICH: WeekData = (() => {
  let interview = boss('interview', 'Интервью в компании «Ромашка»', 'finite', 'prep', [[-3, 30], [2, 45], [4, 50]]);
  interview = winBoss(interview, dayAt(5, 15));
  const roles = boss('roles', 'Соседние роли', 'endless', 'scouting', [[-5, 30], [-2, 30], [3, 40]], 9);
  const test = { ...boss('test', 'Тестовое для «Лиры»', 'finite', 'craft', []), createdAt: dayAt(4) };
  const old = boss('old', 'Послужной список', 'finite', 'chronicle', [[-6, 40]]);
  return {
    player: playerOf(RICH_DONE, 6),
    valley: valleyOf(
      [[0, 'hunt', 20], [1, 'chronicle', 20], [2, 'prep', 30], [3, 'scouting', 15], [4, 'call', 30]],
      RICH_DONE.filter(([, b]) => b !== 'prep'),
    ),
    bosses: [interview, roles, test, old],
    pigeons: [
      pigeon('Лира', 1),
      pigeon('Сосна', 6),
      pigeon('Клён', -12, [3, 'silence'], 'rose'),
      pigeon('Ромашка', -10, [2, 'invited'], 'white'),
      pigeon('Берёзка', -20, [-5, 'rejected'], 'lilac'),
    ],
    achievements: [{ id: 'e1', createdAt: dayAt(0), updatedAt: dayAt(0), title: 'Ускорила сборку', status: 'draft' }],
  };
})();

const QUIET_DONE: Done[] = [[1, 'chronicle', 5], [4, 'scouting', 15]];

const QUIET: WeekData = {
  player: (() => {
    const p = playerOf(QUIET_DONE, 4);
    p.streak = { ...p.streak, startDay: SUN + 1, logs: 0 };
    return p;
  })(),
  valley: valleyOf([[0, 'hunt', 20]], QUIET_DONE),
  bosses: [],
  pigeons: [],
  achievements: [],
};

function Phone({ caption, children }: { caption: string; children: ComponentChildren }) {
  return (
    <figure class="gallery__phone">
      {children}
      <figcaption class="muted small">{caption}</figcaption>
    </figure>
  );
}

function Week({ data, initial, caption }: { data: WeekData; initial: WeekState; caption: string }) {
  const [week, setWeek] = useState(initial);
  return (
    <Phone caption={caption}>
      <WeekScreen
        summary={weekSummary(data, SUN, TODAY)}
        today={TODAY}
        pastWish={wishFor(week, SUN)}
        wish={wishFor(week, TODAY)}
        onWish={(text) => setWeek(setWish(week, TODAY, text))}
        onClose={() => setWeek(initial)}
      />
    </Phone>
  );
}

export function WeekSection() {
  return (
    <section>
      <h2>Итоги недели (шаг 10)</h2>
      <p class="muted small">
        Приложение показывает их само при первом открытии в новой неделе (с воскресенья), если на прошлой неделе что-то было.
        Ещё — ссылкой «Итоги прошлой недели» на экране героини. «Дальше» здесь возвращает записку «что хочется» как было.
      </p>
      <div class="gallery__phones">
        <Week
          data={RICH}
          initial={{ seen: TODAY, wishes: [{ week: SUN, text: 'Довести тестовое и написать двум знакомым' }] }}
          caption="Насыщенная неделя: победа над боссом, голуби с перьями, неделю назад записано «что хочется»"
        />
        <Week
          data={QUIET}
          initial={{ seen: TODAY, wishes: [{ week: TODAY, text: 'Один отклик' }] }}
          caption="Тихая неделя: два дела, без боссов и голубей; на эту неделю уже записано"
        />
      </div>
    </section>
  );
}
