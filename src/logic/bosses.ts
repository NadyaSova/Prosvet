// Боссы — большие задачи вне доски. docs/phase2-plan.md §5.
// Чистые функции: время и генератор случайных чисел — в параметрах.
//
// Работа над боссом — подходы с секундомером: длительность заранее не задаётся, секундомер считает по метке
// времени старта и переживает закрытие приложения. При остановке время можно поправить.
// Конечный босс — сооружение под туманом: каждый подход делает туман тоньше, победу объявляет пользователь.
// Бесконечный — место в долине, которое наполняется: каждый подход добавляет элемент, каждые 5 — особый и звезду.

import { BALANCE } from '../config/balance';
import { GARDEN_KINDS, LANDMARK_KINDS, type Boss, type BossSession, type Branch, type GardenKind, type LandmarkKind } from '../model/types';
import { pickFrom, type Rng } from './rng';
import { dayOf } from './time';

const MS_PER_MINUTE = 60_000;

export interface NewBoss {
  title: string;
  note?: string;
  kind: Boss['kind'];
  branch: Branch;
  templateId?: string;
}

/** Пустая строка — нет заметки. */
function cleanNote(note: string | undefined): string | undefined {
  const t = note?.trim();
  return t ? t : undefined;
}

/**
 * Сооружение для нового конечного босса: случайное из ещё не открытых, без повторов, пока не открыты все.
 * Сооружение отпущенного босса возвращается в пул. Все открыты — любое, которого сейчас нет под туманом.
 */
export function chooseLandmark(bosses: readonly Boss[], rng: Rng): LandmarkKind {
  const landmarksOf = (statuses: Boss['status'][]) =>
    new Set(bosses.filter((b) => statuses.includes(b.status)).map((b) => b.place.landmark));
  const busy = landmarksOf(['active', 'won']);
  const fresh = LANDMARK_KINDS.filter((k) => !busy.has(k));
  if (fresh.length > 0) return pickFrom(fresh, rng);
  const underFog = landmarksOf(['active']);
  const free = LANDMARK_KINDS.filter((k) => !underFog.has(k));
  return pickFrom(free.length > 0 ? free : LANDMARK_KINDS, rng);
}

/** Место для нового бесконечного босса: случайное из тех, что встречаются в долине реже всего. [ПРЕДЛОЖЕНО] */
export function chooseGarden(bosses: readonly Boss[], rng: Rng): GardenKind {
  const count = (k: GardenKind) => bosses.filter((b) => b.kind === 'endless' && b.place.garden === k).length;
  const min = Math.min(...GARDEN_KINDS.map(count));
  return pickFrom(
    GARDEN_KINDS.filter((k) => count(k) === min),
    rng,
  );
}

export function createBoss(bosses: readonly Boss[], input: NewBoss, now: number, rng: Rng, id: string): Boss {
  const title = input.title.trim();
  if (!title) throw new Error('Нужно название босса');
  const place: Boss['place'] =
    input.kind === 'finite' ? { landmark: chooseLandmark(bosses, rng), seed: 0 } : { garden: chooseGarden(bosses, rng), seed: 0 };
  place.seed = Math.floor(rng() * 4_294_967_296);
  const boss: Boss = { id, title, kind: input.kind, branch: input.branch, status: 'active', place, sessions: [], createdAt: now };
  const note = cleanNote(input.note);
  if (note) boss.note = note;
  if (input.templateId) boss.templateId = input.templateId;
  return boss;
}

// Секундомер

/** Босс, у которого идёт секундомер. Секундомер идёт не больше чем у одного босса. */
export function runningBoss(bosses: readonly Boss[]): Boss | undefined {
  return bosses.find((b) => b.stopwatch);
}

export function startStopwatch(boss: Boss, now: number): Boss {
  if (boss.status !== 'active') throw new Error('Босс уже не в работе');
  if (boss.stopwatch) throw new Error('Секундомер уже идёт');
  return { ...boss, stopwatch: { startedAt: now } };
}

/** Сколько идёт секундомер. 0 — не идёт. */
export function stopwatchMs(boss: Boss, now: number): number {
  return boss.stopwatch ? Math.max(0, now - boss.stopwatch.startedAt) : 0;
}

/** Отмена подхода: без награды и без штрафа. */
export function cancelStopwatch(boss: Boss): Boss {
  if (!boss.stopwatch) return boss;
  const { stopwatch: _stopwatch, ...rest } = boss;
  return rest;
}

/** Правка времени при остановке: засчитываются вписанные минуты, в пределах подхода. */
export function clampSessionMinutes(minutes: number): number {
  const { minSessionMinutes, maxSessionMinutes } = BALANCE.bosses;
  return Math.min(maxSessionMinutes, Math.max(minSessionMinutes, Math.round(minutes)));
}

/**
 * Сколько минут засчитать при остановке: целые минуты на секундомере, не больше BALANCE.bosses.maxSessionMinutes
 * (забытый секундомер). null — секундомер не идёт или на нём меньше минимума (как отмена).
 */
export function measuredMinutes(boss: Boss, now: number): number | null {
  if (!boss.stopwatch) return null;
  const minutes = Math.floor(stopwatchMs(boss, now) / MS_PER_MINUTE);
  if (minutes < BALANCE.bosses.minSessionMinutes) return null;
  return Math.min(BALANCE.bosses.maxSessionMinutes, minutes);
}

