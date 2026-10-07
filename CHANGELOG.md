# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/); entri terbaru di depan. Versi mengikuti [SemVer](https://semver.org/).

## [0.1.0] - 2026-10-07

### Added
- `Cache` dengan `set`, `add`, `get`, `peek`, `has`, `delete`, `pull`, `remember`, `increment`, `decrement`, `touch`, `ttl`, `invalidateTag`, `prune`, `size`, `keys`, `clear`, `stats`.
- TTL dengan jam yang dapat disuntikkan, eviksi LRU dengan `maxEntries`, tag, dan statistik.
- `run` sebagai titik masuk kontrak berbasis skrip; `makeKey` dan `validateKey`.
- Port Rust (`no_std + alloc`, tanpa dependensi) dan port TypeScript (tanpa dependensi runtime).
- Vector bersama 142 kasus (62 golden berekspektasi tulis tangan, 80 skrip regresi hasil pembangkit; 1694 langkah operasi), dijalankan oleh runner Rust dan TypeScript.
- Pseudo-fuzz dan skrip uji mutasi (22 mutan).

### Security
- Entri kedaluwarsa tidak pernah dikembalikan; jumlah entri tidak pernah melebihi `maxEntries`.
- Nilai disalin saat masuk dan keluar; `makeKey` injektif.
