# SPEC LombokCache v0.1.0

This document is the normative cross-language contract. Every language port MUST produce byte-identical output for all specified inputs. Deviations from this specification are bugs.

Key words MUST, MUST NOT, SHOULD and MAY are interpreted as in RFC 2119 and RFC 8174.

| Atribut | Nilai |
|---|---|
| Versi kontrak | 0.1.0 |
| Tanggal tinjauan standar acuan | 2026-10-07 |
| Vector | `vectors/lombokcache-vectors-v1.json` |
| SHA-256 vector | `24e5dfcebc1aaab7021ceea1a0d73675cf1d7e1a0dd7b84fe591ab3b735e3601` |

## 0. Standar acuan (U2)

| Acuan | Versi | Pemakaian |
|---|---|---|
| RFC 8259 | Desember 2017 | Nilai yang disimpan adalah data JSON |
| RFC 3629 | November 2003 | Panjang kunci dalam byte UTF-8 |
| Perintah `TTL` Redis | 7.x | Konvensi nilai `-1` dan `-2` pada `ttl` |
| RFC 2119, RFC 8174 | 1997, 2017 | Kata kunci normatif |

## 1. Vector

Berkas vector memuat `{ format, specVersion, note, groups }`. Setiap kasus memuat `name`, `fn`, `args`, dan `expect` (`{ "result": ... }` atau `{ "error": code }`). Fungsi `run(options, steps)` menjalankan skrip pada cache baru dan menghasilkan satu keluaran per langkah. Setiap port yang diklaim MUST menjalankan seluruh kasus dan menghasilkan keluaran yang sama secara struktural. Hash SHA-256 berkas MUST sama dengan tabel atribut.

## 2. Model

Cache menyimpan entri `{ value, expiresAt, tags }` dan urutan pemakaian (recency). Waktu adalah bilangan bulat milidetik 0..2^53-1 yang dibaca dari jam milik pemanggil pada setiap operasi; jam yang mengembalikan nilai lain MUST menghasilkan `invalid_option`. Waktu boleh mundur.

Sebuah entri **hidup** pada waktu `now` bila `expiresAt` null atau `now < expiresAt`. `expiresAt = min(now + ttl, 2^53 - 1)`. Entri yang tidak hidup dihapus secara malas saat operasi menyentuh kuncinya dan dihitung sebagai `expirations`.

**Kunci dan tag**: string 1..250 byte UTF-8 tanpa U+0000..U+001F dan U+007F; selain itu `invalid_key`.

**Nilai**: data JSON (null, boolean, angka berhingga, string, array, objek) dengan kedalaman paling besar 512; selain itu `invalid_value`. Nilai MUST disalin saat disimpan dan saat dikembalikan.

**TTL**: bilangan bulat 1..2^53-1 milidetik, atau `null` (tanpa kedaluwarsa); selain itu `invalid_ttl`. Bila tidak diberikan, berlaku `defaultTtl`.

**Opsi tulis**: objek dengan kunci `ttl` dan `tags` (array kunci); kunci lain, bukan objek, atau `tags` bukan array MUST `invalid_option`.

## 3. Opsi cache

`maxEntries`: bilangan bulat 1..2^53-1 atau tidak ada (tanpa batas). `defaultTtl`: TTL atau `null`. Kunci lain MUST `invalid_option`. Pada `run`, `clock` MUST ditolak (`invalid_option`) karena jam diatur oleh langkah.

## 4. Operasi

Setiap operasi memvalidasi argumennya menurut urutan kolom "Validasi" sebelum mengubah apa pun; satu-satunya perubahan yang dapat terjadi sebelum galat adalah penghapusan malas entri kedaluwarsa (bagian 2).

