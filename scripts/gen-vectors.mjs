// Generates vectors/lombokcache-vectors-v1.json.
// Group "golden": operation scripts whose outputs are WRITTEN BY HAND (and checked against the
// TypeScript port at generation time; a disagreement aborts generation).
// Group "generated-regression": seeded random scripts whose outputs come from the TypeScript port
// and are cross-checked by the independent Rust port.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import * as lib from "../typescript/dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function call(fn, args) {
  try {
    return { result: JSON.parse(JSON.stringify(lib[fn](...args))) };
  } catch (err) {
    if (!(err instanceof lib.LombokCacheError)) throw err;
    return { error: err.code };
  }
}

const golden = [];
function g(name, fn, args, expect) {
  const got = call(fn, args);
  if (!isDeepStrictEqual(got, expect)) {
    throw new Error(`golden mismatch in "${name}"\n  expected ${JSON.stringify(expect)}\n  got      ${JSON.stringify(got)}`);
  }
  golden.push({ name, fn, args, expect });
}
/** Script case: steps paired with expected outputs, written side by side. */
function script(name, options, pairs) {
  g(`run ${name}`, "run", [options, pairs.map((p) => p[0])], { result: pairs.map((p) => p[1]) });
}
const E = (code) => ({ $error: code });
const S = (hits, misses, sets, deletes, evictions, expirations) => ({ hits, misses, sets, deletes, evictions, expirations });

// ---------------------------------------------------------------- basics
script("set get has delete", {}, [
  [{ op: "get", key: "a" }, null],
  [{ op: "set", key: "a", value: { n: 1, l: [true, null] } }, true],
  [{ op: "get", key: "a" }, { n: 1, l: [true, null] }],
  [{ op: "has", key: "a" }, true],
  [{ op: "delete", key: "a" }, true],
  [{ op: "delete", key: "a" }, false],
  [{ op: "has", key: "a" }, false],
  [{ op: "stats" }, S(1, 1, 1, 1, 0, 0)],
]);
script("get fallback", {}, [
  [{ op: "get", key: "x", fallback: "dflt" }, "dflt"],
  [{ op: "set", key: "x", value: null }, true],
  [{ op: "get", key: "x", fallback: "dflt" }, null],
  [{ op: "has", key: "x" }, true],
]);
script("overwrite keeps one entry", {}, [
  [{ op: "set", key: "k", value: 1 }, true],
  [{ op: "set", key: "k", value: 2 }, true],
  [{ op: "get", key: "k" }, 2],
  [{ op: "size" }, 1],
  [{ op: "stats" }, S(1, 0, 2, 0, 0, 0)],
]);
script("scalar values", {}, [
  [{ op: "set", key: "s", value: "text" }, true],
  [{ op: "set", key: "n", value: -1.5 }, true],
  [{ op: "set", key: "b", value: false }, true],
  [{ op: "get", key: "s" }, "text"],
  [{ op: "get", key: "n" }, -1.5],
  [{ op: "get", key: "b" }, false],
]);

