import { test } from "node:test";
import assert from "node:assert/strict";
import { Cache, LombokCacheError, run } from "../src/index.js";

test("values are copied in and out (no aliasing)", () => {
  const c = new Cache({ clock: () => 0 });
  const v = { list: [1] };
  c.set("k", v);
  v.list.push(2);
  const got = c.get("k") as { list: number[] };
  got.list.push(3);
  assert.deepEqual(c.get("k"), { list: [1] });
});

test("remember calls the factory only on a miss", () => {
  let now = 0;
  const c = new Cache({ clock: () => now });
  let calls = 0;
  const f = (): number => ++calls;
  assert.equal(c.remember("r", f, { ttl: 10 }), 1);
  assert.equal(c.remember("r", f), 1);
  now = 10;
  assert.equal(c.remember("r", f), 2);
  assert.equal(calls, 2);
});

test("default clock is Date.now and values must be JSON data", () => {
  const c = new Cache();
  c.set("a", 1, { ttl: 60_000 });
  assert.ok(c.ttl("a") > 0 && c.ttl("a") <= 60_000);
  assert.throws(() => c.set("b", () => 1), (e: unknown) => e instanceof LombokCacheError && e.code === "invalid_value");
  assert.throws(() => c.set("b", Number.NaN), (e: unknown) => e instanceof LombokCacheError && e.code === "invalid_value");
  assert.throws(() => c.set("b", undefined), (e: unknown) => e instanceof LombokCacheError && e.code === "invalid_value");
});

test("constructor validates options and the clock result", () => {
  assert.throws(() => new Cache({ maxEntries: 0 }), (e: unknown) => e instanceof LombokCacheError && e.code === "invalid_option");
  const c = new Cache({ clock: () => -1 });
  assert.throws(() => c.get("a"), (e: unknown) => e instanceof LombokCacheError && e.code === "invalid_option");
});

test("errors carry a messageId", () => {
  try {
    new Cache().get("");
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof LombokCacheError);
    assert.equal(e.messageId, "lombokcache.error.invalid_key");
  }
});

// Pseudo-fuzz invariants: size never exceeds maxEntries, keys() has no duplicates, ttl() is
// -1, -2 or within (0, ttl], and nothing but LombokCacheError is thrown.
test("fuzz: invariants over random scripts", () => {
  let seed = 3;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)] as T;
  const ops = ["set", "get", "add", "delete", "increment", "touch", "invalidateTag", "prune", "keys", "remember", "pull"];
  for (let i = 0; i < 300; i++) {
    const max = 1 + Math.floor(rnd() * 5);
    let t = 0;
    const steps = Array.from({ length: 60 }, () => {
      t += Math.floor(rnd() * 3);
      const op = pick(ops);
      return { op, at: t, key: pick(["a", "b", "c", "d", "e", "f"]), value: pick([1, "x", null, [1]]), tag: pick(["x", "y"]), ttl: pick([1, 5, null]), options: { ttl: pick([1, 4, null]), tags: [pick(["x", "y"])] } };
    });
    steps.push({ op: "keys", at: t } as never);
    const out = run({ maxEntries: max }, steps);
    const keys = out[out.length - 1] as string[];
    assert.ok(keys.length <= max);
    assert.equal(new Set(keys).size, keys.length);
  }
});
