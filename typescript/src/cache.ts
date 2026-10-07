// LombokCache core (TypeScript port). Normative behaviour: docs/SPEC_LombokCache_v0.1.0.md.
// Deterministic: time comes from an injectable clock, never from the system directly.

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export type ErrorCode = "invalid_key" | "invalid_ttl" | "invalid_option" | "invalid_value";

export class LombokCacheError extends Error {
  readonly code: ErrorCode;
  readonly messageId: string;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "LombokCacheError";
    this.code = code;
    this.messageId = `lombokcache.error.${code}`;
  }
}

const fail = (code: ErrorCode, message: string): never => {
  throw new LombokCacheError(code, message);
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const MAX_SAFE = 9007199254740991;
export const MAX_KEY_BYTES = 250;
const MAX_VALUE_DEPTH = 512;

function utf8Length(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) as number;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/** Keys and tags: 1..250 UTF-8 bytes, no control characters U+0000..U+001F and U+007F. */
export function validateKey(key: unknown): string {
  if (typeof key !== "string" || key === "") return fail("invalid_key", "key must be a non-empty string");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(key)) return fail("invalid_key", "key must not contain control characters");
  if (utf8Length(key) > MAX_KEY_BYTES) return fail("invalid_key", "key is longer than 250 UTF-8 bytes");
  return key;
}

/** Namespaced key: parts escaped (`\` as `\\`, `:` as `\:`) and joined with `:`. */
export function makeKey(namespace: unknown, ...parts: unknown[]): string {
  const all = [namespace, ...parts];
  for (const p of all) if (typeof p !== "string" || p === "") return fail("invalid_key", "key parts must be non-empty strings");
  return validateKey((all as string[]).map((p) => p.replace(/\\/g, "\\\\").replace(/:/g, "\\:")).join(":"));
}

function checkValue(v: unknown, depth: number): Json {
  if (depth > MAX_VALUE_DEPTH) return fail("invalid_value", "value nested too deeply");
  if (v === null || typeof v === "boolean" || typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : fail("invalid_value", "numbers must be finite");
  if (Array.isArray(v)) return v.map((x) => checkValue(x, depth + 1));
  if (isObject(v)) {
    const o: { [k: string]: Json } = {};
    for (const k of Object.keys(v)) Object.defineProperty(o, k, { value: checkValue(v[k], depth + 1), writable: true, enumerable: true, configurable: true });
    return o;
  }
  return fail("invalid_value", "value must be JSON data");
}

/** Deep copy that validates JSON data (finite numbers, depth <= 512). */
const copy = (v: unknown): Json => checkValue(v, 0);

export interface CacheOptions {
  /** Maximum number of entries; absent means unlimited. */
  maxEntries?: number;
  /** Default time to live in milliseconds; `null` or absent means no expiry. */
  defaultTtl?: number | null;
  /** Epoch-like milliseconds (non-negative integer). Defaults to `Date.now`. */
  clock?: () => number;
}

export interface SetOptions {
  /** Milliseconds (integer >= 1); `null` means no expiry; absent means `defaultTtl`. */
  ttl?: number | null;
  tags?: string[];
}

export interface Stats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  expirations: number;
}

interface Entry {
  value: Json;
  expiresAt: number | null;
  tags: string[];
}

/** Absolute expiry, clamped to 2^53 - 1 so that every port computes it exactly. */
const expiry = (now: number, ttl: number | null): number | null => (ttl === null ? null : Math.min(now + ttl, MAX_SAFE));

function checkTtl(ttl: unknown): number | null {
  if (ttl === null) return null;
  if (typeof ttl !== "number" || !Number.isInteger(ttl) || ttl < 1 || ttl > MAX_SAFE) return fail("invalid_ttl", "ttl must be an integer number of milliseconds >= 1, or null");
  return ttl;
}