// ---------------------------------------------------------------- TTL
script("ttl expiry boundary is exclusive", {}, [
  [{ op: "set", key: "a", value: 1, options: { ttl: 100 }, at: 1000 }, true],
  [{ op: "get", key: "a", at: 1099 }, 1],
  [{ op: "ttl", key: "a", at: 1099 }, 1],
  [{ op: "get", key: "a", at: 1100 }, null],
  [{ op: "ttl", key: "a" }, -2],
  [{ op: "stats" }, S(1, 1, 1, 0, 0, 1)],
]);
script("ttl -1 for no expiry", {}, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "ttl", key: "a", at: 999999 }, -1],
  [{ op: "ttl", key: "missing" }, -2],
]);
script("defaultTtl applies when ttl absent", { defaultTtl: 50 }, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 2, options: { ttl: null } }, true],
  [{ op: "set", key: "c", value: 3, options: { ttl: 10 } }, true],
  [{ op: "ttl", key: "a" }, 50],
  [{ op: "ttl", key: "b" }, -1],
  [{ op: "ttl", key: "c" }, 10],
  [{ op: "keys", at: 50 }, ["b"]],
  [{ op: "stats" }, S(0, 0, 3, 0, 0, 2)],
]);
script("invalid ttl values", {}, [
  [{ op: "set", key: "a", value: 1, options: { ttl: 0 } }, E("invalid_ttl")],
  [{ op: "set", key: "a", value: 1, options: { ttl: -5 } }, E("invalid_ttl")],
  [{ op: "set", key: "a", value: 1, options: { ttl: 1.5 } }, E("invalid_ttl")],
  [{ op: "set", key: "a", value: 1, options: { ttl: "10" } }, E("invalid_ttl")],
  [{ op: "set", key: "a", value: 1, options: { ttl: 1 } }, true],
  [{ op: "size" }, 1],
]);
script("touch extends and clears expiry", {}, [
  [{ op: "set", key: "a", value: 1, options: { ttl: 10 } }, true],
  [{ op: "touch", key: "a", ttl: 100, at: 5 }, true],
  [{ op: "ttl", key: "a" }, 100],
  [{ op: "touch", key: "a", ttl: null }, true],
  [{ op: "ttl", key: "a", at: 1000 }, -1],
  [{ op: "touch", key: "zz", ttl: 5 }, false],
  [{ op: "touch", key: "a", ttl: 0 }, E("invalid_ttl")],
]);
script("touch without ttl uses defaultTtl", { defaultTtl: 30 }, [
  [{ op: "set", key: "a", value: 1, options: { ttl: null } }, true],
  [{ op: "touch", key: "a", at: 10 }, true],
  [{ op: "ttl", key: "a" }, 30],
]);
script("expired entry is not touched", {}, [
  [{ op: "set", key: "a", value: 1, options: { ttl: 10 } }, true],
  [{ op: "touch", key: "a", ttl: 100, at: 10 }, false],
  [{ op: "stats" }, S(0, 0, 1, 0, 0, 1)],
]);
script("prune counts expirations", {}, [
  [{ op: "set", key: "a", value: 1, options: { ttl: 5 } }, true],
  [{ op: "set", key: "b", value: 1, options: { ttl: 10 } }, true],
  [{ op: "set", key: "c", value: 1 }, true],
  [{ op: "prune", at: 7 }, 1],
  [{ op: "prune", at: 7 }, 0],
  [{ op: "size", at: 10 }, 1],
  [{ op: "stats" }, S(0, 0, 3, 0, 0, 2)],
]);
script("time may go backwards", {}, [
  [{ op: "set", key: "a", value: 1, options: { ttl: 10 }, at: 100 }, true],
  [{ op: "get", key: "a", at: 50 }, 1],
  [{ op: "ttl", key: "a" }, 60],
]);

// ---------------------------------------------------------------- LRU
script("lru evicts least recently used", { maxEntries: 2 }, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 2 }, true],
  [{ op: "get", key: "a" }, 1],
  [{ op: "set", key: "c", value: 3 }, true],
  [{ op: "keys" }, ["a", "c"]],
  [{ op: "has", key: "b" }, false],
  [{ op: "stats" }, S(1, 0, 3, 0, 1, 0)],
]);
script("lru has and peek do not refresh", { maxEntries: 2 }, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 2 }, true],
  [{ op: "has", key: "a" }, true],
  [{ op: "peek", key: "a" }, 1],
  [{ op: "ttl", key: "a" }, -1],
  [{ op: "set", key: "c", value: 3 }, true],
  [{ op: "keys" }, ["b", "c"]],
]);
script("lru overwrite does not evict", { maxEntries: 2 }, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 2 }, true],
  [{ op: "set", key: "a", value: 9 }, true],
  [{ op: "keys" }, ["b", "a"]],
  [{ op: "stats" }, S(0, 0, 3, 0, 0, 0)],
]);
script("lru prefers purging expired over evicting", { maxEntries: 2 }, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 2, options: { ttl: 5 } }, true],
  [{ op: "set", key: "c", value: 3, at: 5 }, true],
  [{ op: "keys" }, ["a", "c"]],
  [{ op: "stats" }, S(0, 0, 3, 0, 0, 1)],
]);
script("lru maxEntries 1", { maxEntries: 1 }, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 2 }, true],
  [{ op: "get", key: "a" }, null],
  [{ op: "get", key: "b" }, 2],
  [{ op: "stats" }, S(1, 1, 2, 0, 1, 0)],
]);
script("lru touch and increment refresh", { maxEntries: 3 }, [
  [{ op: "set", key: "a", value: 0 }, true],
  [{ op: "set", key: "b", value: 0 }, true],
  [{ op: "set", key: "c", value: 0 }, true],
  [{ op: "increment", key: "a" }, 1],
  [{ op: "touch", key: "b", ttl: null }, true],
  [{ op: "set", key: "d", value: 0 }, true],
  [{ op: "keys" }, ["a", "b", "d"]],
]);
script("lru add on full cache", { maxEntries: 2 }, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 2 }, true],
  [{ op: "add", key: "a", value: 5 }, false],
  [{ op: "add", key: "c", value: 3 }, true],
  [{ op: "keys" }, ["b", "c"]],
]);

