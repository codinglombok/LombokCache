# Lang LombokCache v0.1.0

## 1. Tingkat i18n

Tingkat **E** (pesan error dan dokumentasi saja). Library tidak menghasilkan teks untuk pengguna akhir selain pesan galat.

## 2. Katalog ID pesan (normatif)

Format `lombokcache.<jenis>.<kode>`. Berkas katalog: `locales/<bcp47>/lombokcache.json`, satu berkas untuk semua port.

| ID | Teks sumber (en) | Kode galat |
|---|---|---|
| `lombokcache.error.invalid_key` | The cache key or tag must be 1 to 250 UTF-8 bytes without control characters. | `invalid_key` |
| `lombokcache.error.invalid_ttl` | The time to live must be a whole number of milliseconds of at least 1, or null. | `invalid_ttl` |
| `lombokcache.error.invalid_option` | A cache option or script step is invalid. | `invalid_option` |
| `lombokcache.error.invalid_value` | The value is not storable JSON data or is not an integer where one is required. | `invalid_value` |

Galat membawa `code` (kontrak, sama di semua port) dan `messageId`. Pesan `message` di objek galat berbahasa Inggris dan tidak bersifat normatif.

## 3. Cakupan saat ini

Core-20: 2 dari 20 (`en`, `id`). Paket Nusantara: 0 dari 6. Bahasa lain belum ada. Katalog bahasa tambahan harus ditinjau penutur asli sebelum diterima.

## 4. Cara menambah bahasa

1. Salin `locales/en/lombokcache.json` ke `locales/<bcp47>/lombokcache.json`.
2. Terjemahkan nilai; kunci tidak diubah.
3. Minta tinjauan penutur asli, lalu ajukan PR.

## 5. Ketergantungan LombokLocale

Tidak ada pada 0.1.0. Konsumen yang memakai LombokLocale dapat me-resolve `messageId` terhadap katalog di atas.
