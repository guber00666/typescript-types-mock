/**
 * Utility functions for generating random values.
 *
 * Supports both non-deterministic (Math.random) and deterministic (seeded PRNG)
 * modes. Use `createRng(seed)` to get a seeded random number generator,
 * or `RandomGenerator` for a full-featured random value factory.
 */

// ─── String pool ───────────────────────────────────────────

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

// ─── PRNG: mulberry32 ──────────────────────────────────────

/**
 * Create a seeded pseudo-random number generator using the mulberry32 algorithm.
 * Returns a function that produces numbers in [0, 1) — drop-in for Math.random().
 *
 * @param seed - Integer seed. Same seed → same sequence.
 */
export function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── RandomGenerator class ─────────────────────────────────

/**
 * A random value generator that can operate in seeded (deterministic)
 * or non-seeded (Math.random) mode.
 */
export class RandomGenerator {
  private rng: () => number;

  constructor(seed?: number) {
    this.rng = seed !== undefined ? createRng(seed) : Math.random;
  }

  /** Generate a random number in [0, 1). */
  random(): number {
    return this.rng();
  }

  /** Generate a random string from the pool. */
  string(): string {
    const index = Math.floor(this.rng() * DEFAULT_STRING_POOL.length);
    return DEFAULT_STRING_POOL[index]!;
  }

  /** Generate a random integer within a range. */
  number(min?: number, max?: number): number {
    const lo = min ?? DEFAULT_NUMBER_RANGE.min;
    const hi = max ?? DEFAULT_NUMBER_RANGE.max;
    return Math.floor(this.rng() * (hi - lo + 1)) + lo;
  }

  /** Generate a random float within a range. */
  float(min?: number, max?: number): number {
    const lo = min ?? DEFAULT_NUMBER_RANGE.min;
    const hi = max ?? DEFAULT_NUMBER_RANGE.max;
    return this.rng() * (hi - lo) + lo;
  }

  /** Generate a random boolean. */
  boolean(): boolean {
    return this.rng() >= 0.5;
  }

  /** Generate a random Date. */
  date(): Date {
    const start = new Date(2000, 0, 1).getTime();
    const end = new Date(2030, 11, 31).getTime();
    return new Date(start + this.rng() * (end - start));
  }

  /** Pick a random element from an array. */
  pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return items[Math.floor(this.rng() * items.length)]!;
  }

  // ─── Semantic generators (property-name-aware) ─────────

  /**
   * Generate a contextually appropriate string value based on a property name.
   * Returns `null` if no semantic match is found (caller should fall back to generic string).
   */
  stringForProperty(name: string): string | null {
    const lower = name.toLowerCase();

    if (lower === "email" || lower.endsWith("email")) {
      return this.email();
    }
    if (lower === "url" || lower === "href" || lower === "link" || lower.endsWith("url") || lower.endsWith("uri")) {
      return this.url();
    }
    if (lower === "phone" || lower === "telephone" || lower === "tel" || lower.endsWith("phone")) {
      return this.phone();
    }
    if (lower === "id" || lower.endsWith("id") || lower === "uuid") {
      return this.uuid();
    }
    if (lower === "name" || lower === "fullname" || lower === "username" || lower === "author") {
      return this.personName();
    }
    if (lower === "city") {
      return this.pick(CITIES);
    }
    if (lower === "country") {
      return this.pick(COUNTRIES);
    }
    if (lower === "street" || lower === "address") {
      return `${this.number(1, 999)} ${this.pick(STREET_NAMES)} St`;
    }
    if (lower === "zipcode" || lower === "zip" || lower === "postalcode" || lower === "postalcode") {
      return String(this.number(10000, 99999));
    }
    if (lower === "title") {
      return this.pick(TITLES);
    }
    if (lower === "description" || lower === "content" || lower === "text" || lower === "body") {
      return this.pick(LOREM_PARAGRAPHS);
    }
    if (lower.endsWith("at") || lower === "date" || lower === "timestamp" || lower === "createdat" || lower === "updatedat" || lower === "publishedat") {
      return this.date().toISOString();
    }
    if (lower === "avatar" || lower === "image" || lower === "photo" || lower === "picture") {
      return `https://example.com/images/${this.uuid()}.png`;
    }
    if (lower === "color" || lower === "colour") {
      return this.pick(COLORS);
    }
    if (lower === "ip" || lower === "ipaddress") {
      return `${this.number(1,255)}.${this.number(0,255)}.${this.number(0,255)}.${this.number(1,254)}`;
    }

    return null;
  }

  /** Generate a mock email address. */
  email(): string {
    const user = this.pick(FIRST_NAMES).toLowerCase() + this.number(1, 999);
    const domain = this.pick(DOMAINS);
    return `${user}@${domain}`;
  }

  /** Generate a mock URL. */
  url(): string {
    return `https://${this.pick(DOMAINS)}/${this.pick(URL_PATHS)}`;
  }

  /** Generate a mock phone number. */
  phone(): string {
    return `+7 ${this.number(900, 999)} ${this.number(100, 999)}-${this.number(10, 99)}-${this.number(10, 99)}`;
  }

  /** Generate a mock UUID. */
  uuid(): string {
    const hex = () => {
      let s = "";
      for (let i = 0; i < 4; i++) {
        s += Math.floor(this.rng() * 16).toString(16);
      }
      return s;
    };
    return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex().slice(0,4)}`;
  }

  /** Generate a mock person name. */
  personName(): string {
    return `${this.pick(FIRST_NAMES)} ${this.pick(LAST_NAMES)}`;
  }
}

// ─── Semantic data pools ───────────────────────────────────

const FIRST_NAMES = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Moore"];
const DOMAINS = ["example.com", "test.org", "mock.dev", "demo.io", "sample.net"];
const CITIES = ["Moscow", "London", "New York", "Tokyo", "Berlin", "Paris", "Sydney", "Toronto"];
const COUNTRIES = ["Russia", "UK", "USA", "Japan", "Germany", "France", "Australia", "Canada"];
const STREET_NAMES = ["Main", "Oak", "Elm", "Park", "Cedar", "Maple", "Pine", "Birch"];
const TITLES = ["Getting Started", "Advanced Guide", "Quick Reference", "Best Practices", "Introduction", "Deep Dive"];
const LOREM_PARAGRAPHS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
  "Duis aute irure dolor in reprehenderit in voluptate velit.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
];
const URL_PATHS = ["about", "docs", "api/v1", "products", "users", "settings", "dashboard"];
const COLORS = ["#FF5733", "#33FF57", "#3357FF", "#F0E68C", "#DDA0DD", "#20B2AA", "#FF6347", "#4682B4"];

// ─── Legacy standalone functions (use Math.random) ─────────

/**
 * Generate a random string from the pool.
 */
export function randomString(): string {
  const index = Math.floor(Math.random() * DEFAULT_STRING_POOL.length);
  return DEFAULT_STRING_POOL[index]!;
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