// ---------------------------------------------------------------- add, pull, remember
script("add only when absent or expired", {}, [
  [{ op: "add", key: "a", value: 1, options: { ttl: 10 } }, true],
  [{ op: "add", key: "a", value: 2 }, false],
  [{ op: "get", key: "a" }, 1],
  [{ op: "add", key: "a", value: 3, at: 10 }, true],
  [{ op: "get", key: "a" }, 3],
  [{ op: "stats" }, S(2, 0, 2, 0, 0, 1)],
]);
script("pull returns and removes", {}, [
  [{ op: "set", key: "a", value: [1] }, true],
  [{ op: "pull", key: "a" }, [1]],
  [{ op: "pull", key: "a", fallback: 0 }, 0],
  [{ op: "has", key: "a" }, false],
  [{ op: "stats" }, S(1, 1, 1, 1, 0, 0)],
]);
script("remember computes once", {}, [
  [{ op: "remember", key: "r", value: "computed" }, "computed"],
  [{ op: "remember", key: "r", value: "other" }, "computed"],
  [{ op: "stats" }, S(1, 1, 1, 0, 0, 0)],
]);
script("remember respects ttl", {}, [
  [{ op: "remember", key: "r", value: 1, options: { ttl: 10 } }, 1],
  [{ op: "remember", key: "r", value: 2, at: 10 }, 2],
  [{ op: "ttl", key: "r" }, -1],
]);

// ---------------------------------------------------------------- counters
script("remember invalid value counts no miss", {}, [
  [{ op: "remember", key: "r" }, E("invalid_value")],
  [{ op: "stats" }, S(0, 0, 0, 0, 0, 0)],
  [{ op: "has", key: "r" }, false],
]);
script("expiry clamped to 2^53-1", {}, [
  [{ op: "set", key: "a", value: 1, options: { ttl: 9007199254740991 }, at: 9007199254740986 }, true],
  [{ op: "ttl", key: "a" }, 5],
  [{ op: "get", key: "a", at: 9007199254740991 }, null],
]);
script("decrement validates key first", {}, [
  [{ op: "decrement", key: "", by: "x" }, E("invalid_key")],
  [{ op: "increment", key: "", by: "x" }, E("invalid_key")],
]);
script("increment and decrement", {}, [
  [{ op: "increment", key: "c" }, 1],
  [{ op: "increment", key: "c", by: 5 }, 6],
  [{ op: "decrement", key: "c", by: 2 }, 4],
  [{ op: "decrement", key: "d" }, -1],
  [{ op: "increment", key: "z", by: 0 }, 0],
  [{ op: "get", key: "c" }, 4],
  [{ op: "stats" }, S(1, 0, 5, 0, 0, 0)],
]);
script("increment keeps expiry and tags", {}, [
  [{ op: "set", key: "c", value: 1, options: { ttl: 100, tags: ["t"] } }, true],
  [{ op: "increment", key: "c", by: 1, options: { ttl: 5 }, at: 50 }, 2],
  [{ op: "ttl", key: "c" }, 50],
  [{ op: "invalidateTag", tag: "t" }, 1],
]);
script("increment new key uses ttl", {}, [
  [{ op: "increment", key: "c", options: { ttl: 5 } }, 1],
  [{ op: "get", key: "c", at: 5 }, null],
]);
script("increment errors", {}, [
  [{ op: "set", key: "s", value: "x" }, true],
  [{ op: "increment", key: "s" }, E("invalid_value")],
  [{ op: "set", key: "f", value: 1.5 }, true],
  [{ op: "increment", key: "f" }, E("invalid_value")],
  [{ op: "increment", key: "n", by: 1.5 }, E("invalid_value")],
  [{ op: "increment", key: "n", by: "1" }, E("invalid_value")],
  [{ op: "set", key: "big", value: 9007199254740991 }, true],
  [{ op: "increment", key: "big" }, E("invalid_value")],
  [{ op: "get", key: "big" }, 9007199254740991],
  [{ op: "decrement", key: "n", by: null }, E("invalid_value")],
  [{ op: "has", key: "n" }, false],
]);

