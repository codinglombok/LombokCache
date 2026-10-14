# API LombokCache v0.1.0

Normative semantics are in `SPEC_LombokCache_v0.1.0.md`; this document only lists the interfaces that are actually exported.

## 1. TypeScript (package `lombokcache`)

Stability: 0.x, may change in minor releases.

| Symbol | Signature | Notes |
|---|---|---|
| `Cache` | `new Cache(options?: CacheOptions)` | Since 0.1.0 |
| `CacheOptions` | `{ maxEntries?: number; defaultTtl?: number \| null; clock?: () => number }` | |
| `SetOptions` | `{ ttl?: number \| null; tags?: string[] }` | |
| `Cache#set` | `(key, value, options?) => true` | |
| `Cache#add` | `(key, value, options?) => boolean` | |
| `Cache#get` | `(key, fallback = null) => Json` | |
| `Cache#peek`, `Cache#has`, `Cache#delete` | `(key) => Json \| boolean` | |
| `Cache#pull` | `(key, fallback = null) => Json` | |
| `Cache#remember` | `(key, factory: () => unknown, options?) => Json` | |
| `Cache#increment`, `Cache#decrement` | `(key, by = 1, options?) => number` | |
| `Cache#touch` | `(key, ttl?) => boolean` | |
| `Cache#ttl` | `(key) => number` | `-1`, `-2`, or the remaining milliseconds |
| `Cache#invalidateTag` | `(tag) => number` | |
| `Cache#prune`, `Cache#size`, `Cache#clear` | `() => number` | |
| `Cache#keys` | `() => string[]` | Recency order |
| `Cache#stats` | `() => Stats` | |
| `run` | `(options, steps) => Json[]` | Contract entry point (scripts) |
| `makeKey` | `(namespace, ...parts) => string` | |
| `validateKey` | `(key) => string` | |
| `OPS`, `MAX_KEY_BYTES` | constants | |
| `LombokCacheError` | `extends Error`; `code`, `messageId` | Codes: SPEC section 9 |

## 2. Rust (crate `lombokcache`)

Feature: `std` (default). Without `std`, the crate is `no_std + alloc`.

| Symbol | Notes |
|---|---|
| `Cache<C: Fn() -> u64>` | `new(CacheOptions, clock) -> Result<Cache>`; methods `set`, `add`, `get`, `peek`, `has`, `delete`, `pull`, `remember(key, FnOnce() -> Result<Value>, &SetOptions)`, `increment`, `decrement`, `touch(key, Ttl)`, `ttl`, `invalidate_tag`, `prune`, `size`, `keys`, `clear`, `stats` |
| `CacheOptions { max_entries, default_ttl }` | |
| `SetOptions { ttl: Ttl, tags }`, `Ttl` (`Default`, `Never`, `Ms(u64)`) | |
| `Stats` | `to_value()` with the contract key order |
| `run(&Value, &Value)`, `call(fn, args)` | Contract entry points |
| `make_key(&[&str])`, `validate_key(&str)` | |
| `json::Value`, `parse_json` | Internal JSON |
| `Error { code, message }` | `message_id()` |

## 3. Other ports

None yet.

## 4. Cross-language compatibility

For the same script, TypeScript and Rust produce identical output on all vectors (142 cases, 1694 steps).
