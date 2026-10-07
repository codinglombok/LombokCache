# Vectors

`lombokcache-vectors-v1.json` adalah kontrak uji lintas bahasa untuk LombokCache.

- SHA-256: `24e5dfcebc1aaab7021ceea1a0d73675cf1d7e1a0dd7b84fe591ab3b735e3601` (harus sama dengan `docs/SPEC_LombokCache_v0.1.0.md`).
- Dibangkitkan oleh `scripts/gen-vectors.mjs`. Grup `golden`: skrip operasi dengan keluaran per langkah yang ditulis tangan dan dicocokkan dengan port TypeScript saat pembangkitan. Grup `generated-regression`: skrip acak berbenih, keluaran dari port TypeScript dan dikonfirmasi port Rust.
- Setiap kasus memanggil fungsi `fn` dengan `args`; `expect` berbentuk `{ "result": ... }` atau `{ "error": code }`.
- Setiap port yang diklaim MUST menjalankan seluruh kasus.
- Jumlah: 142 kasus (62 golden berekspektasi tulis tangan, 80 skrip regresi hasil pembangkit; 1694 langkah operasi).
