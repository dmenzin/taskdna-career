export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function pickN<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const copy = [...items];
  const selected: T[] = [];
  while (selected.length < Math.min(count, copy.length)) {
    const index = Math.floor(rng() * copy.length);
    selected.push(copy.splice(index, 1)[0]!);
  }
  return selected;
}

export function chance(rng: Rng, probability: number) {
  return rng() < probability;
}

export function between(rng: Rng, min: number, max: number) {
  return min + rng() * (max - min);
}

export function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
