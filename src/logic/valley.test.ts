import { describe, expect, it } from 'vitest';
import { DEFAULT_TASKS } from '../data/default-tasks';
import { createPlayer } from '../model/player';
import type { BranchXp, ValleyState } from '../model/types';
import { completeInstantTask, ensureBoard, finishTimedTask, plantFromInventory, returnOverduePigeons, sendPigeon, startTimedTask, type GameState } from './game';
import { createLoft } from './pigeons';
import type { Completion } from './rewards';
import { createRng } from './rng';
import { BALANCE } from '../config/balance';
import {
  addCampItem,
  CAPACITY,
  canPlantItem,
  chooseSlot,
  emptyValley,
  isDistrictOpen,
  mistFrontier,
  plantForCompletion,
  plantChoices,
  plantItem,
  plantKindFor,
  plantSize,
  sceneOf,
  valleyFromXp,
} from './valley';
import { CAMP_SPOTS, DECOR_ANCHORS, MIST_START_X, riverWidth, riverX, SLOTS, WORLD } from './valley-district';

const NOW = new Date(2026, 10, 23, 12, 0).getTime();
const MIN = 60_000;
const timed = (minutes: number, branch: Completion['branch'] = 'image', full = true): Completion => ({ kind: 'timed', branch, minutes, full });

/** Долина, где заняты все места. */
function fullValley(): ValleyState {
  let v = emptyValley();
  for (let i = 0; i < CAPACITY; i++) v = plantForCompletion(v, timed(5), NOW + i, createRng(i))!.valley;
  return v;
}

describe('район', () => {
  it('около 120 мест, все разные и внутри панорамы', () => {
    expect(CAPACITY).toBeGreaterThanOrEqual(100);
    expect(CAPACITY).toBeLessThanOrEqual(140);
    expect(new Set(SLOTS.map((s) => `${s.x}:${s.y}`)).size).toBe(CAPACITY);
    for (const s of SLOTS) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(WORLD.width);
      expect(s.y).toBeLessThan(WORLD.height);
    }
  });

  it('в реке ничего не растёт', () => {
    for (const s of SLOTS) expect(Math.abs(s.x - riverX(s.y))).toBeGreaterThan(riverWidth(s.y) / 2);
  });

  it('места открываются от лагеря вправо', () => {
    const firstTen = SLOTS.slice(0, 10).map((s) => s.x);
    const lastTen = SLOTS.slice(-10).map((s) => s.x);
    expect(Math.max(...firstTen)).toBeLessThan(Math.min(...lastTen));
  });
});

