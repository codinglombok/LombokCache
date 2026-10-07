# Changelog LombokCache (ringkasan)

Entri terbaru di depan. Rincian ada di `CHANGELOG.md`.

## 0.1.0 - 2026-10-07

### Added
- `Cache` dengan TTL, LRU, tag, counter, statistik; `run`, `makeKey`.
- Port Rust `no_std + alloc` dan port TypeScript.
- Vector 142 kasus; runner di kedua port; fuzz, uji mutasi.

### Security
- Entri kedaluwarsa tidak pernah dikembalikan; jumlah entri tidak pernah melebihi `maxEntries`.
- Nilai disalin saat masuk dan keluar; `makeKey` injektif.
