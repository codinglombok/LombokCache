# SPEC LombokCache v0.1.0

This document is the normative cross-language contract. Every language port MUST produce byte-identical output for all specified inputs. Deviations from this specification are bugs.

The key words MUST, MUST NOT, SHOULD and MAY are to be interpreted as in RFC 2119 and RFC 8174.

| Attribute | Value |
|---|---|
| Contract version | 0.1.0 |
| Review date of reference standards | 2026-10-07 |
| Vectors | `vectors/lombokcache-vectors-v1.json` |
| Vector SHA-256 | `24e5dfcebc1aaab7021ceea1a0d73675cf1d7e1a0dd7b84fe591ab3b735e3601` |

## 0. Reference standards (U2)

| Reference | Version | Use |
|---|---|---|
| RFC 8259 | December 2017 | Stored values are JSON data |
| RFC 3629 | November 2003 | Key length in UTF-8 bytes |
| Redis `TTL` command | 7.x | The convention of the values `-1` and `-2` in `ttl` |
| RFC 2119, RFC 8174 | 1997, 2017 | Normative key words |

## 1. Vectors

The vector file contains `{ format, specVersion, note, groups }`. Each case contains `name`, `fn`, `args` and `expect` (`{ "result": ... }` or `{ "error": code }`). The function `run(options, steps)` runs a script on a fresh cache and produces one output per step. Every claimed port MUST run all cases and produce structurally equal output. The SHA-256 hash of the file MUST equal the one in the attribute table.

## 2. Model

The cache stores entries `{ value, expiresAt, tags }` and a usage order (recency). Time is an integer number of milliseconds in 0..2^53-1 read from the caller's clock on every operation; a clock that returns any other value MUST produce `invalid_option`. Time may go backwards.

An entry is **alive** at time `now` if `expiresAt` is null or `now < expiresAt`. `expiresAt = min(now + ttl, 2^53 - 1)`. An entry that is not alive is removed lazily when an operation touches its key and is counted as `expirations`.

**Keys and tags**: strings of 1..250 UTF-8 bytes without U+0000..U+001F and U+007F; otherwise `invalid_key`.

**Values**: JSON data (null, boolean, finite number, string, array, object) with a depth of at most 512; otherwise `invalid_value`. A value MUST be copied when it is stored and when it is returned.

**TTL**: an integer of 1..2^53-1 milliseconds, or `null` (no expiry); otherwise `invalid_ttl`. When it is not given, `defaultTtl` applies.

**Write options**: an object with the keys `ttl` and `tags` (an array of keys); other keys, a non-object, or `tags` that is not an array MUST produce `invalid_option`.

## 3. Cache options

`maxEntries`: an integer of 1..2^53-1 or absent (unbounded). `defaultTtl`: a TTL or `null`. Other keys MUST produce `invalid_option`. In `run`, `clock` MUST be rejected (`invalid_option`) because the clock is controlled by the steps.

## 4. Operations

Every operation validates its arguments in the order of the "Validation" column before changing anything; the only change that may happen before an error is the lazy removal of expired entries (section 2).

