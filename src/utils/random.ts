/**
 * Utility functions for generating random values.
 */

const DEFAULT_STRING_POOL = [
  "Lorem ipsum",
  "Hello World",
  "Foo Bar",
  "Test Value",
  "Sample Data",
  "Mock String",
  "Random Text",
  "Generated Value",
];

const DEFAULT_NUMBER_RANGE = { min: 0, max: 1000 };

/**
 * Generate a random string from the pool or a random UUID-like string.
 */
export function randomString(): string {
  const pool = DEFAULT_STRING_POOL;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}

/**
 * Generate a random integer within a range.
 */
export function randomNumber(min?: number, max?: number): number {
  const lo = min ?? DEFAULT_NUMBER_RANGE.min;
  const hi = max ?? DEFAULT_NUMBER_RANGE.max;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Generate a random float within a range.
 */
export function randomFloat(min?: number, max?: number): number {
  const lo = min ?? DEFAULT_NUMBER_RANGE.min;
  const hi = max ?? DEFAULT_NUMBER_RANGE.max;
  return Math.random() * (hi - lo) + lo;
}

/**
 * Generate a random boolean.
 */
export function randomBoolean(): boolean {
  return Math.random() >= 0.5;
}

/**
 * Generate a random bigint.
 */
export function randomBigInt(): bigint {
  return BigInt(randomNumber(0, 1_000_000));
}

/**
 * Generate a random date.
 */
export function randomDate(): Date {
  const start = new Date(2000, 0, 1).getTime();
  const end = new Date(2030, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
}

/**
 * Pick a random element from an array.
 */
export function randomPick<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from empty array");
  }
  return items[Math.floor(Math.random() * items.length)]!;
}
