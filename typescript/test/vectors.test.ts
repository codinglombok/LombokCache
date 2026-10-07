import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as lib from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const vectorPath = join(here, "..", "..", "..", "vectors", "lombokcache-vectors-v1.json");
type Case = { name: string; fn: string; args: unknown[]; expect: { result?: unknown; error?: string } };
const doc = JSON.parse(readFileSync(vectorPath, "utf8")) as { groups: { name: string; cases: Case[] }[] };
const api = lib as unknown as Record<string, (...a: unknown[]) => unknown>;

let total = 0;
for (const group of doc.groups) {
  test(`vectors: ${group.name} (${group.cases.length} cases)`, () => {
    for (const k of group.cases) {
      total++;
      const f = api[k.fn];
      assert.equal(typeof f, "function", `${k.name}: unknown fn ${k.fn}`);
      if (k.expect.error !== undefined) {
        assert.throws(() => f!(...k.args), (err: unknown) => err instanceof lib.LombokCacheError && err.code === k.expect.error, k.name);
      } else {
        assert.deepEqual(f!(...k.args), k.expect.result, k.name);
      }
    }
  });
}
test("vector count meets GP-11 (>= 100)", () => {
  assert.ok(total >= 100, `executed ${total}`);
});
