# Full Summary LombokCache v0.1.0

## Apa ini

Cache in-memory deterministik dengan TTL berjam suntik, eviksi LRU, tag, counter, dan statistik, yang perilakunya dispesifikasikan sampai kasus tepi.

## Mengapa dibuat

Cache sederhana mudah ditulis tetapi sulit diuji karena bergantung pada jam sistem, dan semantik tepinya (batas kedaluwarsa, apakah pembacaan memperbarui urutan LRU, kapan eviksi terjadi) berbeda antar implementasi. Kontrak bersama membuat perilaku yang sama di semua bahasa dapat diuji tanpa menunggu waktu berlalu.

## Fitur utama

Lihat README (bagian Fitur). Semua fitur dicakup vector.

## Status saat ini

Kode lengkap untuk Rust dan TypeScript; lulus 142 kasus vector; belum terbit di registry; belum memenuhi aturan skor rilis (lihat `TECH_DEBT.md`).

## Contoh pemakai

Lihat README (skenario pemakaian).

## Batasan yang Diketahui

- Hanya dalam proses; tidak ada adapter eksternal.
- Port Rust tidak thread-safe tanpa pembungkus `Mutex`.
- `invalidateTag`, `prune`, dan pembersihan sebelum eviksi berbiaya O(n).
- Tidak ada perlindungan stampede dan batas ukuran dalam byte.
- Hanya dua port (Rust, TypeScript); fuzz berupa pseudo-fuzz, belum `cargo-fuzz`; belum audit pihak ketiga; coverage belum diukur.

## Info lanjut

SPEC_, API_, `development_ide_`.

## Gap vs pembanding (U6)

Perbandingan bersifat kualitatif dan berdasarkan pengetahuan umum tentang kategori library; belum diverifikasi fitur demi fitur pada 2026-10-07.

| Pembanding (kategori) | Yang dimiliki pembanding dan belum dimiliki LombokCache | Yang ditawarkan LombokCache |
|---|---|---|
| Cache dalam proses (lru-cache, node-cache, moka, cachetools, Caffeine) | Konkurensi, batas berbasis ukuran, statistik lanjutan, refresh asinkron, kinerja teruji | Kontrak semantik lintas bahasa dengan skrip bersama; jam suntik; tag; inti `no_std + alloc` |
| Cache terdistribusi (Redis, Memcached) | Berbagi antar proses, persistensi, replikasi | Tanpa server; dapat diuji deterministik |
