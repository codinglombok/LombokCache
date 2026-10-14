# Full Summary LombokCache v0.1.0

## What it is

A deterministic in-memory cache with TTL driven by an injected clock, LRU eviction, tags, counters and statistics, whose behavior is specified down to the edge cases.

## Why it exists

A simple cache is easy to write but hard to test because it depends on the system clock, and its edge semantics (the expiry boundary, whether a read updates the LRU order, when eviction happens) differ between implementations. A shared contract makes the same behavior testable in every language without waiting for time to pass.

## Main features

See the README (Features section). All features are covered by vectors.

## Current status

Complete code for Rust and TypeScript; passes 142 vector cases; not yet published to any registry; does not yet meet the release score rule (see `TECH_DEBT.md`).

## Example users

See the README (usage scenarios).

## Known Limitations

- In-process only; no external adapters.
- The Rust port is not thread-safe without a `Mutex` wrapper.
- `invalidateTag`, `prune` and the purge before eviction cost O(n).
- No stampede protection and no size limit in bytes.
- Only two ports (Rust, TypeScript); fuzzing is pseudo-fuzzing, not `cargo-fuzz`; no third-party audit; coverage not measured yet.

## More information

`SPEC_`, `API_`, `development_ide_`.

## Gap vs comparators (U6)

The comparison is qualitative and based on general knowledge of each category of library; it has not been verified feature by feature on 2026-10-07.

| Comparator (category) | What the comparator has that LombokCache does not | What LombokCache offers |
|---|---|---|
| In-process caches (lru-cache, node-cache, moka, cachetools, Caffeine) | Concurrency, size-based limits, advanced statistics, asynchronous refresh, proven performance | A cross-language semantic contract with shared scripts; an injected clock; tags; a `no_std + alloc` core |
| Distributed caches (Redis, Memcached) | Sharing between processes, persistence, replication | No server; deterministically testable |
