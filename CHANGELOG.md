# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/); the newest entry comes first. Versions follow [SemVer](https://semver.org/).

## [0.1.0] - 2026-10-07

### Added
- `Cache` with `set`, `add`, `get`, `peek`, `has`, `delete`, `pull`, `remember`, `increment`, `decrement`, `touch`, `ttl`, `invalidateTag`, `prune`, `size`, `keys`, `clear`, `stats`.
- TTL with an injectable clock, LRU eviction with `maxEntries`, tags, and statistics.
- `run` as the script-based contract entry point; `makeKey` and `validateKey`.
- Rust port (`no_std + alloc`, no dependencies) and TypeScript port (no runtime dependencies).
- Shared vectors of 142 cases (62 golden cases with hand-written expectations, 80 generated regression scripts; 1694 operation steps), executed by the Rust and TypeScript runners.
- Pseudo-fuzzing and a mutation-testing script (22 mutants).

### Security
- An expired entry is never returned; the number of entries never exceeds `maxEntries`.
- Values are copied on the way in and out; `makeKey` is injective.
