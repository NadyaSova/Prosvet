// Сооружения конечных боссов в долине: docs/phase2-plan.md §5.2, шаг 7 фазы 2.
import { describe, expect, it } from 'vitest';
import type { Boss, ValleyState } from '../model/types';
import { normalizeValley } from '../storage/normalize';
import { addSession, createBoss, releaseBoss, startStopwatch, winBoss } from './bosses';
import type { Completion } from './rewards';
import { createRng } from './rng';
import {
  CAPACITY,
  blockedSlots,
  chooseSlot,
  districtCapacity,
  emptyValley,
  isDistrictOpen,
  landmarkSite,
  mistFrontier,
  plantChoices,
  plantForCompletion,
  sceneOf,
  syncLandmarks,
} from './valley';
import { LANDMARK_SITES, landmarkHalfWidth, riverWidth, riverX, slotsUnder, SLOTS, WORLD } from './valley-district';

const NOW = new Date(2026, 10, 25, 12, 0).getTime();
const DAY = 86_400_000;
const timed = (minutes: number): Completion => ({ kind: 'timed', branch: 'call', minutes, full: true });

let seq = 0;
function finite(bosses: Boss[] = [], at = NOW + seq): Boss {
  const id = `f${seq++}`;
  return createBoss(bosses, { title: id, kind: 'finite', branch: 'prep' }, at, createRng(seq), id);
}

function withSessions(b: Boss, n: number): Boss {
  let x = b;
  for (let i = 0; i < n; i++) x = addSession(startStopwatch(x, NOW + i * DAY), 20);
  return x;
}

function grow(v: ValleyState, n: number): ValleyState {
  let x = v;
  for (let i = 0; i < n; i++) x = plantForCompletion(x, timed(5), NOW + i, createRng(i))?.valley ?? x;
  return x;
}

describe('места сооружений', () => {
  it('внутри панорамы, в стороне от реки, соседние не перекрываются', () => {
    expect(LANDMARK_SITES.length).toBeGreaterThanOrEqual(11);
    for (const s of LANDMARK_SITES) {
      const half = s.size * 0.6;
      expect(s.x - half).toBeGreaterThan(0);
      expect(s.x + half).toBeLessThan(WORLD.width);
      expect(Math.abs(s.x - riverX(s.y))).toBeGreaterThan(half + riverWidth(s.y) / 2);
    }
    for (let i = 1; i < LANDMARK_SITES.length; i++) {
      const a = LANDMARK_SITES[i - 1]!;
      const b = LANDMARK_SITES[i]!;
      expect(b.x - a.x).toBeGreaterThan(a.size * 0.6 + b.size * 0.6);
    }
  });

  it('дальнее сооружение меньше ближнего', () => {
    const [mid, near] = [LANDMARK_SITES[0]!, LANDMARK_SITES[1]!];
    expect(mid.y).toBeLessThan(near.y);
    expect(mid.size).toBeLessThan(near.size);
  });

  it('каждое место закрывает несколько мест растений, а не полдолины', () => {
    for (const s of LANDMARK_SITES) {
      const under = slotsUnder(s);
      expect(under.length).toBeGreaterThan(0);
      expect(under.length).toBeLessThan(10);
    }
  });
});

describe('сооружение встаёт в долину', () => {
  it('новый конечный босс — на свободное место ближе к лагерю', () => {
    const b = finite();
    const v = syncLandmarks(emptyValley(), [b]);
    expect(v.landmarks).toEqual([{ bossId: b.id, site: 0 }]);
    expect(landmarkSite(v, b.id)).toBe(LANDMARK_SITES[0]);
  });

  it('ничего не изменилось — та же долина', () => {
    const b = finite();
    const v = syncLandmarks(emptyValley(), [b]);
    expect(syncLandmarks(v, [withSessions(b, 2)])).toBe(v);
    const empty = emptyValley();
    expect(syncLandmarks(empty, [])).toBe(empty);
  });

  it('бесконечный босс сооружения не ставит', () => {
    const e = createBoss([], { title: 'Тема', kind: 'endless', branch: 'scouting' }, NOW, createRng(1), 'e');
    expect(syncLandmarks(emptyValley(), [e]).landmarks).toEqual([]);
  });

  it('место — там, где сооружение закрыло бы меньше растений', () => {
    const v0 = grow(emptyValley(), 30);
    const b = finite();
    const v = syncLandmarks(v0, [b]);
    const site = LANDMARK_SITES[v.landmarks[0]!.site]!;
    const taken = new Set(v0.plants.map((p) => p.slot));
    expect(slotsUnder(site).filter((i) => taken.has(i))).toEqual([]);
  });

  it('у двух боссов — разные места; по порядку создания', () => {
    const a = finite([], NOW);
    const b = finite([a], NOW + 1);
    const v = syncLandmarks(emptyValley(), [b, a]);
    expect(v.landmarks.map((l) => l.bossId)).toEqual([a.id, b.id]);
    expect(new Set(v.landmarks.map((l) => l.site)).size).toBe(2);
  });

  it('победа — сооружение остаётся; «отпустить» — уходит, место свободно', () => {
    const a = finite();
    const v = syncLandmarks(emptyValley(), [a]);
    expect(syncLandmarks(v, [winBoss(a, NOW)])).toBe(v);
    const released = syncLandmarks(v, [releaseBoss(a, NOW)]);
    expect(released.landmarks).toEqual([]);
    const next = finite();
    expect(syncLandmarks(released, [releaseBoss(a, NOW), next]).landmarks).toEqual([{ bossId: next.id, site: 0 }]);
  });

  it('все места заняты — сооружение ждёт, пока место освободится', () => {
    const bosses: Boss[] = [];
    for (let i = 0; i <= LANDMARK_SITES.length; i++) bosses.push(finite(bosses, NOW + i));
    let v = syncLandmarks(emptyValley(), bosses);
    const last = bosses.at(-1)!;
    expect(v.landmarks).toHaveLength(LANDMARK_SITES.length);
    expect(landmarkSite(v, last.id)).toBeUndefined();
    bosses[0] = releaseBoss(bosses[0]!, NOW);
    v = syncLandmarks(v, bosses);
    expect(landmarkSite(v, last.id)).toBe(LANDMARK_SITES[0]);
  });
});