| Operasi | Validasi | Hasil dan efek |
|---|---|---|
| `set(key, value, options?)` | key, opsi, value | `true`. Menyimpan (bagian 5) |
| `add(key, value, options?)` | key, opsi, value | `false` bila ada entri hidup; selain itu menyimpan dan `true` |
| `get(key, fallback?)` | key | Nilai entri hidup (hit, recency diperbarui) atau `fallback` (bawaan null; miss) |
| `peek(key)` | key | Nilai entri hidup atau null; tanpa recency, tanpa statistik, tanpa penghapusan |
| `has(key)` | key | Boolean; tanpa recency dan statistik |
| `delete(key)` | key | `true` dan `deletes`+1 bila entri hidup dihapus; selain itu `false` |
| `pull(key, fallback?)` | key | Seperti `get`, lalu entri dihapus (`deletes`+1) bila ada |
| `remember(key, factory, options?)` | key, opsi | Hit: nilai (recency diperbarui). Miss: hasil factory divalidasi sebagai value, lalu `misses`+1 dan disimpan |
| `increment(key, by=1, options?)` | key, `by` bilangan bulat aman (`invalid_value`), opsi | Tidak ada entri hidup: disimpan `by` dengan TTL dan tag dari opsi. Ada: nilai MUST bilangan bulat aman (`invalid_value`), hasil MUST aman (`invalid_value`); expiry dan tag tetap; recency diperbarui; `sets`+1 |
| `decrement(key, by=1, options?)` | key, `by` | `increment(key, -by, options)` |
| `touch(key, ttl?)` | key, ttl | `false` bila tidak ada entri hidup; selain itu expiry diatur ulang, recency diperbarui, `true` |
| `ttl(key)` | key | `-2` tidak ada entri hidup; `-1` tanpa kedaluwarsa; selain itu `expiresAt - now` |
| `invalidateTag(tag)` | tag (`invalid_key`) | Menghapus semua entri bertag; mengembalikan jumlah yang hidup (`deletes`), yang tidak hidup dihitung `expirations` |
| `prune()` | - | Menghapus semua entri tidak hidup; mengembalikan jumlahnya |
| `size()` | - | `prune`, lalu jumlah entri |
| `keys()` | - | `prune`, lalu kunci dari paling lama sampai paling baru dipakai |
| `clear()` | - | `size`, lalu semua dihapus; `deletes` bertambah sebanyak hasil `size` |
| `stats()` | - | `{ hits, misses, sets, deletes, evictions, expirations }` dengan urutan kunci ini |

Recency diperbarui oleh: penyimpanan, hit `get`/`pull`/`remember`, `increment` pada entri yang ada, dan `touch`.

## 5. Penyimpanan dan eviksi

Menyimpan kunci `k`: bila `maxEntries` ada, `k` belum tersimpan (hidup atau tidak), dan jumlah entri tersimpan sudah mencapai `maxEntries`, maka (1) semua entri tidak hidup dihapus (`expirations`), lalu (2) selama jumlah entri masih mencapai `maxEntries`, entri yang paling lama dipakai dihapus (`evictions`). Kemudian entri `k` ditulis (menggantikan entri lama berikut tag-nya) sebagai yang paling baru dipakai dan `sets`+1.

## 6. Skrip (`run`)

`run(options, steps)`: `options` MUST objek (bagian 3); `steps` MUST array. Jam dimulai 0. Setiap langkah MUST objek dengan `op` salah satu nama operasi bagian 4; bila ada `at`, MUST bilangan bulat 0..2^53-1 dan jam diatur ke nilai itu sebelum operasi. Pelanggaran ini menggagalkan seluruh skrip dengan `invalid_option`.

Argumen diambil dari kunci langkah: `key`, `value`, `options`, `fallback`, `by`, `ttl` (untuk `touch`), `tag`. Kunci yang tidak ada berarti argumen tidak diberikan; untuk `remember`, factory mengembalikan `value` (tidak ada: `invalid_value`). Langkah yang gagal menghasilkan `{ "$error": code }` dan skrip berlanjut.

## 7. makeKey

`makeKey(namespace, ...parts)`: setiap bagian MUST string tidak kosong (`invalid_key`). Setiap bagian di-escape (`\` menjadi `\\`, lalu `:` menjadi `\:`) dan digabung dengan `:`; hasil MUST kunci sah. `validateKey(key)` mengembalikan kunci atau `invalid_key`.

## 8. Keamanan

- Entri tidak hidup MUST tidak pernah dikembalikan.
- Jumlah entri MUST tidak pernah melebihi `maxEntries` setelah operasi apa pun.
- Nilai yang dikembalikan MUST salinan; pengubahan oleh pemanggil tidak memengaruhi cache.
- `makeKey` MUST injektif: daftar bagian yang berbeda menghasilkan kunci yang berbeda.
- Masukan apa pun MUST menghasilkan hasil atau galat dengan `code` pada bagian 9; panic atau pengecualian lain adalah bug.

## 9. Galat

| `code` | Kondisi | `messageId` |
|---|---|---|
| `invalid_key` | kunci atau tag tidak sah | `lombokcache.error.invalid_key` |
| `invalid_ttl` | TTL tidak sah | `lombokcache.error.invalid_ttl` |
| `invalid_option` | opsi cache, opsi tulis, jam, atau langkah skrip tidak sah | `lombokcache.error.invalid_option` |
| `invalid_value` | nilai bukan data JSON, atau bukan bilangan bulat aman pada counter | `lombokcache.error.invalid_value` |

## 10. Non-goals (0.1.0)

Adapter penyimpanan eksternal, akses bersamaan antar thread atau proses, perlindungan stampede, batas ukuran dalam byte, dan serialisasi isi cache.

## 11. Riwayat perubahan kontrak

| Versi | Perubahan |
|---|---|
| 0.1.0 | Kontrak awal |
