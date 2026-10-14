# Development IDE LombokCache v0.1.0

## 1. Roadmap

| Version | Content |
|---|---|
| 0.1.1 | Close the release conditions: CI run, `doctor docs/privacy/style`, coverage measured, a `cargo-fuzz` target |
| 0.2.0 | An adapter interface (files, databases through LombokSQL, Redis); size limits in bytes; Python, Go and PHP ports |
| 0.3.0 | Stampede protection and background refresh; an O(1) tag index; a thread-safe variant in Rust |

## 2. Deferred scope

See the Non-goals section of the SPEC and the README (Known limitations).

## 3. Design principles for contributors

- Contract first, tests first; all ports pass the same vectors.
- No runtime dependencies; dev dependencies are recorded.
- Core functions are pure: the clock, randomness and I/O are supplied by the caller.
- All time comes from the caller's clock.
- Every semantic edge case (TTL boundary, recency, eviction) is covered by a golden vector.
- English is the default language for all documents, code comments and messages.

## 4. How to contribute

See `CONTRIBUTING.md`.

## 5. Open questions

- Should `increment` on an existing key be able to extend the TTL through an option?
- Should `has` update recency (the behavior of some libraries)?
