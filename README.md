# LombokCache

[![License](https://img.shields.io/badge/license-Apache--2.0%20OR%20MIT-blue)](LICENSE-APACHE)

Cache in-memory yang **deterministik**: TTL dengan jam yang dapat disuntikkan, eviksi LRU, tag untuk invalidasi berkelompok, counter atomik dalam proses, dan statistik. Tanpa dependensi runtime. Perilakunya identik di setiap port dan dibuktikan dengan skrip operasi bersama.

Part of the [Lombok Ecosystem](https://github.com/codinglombok).

## Mengapa library ini?

Cache sederhana mudah ditulis tetapi sulit diuji: TTL bergantung pada jam sistem, urutan eviksi jarang dispesifikasikan, dan semantik tepi (apakah entri kedaluwarsa tepat pada detik ke-60 atau sesudahnya, apakah `has` memperbarui urutan LRU) berbeda antar implementasi. LombokCache menetapkan semua itu secara normatif. Karena jam dipasok pemanggil, perilaku TTL dapat diuji tanpa `sleep`.

Skenario pemakaian:

- **Layanan web dan API**: cache hasil query dan respons dengan invalidasi per tag (`users`, `posts`).
- **Rate limiting dan counter**: `increment` dengan TTL untuk jendela waktu.
- **Alat CLI dan job batch**: memoisasi hasil mahal dengan `remember`.
- **Serverless dan edge**: cache per instans dengan batas `maxEntries` agar memori terkendali.
- **Perangkat tertanam**: inti Rust `no_std + alloc` dengan jam dari timer perangkat keras.

Contoh dependen lain di ekosistem Lombok dicantumkan di `docs/map_LombokCache_v0.1.0.md`.

## Fitur

Setiap fitur di bawah ini dicakup vector di `vectors/` dan test TypeScript.

- `set`, `add`, `get` (dengan fallback), `peek`, `has`, `delete`, `pull`, `remember`.
- TTL per entri atau `defaultTtl`; entri hidup selama `now < expiresAt`; `ttl` gaya Redis (`-1` tanpa kedaluwarsa, `-2` tidak ada); `touch`.
- LRU dengan `maxEntries`: entri kedaluwarsa dibersihkan lebih dulu sebelum eviksi.
- Tag: `invalidateTag` menghapus semua entri bertag.
- `increment`/`decrement` bilangan bulat aman; kunci baru mulai dari 0.
- `stats`: `hits`, `misses`, `sets`, `deletes`, `evictions`, `expirations`.
- `makeKey` untuk kunci bernamespace yang di-escape secara injektif.
- Nilai disalin saat masuk dan keluar (tanpa aliasing); hanya data JSON.

## Instalasi

Belum terbit di registry. Setelah rilis pertama:

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

## Status port

| Port | Status | Bukti |
|---|---|---|
| Rust (`no_std + alloc`) | YA, lulus vector | `rust/tests/vectors.rs` menjalankan seluruh vector; build `thumbv7em-none-eabi` |
| TypeScript | YA, lulus vector | `typescript/test/vectors.test.ts` menjalankan seluruh vector; ditambah test aliasing dan fuzz invarian |
| Python, Go, PHP, Java, Kotlin, C#, C/C++, Swift, Perl | BELUM | Tidak ada kode; direncanakan setelah kontrak stabil (lihat `docs/development_ide_LombokCache_v0.1.0.md`) |

Vector: 142 kasus berisi 1694 langkah operasi (62 golden berekspektasi tulis tangan, 80 skrip regresi hasil pembangkit).

## Standar yang diimplementasikan

Tidak ada standar formal untuk cache in-memory. Semantik `ttl` mengikuti konvensi perintah `TTL` Redis (`-1`, `-2`); kontrak lengkap ada di `docs/SPEC_LombokCache_v0.1.0.md`.

## Batasan yang diketahui

- Hanya dalam proses; tidak ada adapter Redis, berkas, atau database pada 0.1.0.
- Tidak thread-safe di Rust (`&mut self`); bungkus dengan `Mutex` bila dibagi antar thread.
- `invalidateTag`, `prune`, dan pembersihan sebelum eviksi berbiaya O(n).
- Tidak ada perlindungan stampede (`remember` tidak menahan pemanggil lain).
- Hanya Rust dan TypeScript yang memiliki kode. Fuzz bersifat pseudo-fuzz, belum `cargo-fuzz`.

## Ekosistem Lombok

LombokCache tidak bergantung pada library Lombok lain (L0). Library lain dapat memakainya secara opsional; daftar dependen ada di `docs/map_LombokCache_v0.1.0.md`.

## Contributing

Lihat [CONTRIBUTING.md](CONTRIBUTING.md). Untuk melaporkan kerentanan lihat [SECURITY.md](SECURITY.md).

## Lisensi

`Apache-2.0 OR MIT`. Lihat [LICENSE-APACHE](LICENSE-APACHE) dan [LICENSE-MIT](LICENSE-MIT).
