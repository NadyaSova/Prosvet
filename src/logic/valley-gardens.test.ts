// Места бесконечных боссов в долине: docs/phase2-plan.md §5.3, шаг 8 фазы 2.
import { describe, expect, it } from 'vitest';
import type { Boss, ValleyState } from '../model/types';
import { normalizeValley } from '../storage/normalize';
import { addSession, archiveBoss, createBoss, gardenView, startStopwatch } from './bosses';
import type { Completion } from './rewards';
import { createRng } from './rng';
import {
  blockedSlots,
  districtCapacity,
  emptyValley,
  gardenSite,
  isDistrictOpen,
  mistFrontier,
  plantChoices,
  plantForCompletion,
  sceneOf,
  syncBossPlaces,
} from './valley';
import {
  CAMP,
  DECOR_ANCHORS,
  FRONT_GARDEN_SITES,
  GARDEN_SITES,
  gardenBlocksLandmark,
  gardenHalfWidth,
  gardenPatch,
  gardensOverlap,
  hillTop,
  LANDMARK_SITES,
  riverWidth,
  riverX,
  slotsUnderGarden,
  WORLD,
} from './valley-district';

const NOW = new Date(2026, 10, 25, 12, 0).getTime();
const DAY = 86_400_000;
const timed = (minutes: number): Completion => ({ kind: 'timed', branch: 'call', minutes, full: true });

let seq = 0;
function endless(bosses: Boss[] = [], at = NOW + seq): Boss {
  const id = `e${seq++}`;
  return createBoss(bosses, { title: id, kind: 'endless', branch: 'scouting' }, at, createRng(seq), id);
}

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
  for (let i = 0; i < n; i++) x = plantForCompletion(x, timed(30), NOW + i, createRng(i))?.valley ?? x;
  return x;
}

const front = Array.from({ length: FRONT_GARDEN_SITES }, (_, i) => i);
const hills = Array.from({ length: GARDEN_SITES.length - FRONT_GARDEN_SITES }, (_, i) => i + FRONT_GARDEN_SITES);

describe('места в долине', () => {
  it('внутри панорамы, в стороне от реки и лагеря, больше четырёх', () => {
    expect(GARDEN_SITES.length).toBeGreaterThan(4);
    for (const s of GARDEN_SITES) {
      const p = gardenPatch(s);
      expect(p.cx - p.rx).toBeGreaterThan(0);
      expect(p.cx + p.rx).toBeLessThan(WORLD.width);
      for (const y of [p.cy - p.ry, p.cy, p.cy + p.ry]) expect(Math.abs(p.cx - riverX(y))).toBeGreaterThan(p.rx + riverWidth(y) / 2);
      if (s.y > 200) expect(p.cx - p.rx).toBeGreaterThan(CAMP.fireX + 40);
    }
  });

  it('у переднего края размер 80, на холмах меньше; пятно на холме не вылезает за его гребень', () => {
    for (const i of front) expect(GARDEN_SITES[i]!.size).toBe(80);
    for (const i of hills) {
      const s = GARDEN_SITES[i]!;
      const p = gardenPatch(s);
      expect(s.size).toBeLessThan(70);
      expect(p.cy - p.ry).toBeGreaterThanOrEqual(hillTop('mid', s.x) - 1);
      expect(p.cy + p.ry).toBeLessThanOrEqual(hillTop('near', s.x));
    }
  });

  it('олень у воды и светлячки — не на пятне места', () => {
    for (const s of GARDEN_SITES) {
      const p = gardenPatch(s);
      for (const a of [...DECOR_ANCHORS.deer, ...DECOR_ANCHORS.fireflies]) {
        expect(((a.x - p.cx) / p.rx) ** 2 + ((a.y - p.cy) / p.ry) ** 2).toBeGreaterThan(1);
      }
    }
  });

  it('места на ближней полосе не мешают друг другу и сооружениям', () => {
    for (const i of front) {
      for (const j of front) expect(gardensOverlap(i, j)).toBe(false);
      for (let l = 0; l < LANDMARK_SITES.length; l++) expect(gardenBlocksLandmark(i, l)).toBe(false);
    }
  });

  it('соседние места на холмах не перекрываются', () => {
    for (let k = 1; k < hills.length; k++) expect(gardensOverlap(hills[k - 1]!, hills[k]!)).toBe(false);
  });

  it('каждое место закрывает несколько мест растений', () => {
    for (const s of GARDEN_SITES) {
      const n = slotsUnderGarden(s).length;
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(16);
    }
  });
});