// ---------------------------------------------------------------- tags
script("invalidate tag", {}, [
  [{ op: "set", key: "u:1", value: 1, options: { tags: ["users"] } }, true],
  [{ op: "set", key: "u:2", value: 2, options: { tags: ["users", "vip"] } }, true],
  [{ op: "set", key: "p:1", value: 3, options: { tags: ["posts"] } }, true],
  [{ op: "invalidateTag", tag: "users" }, 2],
  [{ op: "keys" }, ["p:1"]],
  [{ op: "invalidateTag", tag: "vip" }, 0],
  [{ op: "invalidateTag", tag: "none" }, 0],
  [{ op: "stats" }, S(0, 0, 3, 2, 0, 0)],
]);
script("invalidate tag counts expired separately", {}, [
  [{ op: "set", key: "a", value: 1, options: { tags: ["t"], ttl: 5 } }, true],
  [{ op: "set", key: "b", value: 1, options: { tags: ["t"] } }, true],
  [{ op: "invalidateTag", tag: "t", at: 5 }, 1],
  [{ op: "stats" }, S(0, 0, 2, 1, 0, 1)],
]);
script("overwrite replaces tags", {}, [
  [{ op: "set", key: "a", value: 1, options: { tags: ["t"] } }, true],
  [{ op: "set", key: "a", value: 2 }, true],
  [{ op: "invalidateTag", tag: "t" }, 0],
  [{ op: "get", key: "a" }, 2],
]);
script("invalid tags", {}, [
  [{ op: "set", key: "a", value: 1, options: { tags: "t" } }, E("invalid_option")],
  [{ op: "set", key: "a", value: 1, options: { tags: [""] } }, E("invalid_key")],
  [{ op: "set", key: "a", value: 1, options: { tags: [1] } }, E("invalid_key")],
  [{ op: "invalidateTag", tag: "" }, E("invalid_key")],
  [{ op: "size" }, 0],
]);

// ---------------------------------------------------------------- keys and values
const k250 = "k".repeat(250);
script("key validation", {}, [
  [{ op: "set", key: "", value: 1 }, E("invalid_key")],
  [{ op: "set", key: 5, value: 1 }, E("invalid_key")],
  [{ op: "set", value: 1 }, E("invalid_key")],
  [{ op: "set", key: "a\nb", value: 1 }, E("invalid_key")],
  [{ op: "set", key: "a\u007fb", value: 1 }, E("invalid_key")],
  [{ op: "set", key: k250, value: 1 }, true],
  [{ op: "set", key: k250 + "k", value: 1 }, E("invalid_key")],
  [{ op: "set", key: "\u00e9".repeat(125), value: 1 }, true],
  [{ op: "set", key: "\u00e9".repeat(125) + "x", value: 1 }, E("invalid_key")],
  [{ op: "set", key: "\u{1F600}".repeat(62) + "xx", value: 1 }, true],
  [{ op: "set", key: "a b:c/{d}", value: 1 }, true],
  [{ op: "get", key: null }, E("invalid_key")],
  [{ op: "size" }, 4],
]);
script("value validation", {}, [
  [{ op: "set", key: "a" }, E("invalid_value")],
  [{ op: "set", key: "a", value: { x: { y: [1] } } }, true],
  [{ op: "get", key: "a" }, { x: { y: [1] } }],
]);
script("unknown set option", {}, [
  [{ op: "set", key: "a", value: 1, options: { tll: 5 } }, E("invalid_option")],
  [{ op: "set", key: "a", value: 1, options: 5 }, E("invalid_option")],
  [{ op: "has", key: "a" }, false],
]);
script("clear", {}, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 1, options: { ttl: 1 } }, true],
  [{ op: "clear", at: 1 }, 1],
  [{ op: "size" }, 0],
  [{ op: "stats" }, S(0, 0, 2, 1, 0, 1)],
]);
script("keys order is recency", {}, [
  [{ op: "set", key: "a", value: 1 }, true],
  [{ op: "set", key: "b", value: 1 }, true],
  [{ op: "set", key: "c", value: 1 }, true],
  [{ op: "get", key: "a" }, 1],
  [{ op: "remember", key: "b", value: 0 }, 1],
  [{ op: "keys" }, ["c", "a", "b"]],
]);

g("run options must be object", "run", [null, []], { error: "invalid_option" });
g("run rejects clock option", "run", [{ clock: 1 }, []], { error: "invalid_option" });
g("run unknown option", "run", [{ max: 1 }, []], { error: "invalid_option" });
g("run maxEntries zero", "run", [{ maxEntries: 0 }, []], { error: "invalid_option" });
g("run maxEntries fraction", "run", [{ maxEntries: 1.5 }, []], { error: "invalid_option" });
g("run defaultTtl zero", "run", [{ defaultTtl: 0 }, []], { error: "invalid_option" });
g("run steps not array", "run", [{}, {}], { error: "invalid_option" });
g("run unknown op", "run", [{}, [{ op: "flush" }]], { error: "invalid_option" });
g("run step without op", "run", [{}, [{ key: "a" }]], { error: "invalid_option" });
g("run negative at", "run", [{}, [{ op: "size", at: -1 }]], { error: "invalid_option" });
g("run empty script", "run", [{}, []], { result: [] });