describe('что вырастает', () => {
  it('порода — по ветке, Разведка растит цветы и кусты', () => {
    expect(plantKindFor('chronicle', 'large')).toBe('oak');
    expect(plantKindFor('image', 'small')).toBe('birch');
    expect(plantKindFor('speech', 'medium')).toBe('willow');
    expect(plantKindFor('hunt', 'small')).toBe('pine');
    expect(plantKindFor('scouting', 'small')).toBe('flowers');
    expect(plantKindFor('scouting', 'large')).toBe('bush');
  });

  it('размер — по длительности: до 5 минут и мгновенные — маленькое, 10–15 — среднее, 25+ — большое', () => {
    expect(plantSize(timed(5))).toBe('small');
    expect(plantSize({ kind: 'instant', branch: 'chronicle', instant: 'journal' })).toBe('small');
    expect(plantSize(timed(10))).toBe('medium');
    expect(plantSize(timed(15))).toBe('medium');
    expect(plantSize(timed(25))).toBe('large');
    expect(plantSize(timed(60))).toBe('large');
    // «Закончила раньше» — по засчитанным минутам.
    expect(plantSize(timed(7, 'image', false))).toBe('small');
  });

  it('растение занимает свободное место, сид стабилен при том же генераторе', () => {
    const a = plantForCompletion(emptyValley(), timed(30, 'chronicle'), NOW, createRng(5))!;
    const b = plantForCompletion(emptyValley(), timed(30, 'chronicle'), NOW, createRng(5))!;
    expect(a.plant).toEqual(b.plant);
    expect(a.plant).toMatchObject({ kind: 'oak', size: 'large', branch: 'chronicle', plantedAt: NOW });
    const next = plantForCompletion(a.valley, timed(30, 'chronicle'), NOW + 1, createRng(6))!;
    expect(next.plant.slot).not.toBe(a.plant.slot);
  });

  it('ива ищет место у реки, сосна — на дальних холмах', () => {
    // Туман отступил до реки: среди ближайших свободных мест есть и речные, и дальние.
    let v = emptyValley();
    for (let i = 0; i < 25; i++) v = plantForCompletion(v, timed(5, 'chronicle'), NOW + i, createRng(i))!.valley;
    const willow = SLOTS[chooseSlot(v, 'willow')!]!;
    const pine = SLOTS[chooseSlot(v, 'pine')!]!;
    const toRiver = (s: { x: number; y: number }) => Math.abs(s.x - riverX(s.y));
    expect(toRiver(willow)).toBeLessThan(90);
    expect(pine.band).toBe('far');
  });

  it('район полон — растения больше не сажаются', () => {
    const v = fullValley();
    expect(v.plants).toHaveLength(CAPACITY);
    expect(new Set(v.plants.map((p) => p.slot)).size).toBe(CAPACITY);
    expect(isDistrictOpen(v)).toBe(true);
    expect(plantForCompletion(v, timed(30), NOW, createRng(1))).toBeNull();
  });
});

