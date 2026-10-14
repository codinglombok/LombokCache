# Tech Debt LombokCache

Format: ID, finding, priority, fix, status. Priority P0 blocks the tag 0.1.0; P1 blocks a minor release.

| ID | Finding | Priority | Fix | Status |
|---|---|---|---|---|
| TD-01 | `ci.yml` had not been run on GitHub Actions yet; actions are not pinned to SHAs | P0 | Run it in the repository, pin SHAs, enable Dependabot (see LombokSQL for the pattern) | OPEN |
| TD-02 | `lombok doctor docs/privacy/style` does not exist yet (ecosystem TD-P0-08); automatic checks are limited to `docs.test.ts` | P0 | Run it once `codinglombok/.github` exists | OPEN |
| TD-03 | Coverage not measured; target 90% | P1 | Add Rust and TS coverage jobs | OPEN |
| TD-04 | Fuzzing is not `cargo-fuzz`; no Rust fuzzing | P1 | A `cargo-fuzz` target for `call` | OPEN |
| TD-05 | Only Rust and TypeScript; Python, Go and PHP ports NOT YET | P1 | Planned for 0.2.0 | OPEN |
| TD-06 | Copies of `LICENSE-*` in `rust/` | P3 | Automate the copy at release time | OPEN |
| TD-07 | The 80 regression scripts take their expectations from TypeScript (confirmed by the Rust port); only the 62 golden cases are independent | P3 | Manually review a sample of the regression scripts | OPEN |
| TD-08 | Tag-based operations and purging cost O(n) | P2 | A tag index and an expiry queue | OPEN |
| TD-09 | Performance not measured (benchmarks) | P2 | Add simple benchmarks per port | OPEN |

Closed in 0.1.0: `no_std` is proven by a `thumbv7em-none-eabi` build, and clippy/rustfmt run with `-D warnings` (locally; CI runs the same).