describe('место встаёт в долину', () => {
  it('новый бесконечный босс — на ближнюю полосу; сооружения не ставит', () => {
    const b = endless();
    const v = syncBossPlaces(emptyValley(), [b]);
    expect(v.landmarks).toEqual([]);
    expect(v.gardens).toEqual([{ bossId: b.id, site: 0 }]);
    expect(gardenSite(v, b.id)).toBe(GARDEN_SITES[0]);
  });

  it('ничего не изменилось — та же долина; подход место не меняет', () => {
    const b = endless();
    const v = syncBossPlaces(emptyValley(), [b]);
    expect(syncBossPlaces(v, [withSessions(b, 3)])).toBe(v);
  });

  it('в архиве место остаётся', () => {
    const b = endless();
    const v = syncBossPlaces(emptyValley(), [b]);
    expect(syncBossPlaces(v, [archiveBoss(b, NOW)])).toBe(v);
  });

  it('сначала занимается ближняя полоса, потом холмы', () => {
    const bosses: Boss[] = [];
    for (let i = 0; i < FRONT_GARDEN_SITES + 1; i++) bosses.push(endless(bosses, NOW + i));
    const v = syncBossPlaces(emptyValley(), bosses);
    const sites = v.gardens.map((g) => g.site);
    expect(sites.slice(0, FRONT_GARDEN_SITES).sort()).toEqual(front);
    expect(sites[FRONT_GARDEN_SITES]).toBeGreaterThanOrEqual(FRONT_GARDEN_SITES);
  });

  it('место на холме и сооружение не встают друг на друга', () => {
    const bosses: Boss[] = [];
    for (let i = 0; i < GARDEN_SITES.length; i++) bosses.push(endless(bosses, NOW + i));
    for (let i = 0; i < LANDMARK_SITES.length; i++) bosses.push(finite(bosses, NOW + 100 + i));
    const v = syncBossPlaces(emptyValley(), bosses);
    for (const g of v.gardens) {
      for (const l of v.landmarks) expect(gardenBlocksLandmark(g.site, l.site)).toBe(false);
      for (const h of v.gardens) expect(gardensOverlap(g.site, h.site)).toBe(false);
    }
    // Мест не хватило всем — остальные ждут.
    expect(v.gardens.length + v.landmarks.length).toBeLessThan(bosses.length);
  });

  it('сооружение, заведённое раньше, не уступает место бесконечному', () => {
    const f = finite([], NOW);
    const bosses: Boss[] = [f];
    for (let i = 0; i < GARDEN_SITES.length; i++) bosses.push(endless(bosses, NOW + 1 + i));
    const v = syncBossPlaces(emptyValley(), bosses);
    const site = v.landmarks.find((l) => l.bossId === f.id)!.site;
    for (const g of v.gardens) expect(gardenBlocksLandmark(g.site, site)).toBe(false);
  });
});

