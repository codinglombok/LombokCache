# API LombokCache v0.1.0

Semantik normatif ada di `SPEC_LombokCache_v0.1.0.md`; dokumen ini hanya mendaftar antarmuka yang benar-benar diekspor.

## 1. TypeScript (paket `lombokcache`)

Stabilitas: 0.x, dapat berubah pada rilis minor.

| Simbol | Tanda tangan | Keterangan |
|---|---|---|
| `Cache` | `new Cache(options?: CacheOptions)` | Sejak 0.1.0 |
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
| `Cache#ttl` | `(key) => number` | `-1`, `-2`, atau sisa milidetik |
| `Cache#invalidateTag` | `(tag) => number` | |
| `Cache#prune`, `Cache#size`, `Cache#clear` | `() => number` | |
| `Cache#keys` | `() => string[]` | Urutan recency |
| `Cache#stats` | `() => Stats` | |
| `run` | `(options, steps) => Json[]` | Titik masuk kontrak (skrip) |
| `makeKey` | `(namespace, ...parts) => string` | |
| `validateKey` | `(key) => string` | |
| `OPS`, `MAX_KEY_BYTES` | konstanta | |
| `LombokCacheError` | `extends Error`; `code`, `messageId` | Kode: SPEC bagian 9 |

## 2. Rust (crate `lombokcache`)

Fitur: `std` (bawaan). Tanpa `std`, crate bersifat `no_std + alloc`.

| Simbol | Keterangan |
|---|---|
| `Cache<C: Fn() -> u64>` | `new(CacheOptions, clock) -> Result<Cache>`; metode `set`, `add`, `get`, `peek`, `has`, `delete`, `pull`, `remember(key, FnOnce() -> Result<Value>, &SetOptions)`, `increment`, `decrement`, `touch(key, Ttl)`, `ttl`, `invalidate_tag`, `prune`, `size`, `keys`, `clear`, `stats` |
| `CacheOptions { max_entries, default_ttl }` | |
| `SetOptions { ttl: Ttl, tags }`, `Ttl` (`Default`, `Never`, `Ms(u64)`) | |
| `Stats` | `to_value()` dengan urutan kunci kontrak |
| `run(&Value, &Value)`, `call(fn, args)` | Titik masuk kontrak |
| `make_key(&[&str])`, `validate_key(&str)` | |
| `json::Value`, `parse_json` | JSON internal |
| `Error { code, message }` | `message_id()` |

## 3. Port lain

Belum ada.

## 4. Kompatibilitas lintas bahasa

Untuk skrip yang sama, TypeScript dan Rust menghasilkan keluaran identik pada seluruh vector (142 kasus, 1694 langkah).
