/** Deterministic helpers so mock data is identical on every load. */

export type Random = () => number;

/** mulberry32: a small seeded PRNG returning floats in [0, 1). */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

/** Stable float in [0, 1) for a key, e.g. `unitHash("WETH:wick:123")`. */
export function unitHash(key: string): number {
  return createRandom(hashString(key))();
}

/** Standard normal via Box–Muller. */
export function gaussian(random: Random): number {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randomInt(random: Random, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error("pick() needs a non-empty list");
  }
  return item;
}

export function randomHex(random: Random, bytes: number): string {
  return Array.from({ length: bytes * 2 }, () => Math.floor(random() * 16).toString(16)).join("");
}

export function randomUuid(random: Random): string {
  const hex = randomHex(random, 16);
  const variant = (8 + Math.floor(random() * 4)).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Alphanumeric, as EIP-4361 requires for nonces (min 8 chars). */
export function randomAlphanumeric(random: Random, length: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
}