describe('долина вокруг места', () => {
  it('под местом не сажают', () => {
    const v = syncBossPlaces(emptyValley(), [endless()]);
    const blocked = blockedSlots(v);
    for (const i of slotsUnderGarden(GARDEN_SITES[0]!)) expect(blocked.has(i)).toBe(true);
    for (const i of plantChoices(v)) expect(blocked.has(i)).toBe(false);
    let x = v;
    for (;;) {
      const r = plantForCompletion(x, timed(5), NOW, createRng(x.plants.length));
      if (!r) break;
      expect(blocked.has(r.plant.slot)).toBe(false);
      x = r.valley;
    }
    expect(isDistrictOpen(x)).toBe(true);
    expect(districtCapacity(x)).toBe(x.plants.length);
  });

  it('растения с пятна пересаживаются на свободные места, ничего не пропадает', () => {
    // Растения — на всех местах под местами ближней полосы и ещё несколько.
    const slots = [...new Set([...front.flatMap((i) => slotsUnderGarden(GARDEN_SITES[i]!)), 0, 1, 2])];
    const v0: ValleyState = {
      ...emptyValley(),
      plants: slots.map((slot, i) => ({ id: `p${i}`, kind: 'oak', size: 'medium', slot, seed: i, plantedAt: NOW + i })),
    };
    const v = syncBossPlaces(v0, [endless()]);
    const under = new Set(slotsUnderGarden(gardenSite(v, v.gardens[0]!.bossId)!));
    expect(v0.plants.some((p) => under.has(p.slot))).toBe(true);
    expect(v.plants.map((p) => p.id).sort()).toEqual(v0.plants.map((p) => p.id).sort());
    expect(v.plants.some((p) => under.has(p.slot))).toBe(false);
    expect(new Set(v.plants.map((p) => p.slot)).size).toBe(v.plants.length);
    // Остальные растения на своих местах, вид и сид не меняются.
    for (const p of v0.plants) {
      const q = v.plants.find((x) => x.id === p.id)!;
      expect({ ...q, slot: 0 }).toEqual({ ...p, slot: 0 });
      if (!under.has(p.slot)) expect(q.slot).toBe(p.slot);
    }
  });

  it('пересаживать некуда — растение остаётся и рисуется позади места', () => {
    const full = grow(emptyValley(), 200);
    expect(isDistrictOpen(full)).toBe(true);
    const b = endless();
    const v = syncBossPlaces(full, [b]);
    expect(v.plants).toEqual(full.plants);
    const scene = sceneOf(v, [b]);
    const g = scene.gardens[0]!;
    const under = new Set(slotsUnderGarden(g));
    const stuck = scene.plants.filter((p) => under.has(p.slot));
    expect(stuck.length).toBeGreaterThan(0);
    for (const p of stuck) expect(p.depth).toBeLessThan(g.back);
  });

  it('место на открытой земле: общий туман за ним', () => {
    const v = syncBossPlaces(emptyValley(), [endless()]);
    const s = GARDEN_SITES[v.gardens[0]!.site]!;
    expect(mistFrontier(v)).toBeGreaterThanOrEqual(s.x + gardenHalfWidth(s));
  });

  it('в картине — вид места, число элементов и как было до последнего подхода', () => {
    const b = endless();
    const v = syncBossPlaces(emptyValley(), [b]);
    const empty = sceneOf(v, [b]).gardens[0]!;
    expect(empty).toMatchObject({ bossId: b.id, kind: b.place.garden, seed: b.place.seed, sessions: 0, before: null });
    expect(empty.view).toEqual({ elements: 0, specials: 0, bloom: 0 });
    const five = withSessions(b, 5);
    const g = sceneOf(v, [five]).gardens[0]!;
    expect(g.view).toEqual(gardenView(five));
    expect(g.view).toMatchObject({ elements: 5, specials: 1 });
    expect(g.before).toEqual({ elements: 4, specials: 0, bloom: 0 });
  });

  it('без боссов мест в картине нет', () => {
    const v = syncBossPlaces(emptyValley(), [endless()]);
    expect(sceneOf(v).gardens).toEqual([]);
  });
});

describe('хранение', () => {
  it('старая долина без мест читается с пустым списком', () => {
    expect(normalizeValley({ plants: [], decor: [], landmarks: [] })?.gardens).toEqual([]);
  });

  it('испорченные записи и повторы отбрасываются; у босса одно место на всю долину', () => {
    const v = normalizeValley({
      plants: [],
      decor: [],
      landmarks: [{ bossId: 'f', site: 0 }],
      gardens: [
        { bossId: 'a', site: 0 },
        { bossId: 'b', site: 0 },
        { bossId: 'a', site: 2 },
        { bossId: 'c', site: 99 },
        { bossId: 'f', site: 3 },
        { bossId: 'e', site: 4 },
      ],
    });
    expect(v?.gardens).toEqual([
      { bossId: 'a', site: 0 },
      { bossId: 'e', site: 4 },
    ]);
    expect(v?.landmarks).toEqual([{ bossId: 'f', site: 0 }]);
  });
});