/** Секундомер шёл дольше BALANCE.bosses.maxSessionMinutes: скорее всего, его забыли остановить. */
export function isForgotten(boss: Boss, now: number): boolean {
  return Math.floor(stopwatchMs(boss, now) / MS_PER_MINUTE) > BALANCE.bosses.maxSessionMinutes;
}

/** Секундомер остановлен: подход записан. */
export function addSession(boss: Boss, minutes: number, note?: string): Boss {
  if (!boss.stopwatch) throw new Error('Секундомер не идёт');
  const session: BossSession = { startedAt: boss.stopwatch.startedAt, minutes: clampSessionMinutes(minutes) };
  const n = cleanNote(note);
  if (n) session.note = n;
  return { ...cancelStopwatch(boss), sessions: [...boss.sessions, session] };
}

/** Звёзды за подход: у бесконечного босса — за каждый specialEvery-й подход (особый элемент). */
export function sessionStars(boss: Boss): number {
  if (boss.kind !== 'endless') return 0;
  const n = boss.sessions.length + 1;
  return n % BALANCE.bosses.specialEvery === 0 ? BALANCE.bosses.starsPerSpecial : 0;
}

// Конец

function ensureStopped(boss: Boss): void {
  if (boss.stopwatch) throw new Error('Сначала останови секундомер');
}

/** Победа над конечным боссом. Заметка необязательна: например, разбор интервью. */
export function winBoss(boss: Boss, now: number, note?: string): Boss {
  if (boss.kind !== 'finite' || boss.status !== 'active') throw new Error('Победа — только над конечным боссом в работе');
  ensureStopped(boss);
  const won: Boss = { ...boss, status: 'won', endedAt: now };
  const n = cleanNote(note);
  if (n) won.victoryNote = n;
  return won;
}

/** «Отпустить» конечного босса: туман уходит, сооружение возвращается в пул, награды за подходы остаются. */
export function releaseBoss(boss: Boss, now: number): Boss {
  if (boss.kind !== 'finite' || boss.status !== 'active') throw new Error('Отпустить можно только конечного босса в работе');
  ensureStopped(boss);
  return { ...boss, status: 'released', endedAt: now };
}

/** Бесконечного босса — в архив: место и элементы остаются в долине. */
export function archiveBoss(boss: Boss, now: number): Boss {
  if (boss.kind !== 'endless' || boss.status !== 'active') throw new Error('В архив — только бесконечного босса в работе');
  ensureStopped(boss);
  return { ...boss, status: 'archived', endedAt: now };
}

// Вид в долине

/**
 * Плотность тумана над сооружением конечного босса: 1 — сплошной, 0 — тумана нет.
 * Каждый подход убирает долю оставшегося, но до победы туман не тоньше fogMin. Победа — тумана нет;
 * отпущенный босс — тоже (сооружение уходит из долины вместе с туманом).
 */
export function fogDensity(boss: Boss): number {
  if (boss.kind !== 'finite' || boss.status !== 'active') return 0;
  const { fogStart, fogThinning, fogMin } = BALANCE.bosses;
  return Math.max(fogMin, fogStart * (1 - fogThinning) ** boss.sessions.length);
}

export interface GardenView {
  /** Сколько элементов (рыбок, цветов, ульев, бабочек) — не больше ёмкости места. */
  elements: number;
  /** Сколько из них особых (золотая рыбка, кувшинка, редкий цветок…): по одному на каждые specialEvery подходов. */
  specials: number;
  /** Подходы сверх ёмкости: элементы не добавляются, а становятся крупнее и ярче. */
  bloom: number;
}

export function gardenView(boss: Boss): GardenView {
  const n = boss.sessions.length;
  const { gardenCapacity, specialEvery } = BALANCE.bosses;
  return {
    elements: Math.min(n, gardenCapacity),
    specials: Math.floor(n / specialEvery),
    bloom: Math.max(0, n - gardenCapacity),
  };
}

/**
 * Что изменилось в долине после последнего подхода: fog — туман над сооружением стал тоньше;
 * element — в месте новый элемент; special — особый элемент (каждый specialEvery-й подход);
 * bloom — место уже полно, элементы стали крупнее и ярче.
 */
export type BossGrowth = 'fog' | 'element' | 'special' | 'bloom';

export function lastGrowth(boss: Boss): BossGrowth {
  if (boss.kind === 'finite') return 'fog';
  const n = boss.sessions.length;
  const { gardenCapacity, specialEvery } = BALANCE.bosses;
  if (n > 0 && n % specialEvery === 0) return 'special';
  return n > gardenCapacity ? 'bloom' : 'element';
}

// Журнал подходов

export function lastSession(boss: Boss): BossSession | undefined {
  return boss.sessions.at(-1);
}

/** Сколько календарных дней прошло с последнего подхода. null — подходов не было. */
export function daysSinceLast(boss: Boss, now: number): number | null {
  const last = lastSession(boss);
  return last ? dayOf(now) - dayOf(last.startedAt) : null;
}

export function totalMinutes(boss: Boss): number {
  return boss.sessions.reduce((sum, s) => sum + s.minutes, 0);
}
