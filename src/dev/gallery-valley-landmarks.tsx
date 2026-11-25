// Галерея: сооружения конечных боссов в долине (фаза 2, шаг 7) — где встают, как туман редеет с подходами,
// анимации: новый босс, подход, победа.

import { useState } from 'preact/hooks';
import { addSession, createBoss, startStopwatch, winBoss } from '../logic/bosses';
import type { Completion } from '../logic/rewards';
import { createRng } from '../logic/rng';
import { emptyValley, landmarkSite, plantForCompletion, syncLandmarks } from '../logic/valley';
import { LANDMARK_SITES, WORLD } from '../logic/valley-district';
import { BRANCHES, LANDMARK_KINDS, type Boss, type LandmarkKind, type ValleyState } from '../model/types';
import { LANDMARK_NAMES } from '../ui/valley/landmark-art';
import { SCENE_HEIGHT, ValleyScene, ValleyView } from '../ui/valley/ValleyView';

const NOW = new Date(2026, 10, 25, 12, 0).getTime();
const DAY = 86_400_000;

function grown(n: number): ValleyState {
  let v = emptyValley();
  for (let i = 0; i < n; i++) {
    const c: Completion = { kind: 'timed', branch: BRANCHES[i % BRANCHES.length]!, minutes: [5, 15, 30][i % 3]!, full: true };
    v = plantForCompletion(v, c, NOW - (n - i) * DAY, createRng(i + 1))?.valley ?? v;
  }
  return v;
}

function boss(i: number, landmark: LandmarkKind, sessions: number, won = false): Boss {
  let b = createBoss([], { title: LANDMARK_NAMES[landmark], kind: 'finite', branch: 'prep' }, NOW - (40 - i) * DAY, createRng(i + 7), `b${i}`);
  b = { ...b, place: { ...b.place, landmark } };
  for (let k = 0; k < sessions; k++) b = addSession(startStopwatch(b, NOW - (sessions - k) * DAY), 30);
  return won ? winBoss(b, NOW) : b;
}

/** Все 11 сооружений: подходов от 0 до 8, три — победы. */
const STAGES: [sessions: number, won?: boolean][] = [[0], [1], [2], [3], [4], [6], [8], [5, true], [3, true], [1], [2, true]];
const ALL = LANDMARK_KINDS.map((k, i) => boss(i, k, ...STAGES[i]!));
const BIG_VALLEY = syncLandmarks(grown(40), ALL);

function stageText(b: Boss): string {
  if (b.status === 'won') return 'победа';
  const n = b.sessions.length;
  return n === 0 ? 'только что заведён' : `${n} ${n === 1 ? 'подход' : n < 5 ? 'подхода' : 'подходов'}`;
}

const scene = (scale: number) => ({ width: `${WORLD.width * scale}px`, height: `${SCENE_HEIGHT * scale}px` });

/** Панорама как на главном экране, с кнопкой «Ещё раз» — анимация с начала. */
function Replay({ title, valley, bosses, fresh }: { title: string; valley: ValleyState; bosses: Boss[]; fresh: string }) {
  const [n, setN] = useState(0);
  return (
    <figure class="gallery__phone">
      <figcaption class="gallery__row-title">{title}</figcaption>
      <ValleyView key={n} valley={valley} bosses={bosses} fire="full" feathers={[]} cloakStage={0} fresh={fresh} />
      <button type="button" class="link-button" onClick={() => setN(n + 1)}>
        Ещё раз
      </button>
    </figure>
  );
}

// Молодая долина: первый босс.
const YOUNG = grown(12);
const FIRST = boss(20, 'windmill', 0);
const YOUNG_WITH = syncLandmarks(YOUNG, [FIRST]);
// Подход: четвёртый, сквозь туман проступает силуэт.
const MILL3 = boss(21, 'observatory', 3);
const MILL4 = boss(21, 'observatory', 4);
const SESSION_VALLEY = syncLandmarks(grown(25), [MILL3]);
// Победа.
const PAGODA = boss(22, 'pagoda', 5);
const VICTORY_VALLEY = syncLandmarks(grown(25), [PAGODA]);

export function ValleyLandmarksSection() {
  return (
    <section>
      <h2>Сооружения боссов в долине</h2>
      <p class="muted">
        Конечный босс ставит своё сооружение на одно из {LANDMARK_SITES.length} мест долины — свободное, ближе к лагерю.
        Растения там больше не сажаются. Общий туман отходит, сооружение стоит под своим туманом, который редеет с каждым
        подходом. После победы тумана нет. Отпущенный босс уходит из долины.
      </p>

      <h3 class="gallery__row-title">Все 11 сооружений, долина из 40 растений</h3>
      <div style={{ overflowX: 'auto' }}>
        <ValleyScene valley={BIG_VALLEY} bosses={ALL} fire="full" feathers={[]} cloakStage={0} fresh={null} style={scene(1.4)} />
      </div>
      <ol class="small">
        {ALL.map((b) => {
          const s = landmarkSite(BIG_VALLEY, b.id);
          return (
            <li key={b.id}>
              {LANDMARK_NAMES[b.place.landmark!]} — {stageText(b)}
              {s ? `, место ${LANDMARK_SITES.indexOf(s) + 1}` : ', мест нет'}
            </li>
          );
        })}
      </ol>

      <h3 class="gallery__row-title">Анимации (панорама как на главном экране)</h3>
      <div class="gallery__phones">
        <Replay title="Новый босс в молодой долине: туман отходит" valley={YOUNG_WITH} bosses={[FIRST]} fresh={FIRST.id} />
        <Replay title="Четвёртый подход: туман редеет" valley={SESSION_VALLEY} bosses={[MILL4]} fresh={MILL4.id} />
        <Replay title="Победа: туман рассеивается" valley={VICTORY_VALLEY} bosses={[winBoss(PAGODA, NOW)]} fresh={PAGODA.id} />
      </div>
    </section>
  );
}
