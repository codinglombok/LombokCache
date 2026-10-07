// Mutation check for GP-11: inject a defect into the compiled TypeScript core and require the
// vector runner to fail. Usage (from repo root, after `npm test` built typescript/dist-test):
//   node scripts/mutation-test.mjs
import { cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = join(root, "typescript");
const tmp = join(ts, ".mut");
const TARGET = "cache.js";
const MUTATIONS = [
  ["e.expiresAt === null || now < e.expiresAt", "e.expiresAt === null || now <= e.expiresAt", "expiry boundary"],
  ["Math.min(now + ttl, MAX_SAFE)", "now + ttl", "expiry clamp"],
  ["ttl < 1 ||", "ttl < 0 ||", "ttl lower bound"],
  ["n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;", "n += 1;", "UTF-8 key length"],
  ["MAX_KEY_BYTES = 250", "MAX_KEY_BYTES = 251", "key length limit"],
  ['.replace(/:/g, "\\\\:")', "", "makeKey colon escaping"],
  ["this.touchRecency(k, e);\n        return copy(e.value);", "return copy(e.value);", "get refreshes recency"],
  ["this.map.size >= this.maxEntries) {", "this.map.size > this.maxEntries) {", "eviction threshold"],
  ["if (!this.live(e, now)) {\n                    this.map.delete(k);\n                    this.st.expirations++;\n                }", "", "purge expired before evicting"],
  ["const oldest = this.map.keys().next().value;", "const oldest = [...this.map.keys()].pop();", "evict least recent"],
  ["if (this.find(k, now) !== undefined)\n            return false;", "if (this.map.has(k))\n            return false;", "add over expired"],
  ["this.st.hits++;", "this.st.hits += 2;", "hit counter"],
  ["this.st.evictions++;", "", "eviction counter"],
  ["return e.expiresAt === null ? -1 : e.expiresAt - now;", "return e.expiresAt === null ? -1 : e.expiresAt;", "ttl remaining"],
  ["if (e === undefined)\n            return -2;", "if (e === undefined)\n            return -1;", "ttl missing code"],
  ["if (!e.tags.includes(t))", "if (e.tags.includes(t))", "tag match"],
  ["const next = cur + by;", "const next = cur - by;", "increment direction"],
  ["return this.increment(key, -by, options);", "return this.increment(key, by, options);", "decrement direction"],
  ["if (!Number.isSafeInteger(next))", "if (false)", "increment overflow"],
  ["const n = this.size();", "const n = this.map.size;", "clear counts live only"],
  ["const ttl = has(o, \"ttl\") && o[\"ttl\"] !== undefined ? checkTtl(o[\"ttl\"]) : this.defaultTtl;", "const ttl = has(o, \"ttl\") && o[\"ttl\"] !== undefined ? checkTtl(o[\"ttl\"]) : null;", "defaultTtl"],
  ["const v = copy(factory());\n        this.st.misses++;", "this.st.misses++;\n        const v = copy(factory());", "remember error accounting"],
];

const src = readFileSync(join(ts, "dist-test", "src", TARGET), "utf8");
let survived = 0;
for (const [find, repl, label] of MUTATIONS) {
  const count = src.split(find).length - 1;
  if (count === 0) { console.log(`SKIP     ${label}: pattern not found`); survived++; continue; }
  rmSync(tmp, { recursive: true, force: true });
  cpSync(join(ts, "dist-test"), tmp, { recursive: true });
  writeFileSync(join(tmp, "src", TARGET), src.split(find).join(repl));
  const r = spawnSync(process.execPath, ["--test", join(tmp, "test", "vectors.test.js")], { encoding: "utf8" });
  const killed = r.status !== 0;
  if (!killed) survived++;
  console.log(`${killed ? "KILLED  " : "SURVIVED"} ${label}`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`\n${MUTATIONS.length - survived}/${MUTATIONS.length} mutants killed`);
process.exit(survived === 0 ? 0 : 1);