// makeKey
const MK = (name, args, r) => g(`makeKey ${name}`, "makeKey", args, r);
MK("namespace only", ["users"], { result: "users" });
MK("parts joined", ["users", "42", "profile"], { result: "users:42:profile" });
MK("colon escaped", ["a:b", "c"], { result: "a\\:b:c" });
MK("backslash escaped", ["a\\", "b"], { result: "a\\\\:b" });
MK("escaping is injective", ["a", "b:c"], { result: "a:b\\:c" });
MK("empty part rejected", ["a", ""], { error: "invalid_key" });
MK("non-string part rejected", ["a", 1], { error: "invalid_key" });
MK("too long rejected", ["a", "b".repeat(249)], { error: "invalid_key" });
MK("control rejected", ["a\tb"], { error: "invalid_key" });
g("validateKey ok", "validateKey", ["k"], { result: "k" });
g("validateKey empty", "validateKey", [""], { error: "invalid_key" });

// ---------------------------------------------------------------- generated regression
let seed = 0xcace1234;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const OPS = ["set", "set", "set", "get", "get", "has", "add", "delete", "pull", "remember", "increment", "decrement", "touch", "ttl", "invalidateTag", "prune", "size", "keys", "peek", "stats"];
const KEYS = ["a", "b", "c", "d", "e"];
const VALUES = [0, 1, -3, 2.5, "s", null, true, [1, 2], { k: "v" }];
const generated = [];
for (let i = 0; i < 80; i++) {
  const options = {};
  if (rnd() < 0.6) options.maxEntries = 1 + Math.floor(rnd() * 4);
  if (rnd() < 0.4) options.defaultTtl = 1 + Math.floor(rnd() * 20);
  const steps = [];
  let t = 0;
  for (let k = 0; k < 15 + Math.floor(rnd() * 15); k++) {
    const op = pick(OPS);
    const s = { op };
    if (rnd() < 0.4) { t += Math.floor(rnd() * 8); s.at = t; }
    if (!["prune", "size", "keys", "stats", "invalidateTag"].includes(op)) s.key = pick(KEYS);
    if (["set", "add", "remember"].includes(op)) s.value = pick(VALUES);
    if (["increment", "decrement"].includes(op) && rnd() < 0.5) s.by = pick([1, 2, -1, 0, 1.5]);
    if (["set", "add", "remember", "increment"].includes(op) && rnd() < 0.6) {
      s.options = {};
      if (rnd() < 0.7) s.options.ttl = pick([null, 1, 3, 10, 0]);
      if (rnd() < 0.5) s.options.tags = [pick(["x", "y"])];
    }
    if (op === "touch" && rnd() < 0.7) s.ttl = pick([null, 2, 5]);
    if (op === "invalidateTag") s.tag = pick(["x", "y"]);
    steps.push(s);
  }
  generated.push({ name: `generated ${String(i + 1).padStart(3, "0")} script`, fn: "run", args: [options, steps], expect: call("run", [options, steps]) });
}

const doc = {
  format: "lombokcache-vectors-v1",
  specVersion: "0.1.0",
  note: "Normative cross-language vectors. Each case calls `fn` with `args`; `expect` is {result} or {error: code}. `run` scripts set the clock with `at`.",
  groups: [
    { name: "golden", cases: golden },
    { name: "generated-regression", cases: generated },
  ],
};
// ASCII-only file: non-ASCII characters are written as JSON \u escapes (UTF-16 code units).
const ascii = JSON.stringify(doc, null, 1).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
writeFileSync(join(root, "vectors", "lombokcache-vectors-v1.json"), ascii + "\n");
const sha = createHash("sha256").update(readFileSync(join(root, "vectors", "lombokcache-vectors-v1.json"))).digest("hex");
const steps = golden.concat(generated).reduce((n, c) => n + (c.fn === "run" && Array.isArray(c.args[1]) ? c.args[1].length : 1), 0);
console.log(`golden=${golden.length} generated=${generated.length} total=${golden.length + generated.length} steps=${steps} sha256=${sha}`);