describe('долина вокруг сооружения', () => {
  it('под сооружением не сажают', () => {
    const v = syncLandmarks(emptyValley(), [finite()]);
    const blocked = blockedSlots(v);
    expect(blocked.size).toBeGreaterThan(0);
    for (const i of plantChoices(v)) expect(blocked.has(i)).toBe(false);
    let x = v;
    for (let i = 0; i < CAPACITY; i++) {
      const r = plantForCompletion(x, timed(5), NOW + i, createRng(i));
      if (!r) break;
      expect(blocked.has(r.plant.slot)).toBe(false);
      x = r.valley;
    }
    expect(chooseSlot(x, 'oak')).toBeNull();
    expect(isDistrictOpen(x)).toBe(true);
    expect(x.plants.length).toBe(CAPACITY - blocked.size);
    expect(districtCapacity(x)).toBe(CAPACITY - blocked.size);
  });

  it('сооружение стоит на открытой земле: общий туман за ним', () => {
    const v0 = grow(emptyValley(), 40);
    const v = syncLandmarks(v0, [finite()]);
    const site = landmarkSite(v, v.landmarks[0]!.bossId)!;
    expect(mistFrontier(v)).toBeGreaterThanOrEqual(site.x + landmarkHalfWidth(site));
  });

  it('туман над сооружением редеет с подходами, после победы его нет', () => {
    const b = finite();
    const v = syncLandmarks(emptyValley(), [b]);
    const fresh = sceneOf(v, [b]).landmarks[0]!;
    expect(fresh).toMatchObject({ bossId: b.id, kind: b.place.landmark, seed: b.place.seed, fog: 1, fogBefore: 1, won: false, sessions: 0 });
    const three = sceneOf(v, [withSessions(b, 3)]).landmarks[0]!;
    expect(three.fog).toBeLessThan(three.fogBefore);
    expect(three.fogBefore).toBeLessThan(1);
    const won = sceneOf(v, [winBoss(withSessions(b, 3), NOW)]).landmarks[0]!;
    expect(won).toMatchObject({ fog: 0, won: true });
    expect(won.fogBefore).toBe(three.fog);
  });

  it('без боссов сооружений в картине нет', () => {
    const v = syncLandmarks(emptyValley(), [finite()]);
    expect(sceneOf(v).landmarks).toEqual([]);
  });

  it('места сооружений — не места растений из списка SLOTS', () => {
    for (const s of LANDMARK_SITES) expect(SLOTS.some((p) => p.x === s.x && p.y === s.y)).toBe(false);
  });
});

describe('хранение', () => {
  it('старая долина без сооружений читается с пустым списком', () => {
    expect(normalizeValley({ plants: [], decor: [] })?.landmarks).toEqual([]);
  });

  it('испорченные записи и повторы отбрасываются', () => {
    const v = normalizeValley({
      plants: [],
      decor: [],
      landmarks: [
        { bossId: 'a', site: 0 },
        { bossId: 'b', site: 0 },
        { bossId: 'a', site: 2 },
        { bossId: 'c', site: 99 },
        { bossId: 'd', site: 1.5 },
        { site: 3 },
        { bossId: 'e', site: 4 },
      ],
    });
    expect(v?.landmarks).toEqual([
      { bossId: 'a', site: 0 },
      { bossId: 'e', site: 4 },
    ]);
  });
});
