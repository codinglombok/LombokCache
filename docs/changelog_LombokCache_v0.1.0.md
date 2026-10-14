# Changelog LombokCache (summary)

The newest entry comes first. Details are in `CHANGELOG.md`.

## 0.1.0 - 2026-10-07

### Added
- `Cache` with TTL, LRU, tags, counters and statistics; `run`, `makeKey`.
- Rust `no_std + alloc` port and TypeScript port.
- 142 vectors; runners in both ports; fuzzing and mutation testing.

### Security
- An expired entry is never returned; the number of entries never exceeds `maxEntries`.
- Values are copied on the way in and out; `makeKey` is injective.
