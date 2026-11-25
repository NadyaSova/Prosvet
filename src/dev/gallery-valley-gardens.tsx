// Галерея: места бесконечных боссов в долине (фаза 2, шаг 8) — где встают, как растут с подходами,
// что с растениями на их месте; анимации: новый босс, подход.

import { useState } from 'preact/hooks';
import { addSession, archiveBoss, createBoss, startStopwatch } from '../logic/bosses';
import type { Completion } from '../logic/rewards';
import { createRng } from '../logic/rng';
import { emptyValley, gardenSite, plantForCompletion, syncBossPlaces } from '../logic/valley';
import { FRONT_GARDEN_SITES, GARDEN_SITES, WORLD } from '../logic/valley-district';
import { BRANCHES, LANDMARK_KINDS, type Boss, type GardenKind, type ValleyState } from '../model/types';
import { plural } from '../ui/format';
import { GARDEN_NAMES } from '../ui/valley/garden-art';
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

function withSessions(b: Boss, sessions: number): Boss {
  let x = b;
  for (let k = 0; k < sessions; k++) x = addSession(startStopwatch(x, NOW - (sessions - k) * DAY), 30);
  return x;
}

function garden(i: number, kind: GardenKind, sessions: number): Boss {
  const b = createBoss([], { title: GARDEN_NAMES[kind], kind: 'endless', branch: 'scouting' }, NOW - (80 - i) * DAY, createRng(i + 3), `g${i}`);
  return withSessions({ ...b, place: { ...b.place, garden: kind } }, sessions);
}

function landmark(i: number, sessions: number): Boss {
  const b = createBoss([], { title: 'Сооружение', kind: 'finite', branch: 'prep' }, NOW - (80 - i) * DAY, createRng(i + 50), `l${i}`);
  return withSessions({ ...b, place: { ...b.place, landmark: LANDMARK_KINDS[i % LANDMARK_KINDS.length]! } }, sessions);
}

function stageText(b: Boss): string {
  const n = b.sessions.length;
  const text = n === 0 ? 'только что заведён' : `${n} ${plural(n, ['подход', 'подхода', 'подходов'])}`;
  return b.status === 'archived' ? `${text}, в архиве` : text;
}

const scene = (scale: number) => ({ width: `${WORLD.width * scale}px`, height: `${SCENE_HEIGHT * scale}px` });

/** Четыре места на ближней полосе — все виды, на разных подходах; одно в архиве. Плюс три сооружения. */
const FOUR = [garden(0, 'pond', 7), garden(1, 'meadow', 18), garden(2, 'flowerbed', 3), archiveBoss(garden(3, 'apiary', 34), NOW)];
const FOUR_LANDMARKS = [landmark(10, 2), landmark(11, 5), landmark(12, 0)];
const FOUR_VALLEY = syncBossPlaces(grown(30), [...FOUR, ...FOUR_LANDMARKS]);

/** Тесная долина: восемь мест и шесть сооружений — места на холмах делят землю с сооружениями. */
const KINDS: GardenKind[] = ['pond', 'flowerbed', 'apiary', 'meadow'];
const CROWD = [
  ...Array.from({ length: 8 }, (_, i) => garden(20 + i, KINDS[i % 4]!, 4 + i * 3)),
  ...Array.from({ length: 6 }, (_, i) => landmark(30 + i, i)),
].sort((a, b) => a.createdAt - b.createdAt);
const CROWD_VALLEY = syncBossPlaces(grown(20), CROWD);

/** Выросшая долина до и после нового места: растения с пятна пересаживаются. */
const FULLISH = grown(95);
const NEW_IN_FULLISH = garden(40, 'pond', 0);
const AFTER_FULLISH = syncBossPlaces(FULLISH, [NEW_IN_FULLISH]);
const MOVED = FULLISH.plants.filter((p) => AFTER_FULLISH.plants.find((q) => q.id === p.id)!.slot !== p.slot).length;