describe('туман', () => {
  it('сначала открыт только лагерь, с каждым растением туман отступает, полный район — тумана нет', () => {
    let v = emptyValley();
    expect(mistFrontier(v)).toBe(MIST_START_X);
    let last = mistFrontier(v);
    for (let i = 0; i < 40; i++) {
      v = plantForCompletion(v, timed(15, 'hunt'), NOW + i, createRng(i))!.valley;
      const x = mistFrontier(v);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
    expect(last).toBeGreaterThan(MIST_START_X);
    // Все растения — в открытой части.
    for (const p of sceneOf(v).plants) expect(p.x).toBeLessThan(mistFrontier(v));
    expect(mistFrontier(fullValley())).toBeGreaterThan(WORLD.width);
  });
});

describe('семена и редкости', () => {
  it('семя сажается на свободное место, редкость места растений не занимает', () => {
    const seed = plantItem(emptyValley(), 'rowan', NOW, createRng(1))!;
    expect(seed.valley.plants).toHaveLength(1);
    expect(seed.object).toMatchObject({ kind: 'rowan', size: 'medium' });
    const deer = plantItem(seed.valley, 'deer', NOW, createRng(2))!;
    expect(deer.valley.plants).toHaveLength(1);
    expect(deer.valley.decor).toHaveLength(1);
  });

  it('редкости одного вида встают на разные места, по кругу', () => {
    let v = emptyValley();
    const anchors: number[] = [];
    for (let i = 0; i < DECOR_ANCHORS.deer.length + 1; i++) {
      const r = plantItem(v, 'deer', NOW + i, createRng(i))!;
      v = r.valley;
      anchors.push((r.object as { anchor: number }).anchor);
    }
    expect(anchors).toEqual([0, 1, 2, 0]);
    expect(sceneOf(v).decor.map((d) => d.layer)).toEqual([0, 0, 0, 1]);
  });

  it('вторая радуга — двойная', () => {
    let v = plantItem(emptyValley(), 'rainbow', NOW, createRng(1))!.valley;
    v = plantItem(v, 'rainbow', NOW + 1, createRng(2))!.valley;
    expect(sceneOf(v).decor.map((d) => d.layer)).toEqual([0, 1]);
  });

  it('место для семени: свободные места в открытой части, у края тумана — не меньше нескольких', () => {
    // Пустая долина: открыт только лагерь, свободные места — левее края тумана.
    const empty = plantChoices(emptyValley());
    expect(empty.length).toBeGreaterThanOrEqual(BALANCE.valley.minChoices);
    for (const i of empty) expect(SLOTS[i]!.x).toBeLessThan(MIST_START_X);

    let v = emptyValley();
    for (let i = 0; i < 30; i++) v = plantForCompletion(v, timed(5), NOW + i, createRng(i))!.valley;
    const taken = new Set(v.plants.map((p) => p.slot));
    const choices = plantChoices(v);
    expect(choices.length).toBeGreaterThanOrEqual(BALANCE.valley.minChoices);
    for (const i of choices) expect(taken.has(i)).toBe(false);
    expect(plantChoices(fullValley())).toEqual([]);
  });

  it('семя сажается на выбранное место; занятое или чужое место не подходит', () => {
    const v = plantForCompletion(emptyValley(), timed(5), NOW, createRng(1))!.valley;
    const [first, , third] = plantChoices(v);
    const r = plantItem(v, 'sunflower', NOW, createRng(2), third)!;
    expect(r.object).toMatchObject({ kind: 'sunflower', slot: third });
    expect(plantItem(r.valley, 'rowan', NOW, createRng(3), third)).toBeNull();
    expect(plantItem(v, 'rowan', NOW, createRng(3), v.plants[0]!.slot)).toBeNull();
    expect(plantItem(v, 'rowan', NOW, createRng(3), 9999)).toBeNull();
    // Цветы из лавки — тоже саженец.
    expect(plantItem(v, 'flowers', NOW, createRng(3), first)?.object).toMatchObject({ kind: 'flowers', slot: first });
    // Растения веток семенами не бывают.
    expect(plantItem(v, 'oak', NOW, createRng(3), first)).toBeNull();
  });

  it('вещи лагеря стоят на своих местах, каждая одна', () => {
    const v = addCampItem(emptyValley(), 'kettle')!;
    expect(addCampItem(v, 'kettle')).toBeNull();
    expect(sceneOf(v).camp).toEqual([{ kind: 'kettle', ...CAMP_SPOTS.kettle }]);
  });

  it('в полном районе семени негде расти, а редкость поставить можно', () => {
    const v = fullValley();
    expect(canPlantItem(v, 'apple')).toBe(false);
    expect(plantItem(v, 'apple', NOW, createRng(1))).toBeNull();
    expect(canPlantItem(v, 'fireflies')).toBe(true);
    expect(plantItem(v, 'unknown', NOW, createRng(1))).toBeNull();
  });
});

describe('долина для уже сыгранного', () => {
  const xp = (x: Partial<BranchXp>): BranchXp => ({ chronicle: 0, image: 0, speech: 0, scouting: 0, hunt: 0, ...x });

  it('по растению на каждые 15 опыта ветки, вперемешку', () => {
    const v = valleyFromXp(xp({ chronicle: 45, hunt: 20, scouting: 14 }), createRng(1));
    expect(v.plants.map((p) => p.kind).sort()).toEqual(['oak', 'oak', 'oak', 'pine']);
    expect(v.plants.slice(0, 2).map((p) => p.kind)).toEqual(['oak', 'pine']);
    expect(v.plants.every((p) => p.size === 'medium' && p.plantedAt === 0)).toBe(true);
    expect(new Set(v.plants.map((p) => p.id)).size).toBe(v.plants.length);
  });

  it('без опыта — пустая долина; очень много опыта — не больше района', () => {
    expect(valleyFromXp(xp({}), createRng(1))).toEqual(emptyValley());
    expect(valleyFromXp(xp({ hunt: 100_000 }), createRng(1)).plants).toHaveLength(CAPACITY);
  });
});

describe('долина в игре', () => {
  const PHRASE = () => 0; // карта «фраза + 5 золота»
  const byId = new Map(DEFAULT_TASKS.map((t) => [t.id, t]));

  function newGame(): GameState {
    return ensureBoard(
      { player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() },
      DEFAULT_TASKS,
      NOW,
      createRng(1),
    );
  }

  it('мгновенное задание выращивает растение своей ветки', () => {
    const journal = DEFAULT_TASKS.find((t) => t.kind === 'instant' && t.instant === 'journal')!;
    const r = completeInstantTask(newGame(), journal, DEFAULT_TASKS, NOW, PHRASE);
    expect(r.state.valley.plants).toHaveLength(1);
    expect(r.done.planted).toMatchObject({ kind: 'oak', size: 'small', branch: 'chronicle' });
    expect(r.done.districtOpened).toBe(false);
  });

  it('таймерное задание — растение по минутам; «закончила раньше» — по засчитанным', () => {
    const t = [...byId.values()].find((x) => x.kind === 'timed' && x.minutes === 30)!;
    if (t.kind !== 'timed') throw new Error();
    const g = startTimedTask(newGame(), { templateId: t.id, title: t.title, branch: t.branch, minutes: 30 }, NOW);
    const full = finishTimedTask(g, DEFAULT_TASKS, NOW + 30 * MIN, PHRASE)!;
    expect(full.done.planted?.size).toBe('large');
    const early = finishTimedTask(g, DEFAULT_TASKS, NOW + 12 * MIN, PHRASE)!;
    expect(early.done.planted?.size).toBe('medium');
  });

  it('голубь улетел — маленькая сосна', () => {
    const r = sendPigeon(newGame(), createLoft(createRng(1)), 0, 'Ромашка', NOW, PHRASE, 'p1');
    expect(r.done.planted).toMatchObject({ kind: 'pine', size: 'small', branch: 'hunt' });
  });

  it('возврат голубя — не задание: растений не прибавляется', () => {
    const g = newGame();
    const p = { id: 'p', company: 'К', look: { pose: 'sit', size: 'small', color: 'white' }, sentAt: NOW, status: 'flying' } as const;
    const r = returnOverduePigeons(g, [p], NOW + 20 * 86_400_000);
    expect(r.feathers).toHaveLength(1);
    expect(r.state.valley).toBe(g.valley);
  });

  it('«Посадить» сажает предмет из запаса и убирает его оттуда', () => {
    const g: GameState = { ...newGame(), player: { ...createPlayer(), inventory: ['deer', 'apple', 'deer'] } };
    const r = plantFromInventory(g, 'deer', NOW, createRng(1))!;
    expect(r.state.player.inventory).toEqual(['apple', 'deer']);
    expect(r.state.valley.decor).toHaveLength(1);
    expect(plantFromInventory(g, 'rowan', NOW, createRng(1))).toBeNull();
    const full: GameState = { ...g, valley: fullValley() };
    expect(plantFromInventory(full, 'apple', NOW, createRng(1))).toBeNull();
  });

  it('семя из запаса — на выбранное место; неподходящее место оставляет семя в запасе', () => {
    const g: GameState = { ...newGame(), player: { ...createPlayer(), inventory: ['apple'] } };
    const slot = plantChoices(g.valley).at(-1)!;
    const r = plantFromInventory(g, 'apple', NOW, createRng(1), slot)!;
    expect(r.object).toMatchObject({ kind: 'apple', slot });
    expect(r.state.player.inventory).toEqual([]);
    expect(plantFromInventory(r.state, 'apple', NOW, createRng(1), slot)).toBeNull();
    expect(plantFromInventory(g, 'apple', NOW, createRng(1), 9999)).toBeNull();
  });

  it('последнее место в районе — долина открыта', () => {
    let v = emptyValley();
    for (let i = 0; i < CAPACITY - 1; i++) v = plantForCompletion(v, timed(5), NOW + i, createRng(i))!.valley;
    const journal = DEFAULT_TASKS.find((t) => t.kind === 'instant' && t.instant === 'journal')!;
    const r = completeInstantTask({ ...newGame(), valley: v }, journal, DEFAULT_TASKS, NOW, PHRASE);
    expect(r.done.districtOpened).toBe(true);
    const after = completeInstantTask(r.state, journal, DEFAULT_TASKS, NOW + 1, PHRASE);
    expect(after.done.planted).toBeNull();
    expect(after.done.districtOpened).toBe(false);
  });
});
