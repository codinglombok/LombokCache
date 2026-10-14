# LombokCache

[![License](https://img.shields.io/badge/license-Apache--2.0%20OR%20MIT-blue)](LICENSE-APACHE)

A **deterministic** in-memory cache: TTL with an injectable clock, LRU eviction, tags for grouped invalidation, in-process atomic counters, and statistics. No runtime dependencies. Behavior is identical in every port and is proven by shared operation scripts.

Part of the [Lombok Ecosystem](https://github.com/codinglombok).

## Why this library?

A simple cache is easy to write but hard to test: TTL depends on the system clock, eviction order is rarely specified, and edge semantics (does an entry expire exactly at second 60 or after it, does `has` refresh the LRU order) differ between implementations. LombokCache specifies all of this normatively. Because the clock is supplied by the caller, TTL behavior can be tested without `sleep`.

Usage scenarios:

- **Web services and APIs**: cache query results and responses with per-tag invalidation (`users`, `posts`).
- **Rate limiting and counters**: `increment` with a TTL for time windows.
- **CLI tools and batch jobs**: memoize expensive results with `remember`.
- **Serverless and edge**: a per-instance cache with a `maxEntries` limit to keep memory under control.
- **Embedded devices**: a `no_std + alloc` Rust core with a clock from a hardware timer.

Other dependents in the Lombok Ecosystem are listed in `docs/map_LombokCache_v0.1.0.md`.

## Features

Every feature below is covered by vectors in `vectors/` and by TypeScript tests.

- `set`, `add`, `get` (with a fallback), `peek`, `has`, `delete`, `pull`, `remember`.
- A TTL per entry or `defaultTtl`; an entry is alive while `now < expiresAt`; Redis-style `ttl` (`-1` for no expiry, `-2` for missing); `touch`.
- LRU with `maxEntries`: expired entries are purged first, before any eviction.
- Tags: `invalidateTag` removes every tagged entry.
- Safe-integer `increment`/`decrement`; a new key starts at 0.
- `stats`: `hits`, `misses`, `sets`, `deletes`, `evictions`, `expirations`.
- `makeKey` for namespaced keys that are escaped injectively.
- Values are copied on the way in and on the way out (no aliasing); JSON data only.

## Installation

Not published to any registry yet. After the first release:

```bash
npm install lombokcache      # TypeScript / JavaScript
cargo add lombokcache        # Rust
```

## Quick Start

### TypeScript

```ts
import { Cache, makeKey } from "lombokcache";

let now = 0;
const cache = new Cache({ maxEntries: 1000, defaultTtl: 60_000, clock: () => now });

const key = makeKey("user", "42");          // "user:42"
cache.set(key, { name: "Ana" }, { tags: ["users"] });
cache.get(key);                              // { name: "Ana" }
now = 60_000;
cache.get(key);                              // null (expired)
cache.stats();                               // { hits: 1, misses: 1, sets: 1, deletes: 0, evictions: 0, expirations: 1 }
```

### Rust

```rust
use lombokcache::{Cache, CacheOptions, SetOptions, Ttl, Value};
use core::cell::Cell;

let now = Cell::new(0u64);
let mut cache = Cache::new(CacheOptions { max_entries: Some(2), default_ttl: None }, || now.get()).unwrap();
cache.set("a", &Value::Num(1.0), &SetOptions { ttl: Ttl::Ms(100), tags: vec![] }).unwrap();
now.set(100);
assert_eq!(cache.get("a").unwrap(), None);
```

## Port status

| Port | Status | Evidence |
|---|---|---|
| Rust (`no_std + alloc`) | YES, passes the vectors | `rust/tests/vectors.rs` runs every vector; `thumbv7em-none-eabi` build |
| TypeScript | YES, passes the vectors | `typescript/test/vectors.test.ts` runs every vector, plus aliasing tests and invariant fuzzing |
| Python, Go, PHP, Java, Kotlin, C#, C/C++, Swift, Perl | NOT YET | No code; planned once the contract is stable (see `docs/development_ide_LombokCache_v0.1.0.md`) |

Vectors: 142 cases containing 1694 operation steps (62 golden cases with hand-written expectations, 80 generated regression scripts).

## Standards implemented

There is no formal standard for an in-memory cache. The semantics of `ttl` follow the Redis `TTL` command convention (`-1`, `-2`); the full contract is in `docs/SPEC_LombokCache_v0.1.0.md`.

## Known limitations

- In-process only; there is no Redis, file or database adapter in 0.1.0.
- Not thread-safe in Rust (`&mut self`); wrap it in a `Mutex` when sharing between threads.
- `invalidateTag`, `prune` and the purge before eviction cost O(n).
- There is no stampede protection (`remember` does not hold back other callers).
- Only Rust and TypeScript have code. Fuzzing is pseudo-fuzzing, not `cargo-fuzz`.

## Lombok Ecosystem

LombokCache has no required dependency on other Lombok libraries (L0). Other libraries may use it optionally; the dependents are listed in `docs/map_LombokCache_v0.1.0.md`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

`Apache-2.0 OR MIT`. See [LICENSE-APACHE](LICENSE-APACHE) and [LICENSE-MIT](LICENSE-MIT).