/** In-memory cache with TTL, LRU eviction, tags and statistics. */
export class Cache {
  private readonly map = new Map<string, Entry>();
  private readonly maxEntries: number | null;
  private readonly defaultTtl: number | null;
  private readonly clock: () => number;
  private readonly st: Stats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0, expirations: 0 };

  constructor(options: CacheOptions = {}) {
    if (!isObject(options)) fail("invalid_option", "options must be an object");
    const o = options as Record<string, unknown>;
    for (const k of Object.keys(o)) if (!["maxEntries", "defaultTtl", "clock"].includes(k)) fail("invalid_option", `unknown option: ${k}`);
    const m = o["maxEntries"];
    if (m !== undefined && (typeof m !== "number" || !Number.isInteger(m) || m < 1 || m > MAX_SAFE)) fail("invalid_option", "maxEntries must be an integer >= 1");
    this.maxEntries = (m as number | undefined) ?? null;
    const d = o["defaultTtl"];
    if (d !== undefined && d !== null && (typeof d !== "number" || !Number.isInteger(d) || d < 1 || d > MAX_SAFE)) fail("invalid_option", "defaultTtl must be an integer >= 1 or null");
    this.defaultTtl = (d as number | null | undefined) ?? null;
    const c = o["clock"];
    if (c !== undefined && typeof c !== "function") fail("invalid_option", "clock must be a function");
    this.clock = (c as (() => number) | undefined) ?? (() => Date.now());
  }

  private now(): number {
    const t = this.clock();
    if (typeof t !== "number" || !Number.isInteger(t) || t < 0 || t > MAX_SAFE) return fail("invalid_option", "clock must return a non-negative integer");
    return t;
  }

  private live(e: Entry, now: number): boolean {
    return e.expiresAt === null || now < e.expiresAt;
  }

  /** Live entry or undefined; removes (and counts) an expired one. */
  private find(key: string, now: number): Entry | undefined {
    const e = this.map.get(key);
    if (e === undefined) return undefined;
    if (this.live(e, now)) return e;
    this.map.delete(key);
    this.st.expirations++;
    return undefined;
  }

  private touchRecency(key: string, e: Entry): void {
    this.map.delete(key);
    this.map.set(key, e);
  }

  private parseSet(options: unknown): { expires: (now: number) => number | null; tags: string[] } {
    if (options !== undefined && !isObject(options)) fail("invalid_option", "options must be an object");
    const o = (options ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(o)) if (k !== "ttl" && k !== "tags") fail("invalid_option", `unknown option: ${k}`);
    const ttl = has(o, "ttl") && o["ttl"] !== undefined ? checkTtl(o["ttl"]) : this.defaultTtl;
    let tags: string[] = [];
    if (has(o, "tags") && o["tags"] !== undefined) {
      const t = o["tags"];
      if (!Array.isArray(t)) fail("invalid_option", "tags must be an array of strings");
      tags = (t as unknown[]).map((x) => validateKey(x));
    }
    return { expires: (now) => expiry(now, ttl), tags };
  }

  private store(key: string, value: Json, expiresAt: number | null, tags: string[], now: number): void {
    if (!this.map.has(key) && this.maxEntries !== null && this.map.size >= this.maxEntries) {
      for (const [k, e] of [...this.map]) {
        if (!this.live(e, now)) {
          this.map.delete(k);
          this.st.expirations++;
        }
      }
      while (this.map.size >= this.maxEntries) {
        const oldest = this.map.keys().next().value as string;
        this.map.delete(oldest);
        this.st.evictions++;
      }
    }
    this.map.delete(key);
    this.map.set(key, { value, expiresAt, tags });
    this.st.sets++;
  }

  /** Store a value. */
  set(key: unknown, value: unknown, options?: SetOptions): true {
    const k = validateKey(key);
    const s = this.parseSet(options);
    const v = copy(value);
    const now = this.now();
    this.store(k, v, s.expires(now), s.tags, now);
    return true;
  }

  /** Store only when the key is absent or expired. */
  add(key: unknown, value: unknown, options?: SetOptions): boolean {
    const k = validateKey(key);
    const s = this.parseSet(options);
    const v = copy(value);
    const now = this.now();
    if (this.find(k, now) !== undefined) return false;
    this.store(k, v, s.expires(now), s.tags, now);
    return true;
  }

  /** Value, or `fallback` (default `null`) on a miss. Counts a hit or miss and refreshes recency. */
  get(key: unknown, fallback: Json = null): Json {
    const k = validateKey(key);
    const e = this.find(k, this.now());
    if (e === undefined) {
      this.st.misses++;
      return fallback;
    }
    this.st.hits++;
    this.touchRecency(k, e);
    return copy(e.value);
  }

  /** Value without touching recency or statistics; `null` on a miss. */
  peek(key: unknown): Json {
    const k = validateKey(key);
    const e = this.map.get(k);
    return e !== undefined && this.live(e, this.now()) ? copy(e.value) : null;
  }

  /** True for a live entry. Does not touch recency or statistics. */
  has(key: unknown): boolean {
    const k = validateKey(key);
    return this.find(k, this.now()) !== undefined;
  }

  /** Remove a live entry; true when one was removed. */
  delete(key: unknown): boolean {
    const k = validateKey(key);
    if (this.find(k, this.now()) === undefined) return false;
    this.map.delete(k);
    this.st.deletes++;
    return true;
  }

  /** Get and remove. */
  pull(key: unknown, fallback: Json = null): Json {
    const v = this.get(key, fallback);
    const k = key as string;
    if (this.map.has(k)) {
      this.map.delete(k);
      this.st.deletes++;
    }
    return v;
  }

  /** Cached value, or the factory result which is then stored. */
  remember(key: unknown, factory: () => unknown, options?: SetOptions): Json {
    const k = validateKey(key);
    const s = this.parseSet(options);
    const now = this.now();
    const e = this.find(k, now);
    if (e !== undefined) {
      this.st.hits++;
      this.touchRecency(k, e);
      return copy(e.value);
    }
    const v = copy(factory());
    this.st.misses++;
    this.store(k, v, s.expires(now), s.tags, now);
    return copy(v);
  }

  /**
   * Add `by` (default 1) to an integer entry and return the result. A missing key starts at 0 and
   * is stored with `ttl` (or `defaultTtl`); an existing key keeps its expiry and tags.
   */
  increment(key: unknown, by: unknown = 1, options?: SetOptions): number {
    const k = validateKey(key);
    if (typeof by !== "number" || !Number.isSafeInteger(by)) return fail("invalid_value", "increment must be a safe integer");
    const s = this.parseSet(options);
    const now = this.now();
    const e = this.find(k, now);
    if (e === undefined) {
      this.store(k, by === 0 ? 0 : by, s.expires(now), s.tags, now);
      return by === 0 ? 0 : by;
    }
    const cur = e.value;
    if (typeof cur !== "number" || !Number.isSafeInteger(cur)) return fail("invalid_value", "stored value is not an integer");
    const next = cur + by;
    if (!Number.isSafeInteger(next)) return fail("invalid_value", "result is not a safe integer");
    e.value = next === 0 ? 0 : next;
    this.touchRecency(k, e);
    this.st.sets++;
    return e.value as number;
  }

  decrement(key: unknown, by: unknown = 1, options?: SetOptions): number {
    validateKey(key);
    if (typeof by !== "number" || !Number.isSafeInteger(by)) return fail("invalid_value", "decrement must be a safe integer");
    return this.increment(key, -by, options);
  }

  /** Reset the expiry of a live entry (`ttl` as in `set`). */
  touch(key: unknown, ttl?: number | null): boolean {
    const k = validateKey(key);
    const t = ttl === undefined ? this.defaultTtl : checkTtl(ttl);
    const now = this.now();
    const e = this.find(k, now);
    if (e === undefined) return false;
    e.expiresAt = expiry(now, t);
    this.touchRecency(k, e);
    return true;
  }

  /** Remaining milliseconds; -1 when the entry never expires; -2 when there is no live entry. */
  ttl(key: unknown): number {
    const k = validateKey(key);
    const now = this.now();
    const e = this.find(k, now);
    if (e === undefined) return -2;
    return e.expiresAt === null ? -1 : e.expiresAt - now;
  }

  /** Remove every live entry carrying `tag`; returns how many were removed. */
  invalidateTag(tag: unknown): number {
    const t = validateKey(tag);
    const now = this.now();
    let n = 0;
    for (const [k, e] of [...this.map]) {
      if (!e.tags.includes(t)) continue;
      this.map.delete(k);
      if (this.live(e, now)) {
        n++;
        this.st.deletes++;
      } else this.st.expirations++;
    }
    return n;
  }

  /** Remove expired entries; returns how many. */
  prune(): number {
    const now = this.now();
    let n = 0;
    for (const [k, e] of [...this.map]) {
      if (!this.live(e, now)) {
        this.map.delete(k);
        this.st.expirations++;
        n++;
      }
    }
    return n;
  }

  /** Number of live entries (prunes first). */
  size(): number {
    this.prune();
    return this.map.size;
  }

  /** Live keys from least to most recently used (prunes first). */
  keys(): string[] {
    this.prune();
    return [...this.map.keys()];
  }

  /** Remove everything; returns the number of live entries removed. */
  clear(): number {
    const n = this.size();
    this.map.clear();
    this.st.deletes += n;
    return n;
  }

  stats(): Stats {
    return { ...this.st };
  }
}

