import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Cache, makeKey } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (p: string): string => readFileSync(join(root, p), "utf8");

test("README quick-start output is exactly what the library produces", () => {
  let now = 0;
  const cache = new Cache({ maxEntries: 1000, defaultTtl: 60_000, clock: () => now });
  const key = makeKey("user", "42");
  assert.equal(key, "user:42");
  cache.set(key, { name: "Ana" }, { tags: ["users"] });
  assert.deepEqual(cache.get(key), { name: "Ana" });
  now = 60_000;
  assert.equal(cache.get(key), null);
  assert.deepEqual(cache.stats(), { hits: 1, misses: 1, sets: 1, deletes: 0, evictions: 0, expirations: 1 });
  assert.ok(read("README.md").includes("{ hits: 1, misses: 1, sets: 1, deletes: 0, evictions: 0, expirations: 1 }"));
});

test("guide recipes behave as documented", () => {
  let now = 0;
  const cache = new Cache({ clock: () => now });
  // fixed-window counter
  const hit = (ip: string): number => cache.increment(makeKey("rl", ip, String(Math.floor(now / 60_000))), 1, { ttl: 60_000 });
  assert.equal(hit("a"), 1);
  assert.equal(hit("a"), 2);
  now = 60_000;
  assert.equal(hit("a"), 1);
  // tag invalidation
  cache.set("post:1", 1, { tags: ["posts"] });
  cache.set("post:2", 2, { tags: ["posts"] });
  assert.equal(cache.invalidateTag("posts"), 2);
  assert.ok(read("docs/guide_how_to_use_LombokCache_v0.1.0.md").includes('cache.invalidateTag("posts");   // 2'));
});