| Operation | Validation | Result and effect |
|---|---|---|
| `set(key, value, options?)` | key, options, value | `true`. Stores (section 5) |
| `add(key, value, options?)` | key, options, value | `false` if a live entry exists; otherwise stores and `true` |
| `get(key, fallback?)` | key | The value of a live entry (hit, recency updated) or `fallback` (default null; miss) |
| `peek(key)` | key | The value of a live entry or null; no recency, no statistics, no removal |
| `has(key)` | key | Boolean; no recency and no statistics |
| `delete(key)` | key | `true` and `deletes`+1 if a live entry is removed; otherwise `false` |
| `pull(key, fallback?)` | key | Like `get`, then the entry is removed (`deletes`+1) if it existed |
| `remember(key, factory, options?)` | key, options | Hit: the value (recency updated). Miss: the factory result is validated as a value, then `misses`+1 and it is stored |
| `increment(key, by=1, options?)` | key, `by` a safe integer (`invalid_value`), options | No live entry: stores `by` with the TTL and tags from the options. Entry exists: the value MUST be a safe integer (`invalid_value`), and the result MUST be safe (`invalid_value`); expiry and tags are kept; recency is updated; `sets`+1 |
| `decrement(key, by=1, options?)` | key, `by` | `increment(key, -by, options)` |
| `touch(key, ttl?)` | key, ttl | `false` if there is no live entry; otherwise expiry is reset, recency is updated, `true` |
| `ttl(key)` | key | `-2` no live entry; `-1` no expiry; otherwise `expiresAt - now` |
| `invalidateTag(tag)` | tag (`invalid_key`) | Removes every tagged entry; returns the number that were alive (`deletes`); those that were not alive are counted as `expirations` |
| `prune()` | - | Removes every entry that is not alive; returns their count |
| `size()` | - | `prune`, then the number of entries |
| `keys()` | - | `prune`, then the keys from least recently to most recently used |
| `clear()` | - | `size`, then everything is removed; `deletes` increases by the result of `size` |
| `stats()` | - | `{ hits, misses, sets, deletes, evictions, expirations }` in this key order |

Recency is updated by: storing, a `get`/`pull`/`remember` hit, `increment` on an existing entry, and `touch`.

## 5. Storing and eviction

Storing key `k`: if `maxEntries` is present, `k` is not yet stored (alive or not), and the number of stored entries has already reached `maxEntries`, then (1) all entries that are not alive are removed (`expirations`), and then (2) while the number of entries still reaches `maxEntries`, the least recently used entry is removed (`evictions`). Then the entry for `k` is written (replacing the old entry together with its tags) as the most recently used and `sets`+1.

## 6. Scripts (`run`)

`run(options, steps)`: `options` MUST be an object (section 3); `steps` MUST be an array. The clock starts at 0. Every step MUST be an object whose `op` is one of the operation names of section 4; if `at` is present, it MUST be an integer in 0..2^53-1 and the clock is set to that value before the operation. A violation fails the whole script with `invalid_option`.

Arguments are taken from the keys of the step: `key`, `value`, `options`, `fallback`, `by`, `ttl` (for `touch`), `tag`. A missing key means the argument is not given; for `remember`, the factory returns `value` (missing: `invalid_value`). A step that fails produces `{ "$error": code }` and the script continues.

## 7. makeKey

`makeKey(namespace, ...parts)`: every part MUST be a non-empty string (`invalid_key`). Every part is escaped (`\` becomes `\\`, then `:` becomes `\:`) and the parts are joined with `:`; the result MUST be a valid key. `validateKey(key)` returns the key or `invalid_key`.

## 8. Security

- An entry that is not alive MUST never be returned.
- The number of entries MUST never exceed `maxEntries` after any operation.
- A returned value MUST be a copy; modification by the caller does not affect the cache.
- `makeKey` MUST be injective: different lists of parts produce different keys.
- Any input MUST produce a result or an error with a `code` from section 9; a panic or any other exception is a bug.

## 9. Errors

| `code` | Condition | `messageId` |
|---|---|---|
| `invalid_key` | invalid key or tag | `lombokcache.error.invalid_key` |
| `invalid_ttl` | invalid TTL | `lombokcache.error.invalid_ttl` |
| `invalid_option` | invalid cache option, write option, clock or script step | `lombokcache.error.invalid_option` |
| `invalid_value` | the value is not JSON data, or is not a safe integer for a counter | `lombokcache.error.invalid_value` |

## 10. Non-goals (0.1.0)

External storage adapters, concurrent access between threads or processes, stampede protection, size limits in bytes, and serialization of the cache content.

## 11. Contract change history

| Version | Change |
|---|---|
| 0.1.0 | Initial contract |