export type Step = { op: string; at?: number } & Record<string, unknown>;

/** Operation names accepted by `run`. */
export const OPS = ["set", "add", "get", "peek", "has", "delete", "pull", "remember", "increment", "decrement", "touch", "ttl", "invalidateTag", "prune", "size", "keys", "clear", "stats"] as const;

/**
 * Run a script of operations against a fresh cache whose clock is set by each step's `at`
 * (initially 0). Returns one output per step; a step that fails yields `{ "$error": code }` and
 * leaves the cache unchanged. This is the contract entry point used by the vectors.
 */
export function run(options: unknown, steps: unknown): Json[] {
  if (!isObject(options)) return fail("invalid_option", "options must be an object");
  if (has(options, "clock")) return fail("invalid_option", "run supplies its own clock");
  if (!Array.isArray(steps)) return fail("invalid_option", "steps must be an array");
  let now = 0;
  const cache = new Cache({ ...(options as CacheOptions), clock: () => now });
  const out: Json[] = [];
  for (const raw of steps) {
    if (!isObject(raw) || typeof raw["op"] !== "string" || !(OPS as readonly string[]).includes(raw["op"])) return fail("invalid_option", "each step needs a known op");
    const s = raw as Step;
    if (s.at !== undefined) {
      if (typeof s.at !== "number" || !Number.isInteger(s.at) || s.at < 0 || s.at > MAX_SAFE) return fail("invalid_option", "at must be a non-negative integer");
      now = s.at;
    }
    const opt = (): SetOptions | undefined => (s["options"] === undefined ? undefined : (s["options"] as SetOptions));
    const fb = (): Json => (has(s, "fallback") ? (s["fallback"] as Json) : null);
    try {
      switch (s.op) {
        case "set": out.push(cache.set(s["key"], s["value"], opt())); break;
        case "add": out.push(cache.add(s["key"], s["value"], opt())); break;
        case "get": out.push(cache.get(s["key"], fb())); break;
        case "peek": out.push(cache.peek(s["key"])); break;
        case "has": out.push(cache.has(s["key"])); break;
        case "delete": out.push(cache.delete(s["key"])); break;
        case "pull": out.push(cache.pull(s["key"], fb())); break;
        case "remember": out.push(cache.remember(s["key"], () => s["value"], opt())); break;
        case "increment": out.push(cache.increment(s["key"], has(s, "by") ? s["by"] : 1, opt())); break;
        case "decrement": out.push(cache.decrement(s["key"], has(s, "by") ? s["by"] : 1, opt())); break;
        case "touch": out.push(cache.touch(s["key"], has(s, "ttl") ? (s["ttl"] as number | null) : undefined)); break;
        case "ttl": out.push(cache.ttl(s["key"])); break;
        case "invalidateTag": out.push(cache.invalidateTag(s["tag"])); break;
        case "prune": out.push(cache.prune()); break;
        case "size": out.push(cache.size()); break;
        case "keys": out.push(cache.keys()); break;
        case "clear": out.push(cache.clear()); break;
        case "stats": out.push({ ...cache.stats() }); break;
      }
    } catch (err) {
      if (!(err instanceof LombokCacheError)) throw err;
      out.push({ $error: err.code });
    }
  }
  return out;
}
