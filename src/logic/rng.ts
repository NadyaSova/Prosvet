/** Генератор случайных чисел: возвращает число в [0, 1). */
export type Rng = () => number;

/** Сидированный генератор (mulberry32): одинаковый сид — одинаковая последовательность. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Случайный сид для нового объекта (например, дерева в долине). */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/** Случайный элемент массива. */
export function pickFrom<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pickFrom: пустой список');
  return items[Math.floor(rng() * items.length)]!;
}

/** Элемент по весам. Элементы с нулевым весом не выбираются. */
export function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  if (total <= 0) throw new Error('pickWeighted: нет элементов с положительным весом');
  let roll = rng() * total;
  for (const item of items) {
    const w = weight(item);
    if (w <= 0) continue;
    if (roll < w) return item;
    roll -= w;
  }
  // Защита от погрешности округления: последний элемент с положительным весом.
  return [...items].reverse().find((item) => weight(item) > 0)!;
}

/** Перемешанная копия массива. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