function Placed({ valley, bosses }: { valley: ValleyState; bosses: Boss[] }) {
  return (
    <ol class="small">
      {bosses.map((b) => {
        if (b.kind === 'finite') {
          const placed = valley.landmarks.find((l) => l.bossId === b.id);
          return <li key={b.id}>Сооружение — {placed ? `место сооружения ${placed.site + 1}` : 'ждёт места'}</li>;
        }
        const s = gardenSite(valley, b.id);
        const i = s ? GARDEN_SITES.indexOf(s) : -1;
        const where = i < 0 ? 'ждёт места' : i < FRONT_GARDEN_SITES ? `ближняя полоса, место ${i + 1}` : `холм, место ${i + 1}`;
        return (
          <li key={b.id}>
            {GARDEN_NAMES[b.place.garden!]} — {stageText(b)}, {where}
          </li>
        );
      })}
    </ol>
  );
}

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

// Молодая долина: первое место.
const YOUNG = grown(12);
const FIRST = garden(50, 'meadow', 0);
const YOUNG_WITH = syncBossPlaces(YOUNG, [FIRST]);
// Подходы: новый элемент, пятый — особый.
const POND3 = garden(51, 'pond', 3);
const POND4 = withSessions(POND3, 1);
const POND5 = withSessions(POND4, 1);
const SESSION_VALLEY = syncBossPlaces(grown(25), [POND3]);
const BED = garden(52, 'flowerbed', 9);
const BED10 = withSessions(BED, 1);
const BED_VALLEY = syncBossPlaces(grown(25), [BED]);

export function ValleyGardensSection() {
  return (
    <section>
      <h2>Места бесконечных боссов в долине</h2>
      <p class="muted">
        Бесконечный босс ставит своё место в долину навсегда — и в архиве оно остаётся. Сначала занимаются{' '}
        {FRONT_GARDEN_SITES} места на ближней полосе земли: там они не мешают сооружениям. Потом — {GARDEN_SITES.length - FRONT_GARDEN_SITES}{' '}
        мест на холмах, их земля общая с сооружениями: что заведено раньше, то и встаёт. Каждый подход — новый элемент, он
        проявляется в долине. Растения с пятна места пересаживаются на свободные места.
      </p>

      <h3 class="gallery__row-title">Четыре места и три сооружения, долина из 30 растений</h3>
      <div style={{ overflowX: 'auto' }}>
        <ValleyScene valley={FOUR_VALLEY} bosses={[...FOUR, ...FOUR_LANDMARKS]} fire="full" feathers={[]} cloakStage={0} fresh={null} style={scene(1.4)} />
      </div>
      <Placed valley={FOUR_VALLEY} bosses={[...FOUR, ...FOUR_LANDMARKS]} />

      <h3 class="gallery__row-title">Тесная долина: восемь мест и шесть сооружений</h3>
      <div style={{ overflowX: 'auto' }}>
        <ValleyScene valley={CROWD_VALLEY} bosses={CROWD} fire="full" feathers={[]} cloakStage={0} fresh={null} style={scene(1.4)} />
      </div>
      <Placed valley={CROWD_VALLEY} bosses={CROWD} />

      <h3 class="gallery__row-title">Выросшая долина ({FULLISH.plants.length} растений): до нового места и после</h3>
      <p class="muted small">Пересажено растений: {MOVED}.</p>
      <div style={{ overflowX: 'auto' }}>
        <ValleyScene valley={FULLISH} fire="full" feathers={[]} cloakStage={0} fresh={null} style={scene(1)} />
        <ValleyScene valley={AFTER_FULLISH} bosses={[NEW_IN_FULLISH]} fire="full" feathers={[]} cloakStage={0} fresh={null} style={scene(1)} />
      </div>

      <h3 class="gallery__row-title">Анимации (панорама как на главном экране)</h3>
      <div class="gallery__phones">
        <Replay title="Новый босс в молодой долине: туман отходит, место проявляется" valley={YOUNG_WITH} bosses={[FIRST]} fresh={FIRST.id} />
        <Replay title="Четвёртый подход: новая рыбка" valley={SESSION_VALLEY} bosses={[POND4]} fresh={POND4.id} />
        <Replay title="Пятый подход: особый элемент" valley={SESSION_VALLEY} bosses={[POND5]} fresh={POND5.id} />
        <Replay title="Десятый подход в цветнике" valley={BED_VALLEY} bosses={[BED10]} fresh={BED10.id} />
      </div>
    </section>
  );
}
