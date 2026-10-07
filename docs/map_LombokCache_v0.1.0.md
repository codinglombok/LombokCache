# Map LombokCache v0.1.0

## 1. Posisi dependensi

L0. Posisi cluster dan nomor katalog mengikuti dokumen induk ekosistem v3.6 (tidak di-commit, ADR-024). Tidak memiliki dependensi Lombok wajib.

## 2. Contoh dependen di ekosistem

Bagian ini satu-satunya tempat nama aplikasi atau framework boleh muncul (ADR-019). Ini ilustrasi, bukan kepemilikan; siapa pun dapat memakai LombokCache.

| Pemakai | Jenis | Status integrasi | Keterangan |
|---|---|---|---|
| LombokClarion v3 | Framework | rencana (F7) | Menggantikan driver cache array internal v2; driver berkas dan database tetap di framework sampai adapter tersedia |
| LombokSecurity | Library | rencana (opsional) | Penyimpanan status rate limiter dalam proses |
| LombokAuth | Library | rencana (opsional) | Cache token yang dicabut dan hasil RBAC |
| LombokServer | Library L4 | rencana | Cache respons |

Adapter ke penyimpanan eksternal (LombokSQL untuk database, berkas lewat LombokStorage) belum diimplementasikan.

## 3. Bergantung pada

Tidak ada.

## 4. Jalur kontrak normatif

`docs/SPEC_LombokCache_v0.1.0.md` -> `vectors/lombokcache-vectors-v1.json` (sha256 di SPEC) -> runner `rust/tests/vectors.rs` dan `typescript/test/vectors.test.ts`.

## 5. Peta folder

Lihat `structure_repo_LombokCache_v0.1.0.md`.
