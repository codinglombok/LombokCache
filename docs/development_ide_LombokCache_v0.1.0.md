# Development IDE LombokCache v0.1.0

## 1. Roadmap

| Versi | Isi |
|---|---|
| 0.1.1 | Tutup syarat rilis: CI dijalankan, `doctor docs/privacy/style`, coverage diukur, target `cargo-fuzz` |
| 0.2.0 | Antarmuka adapter (berkas, database lewat LombokSQL, Redis); batas ukuran dalam byte; port Python, Go, PHP |
| 0.3.0 | Perlindungan stampede dan refresh di latar; indeks tag O(1); varian thread-safe di Rust |

## 2. Deferred scope

Lihat SPEC bagian Non-goals dan README (Batasan).

## 3. Prinsip desain kontributor

- Kontrak dulu, test dulu; semua port lulus vector yang sama.
- Tidak ada dependensi runtime; dev-dependency dicatat.
- Fungsi inti murni: jam, keacakan, dan I/O dipasok pemanggil.
- Semua waktu berasal dari jam pemanggil.
- Setiap kasus tepi semantik (batas TTL, recency, eviksi) dicakup vector golden.

## 4. Cara berkontribusi

Lihat `CONTRIBUTING.md`.

## 5. Pertanyaan terbuka

- Apakah `increment` pada kunci yang ada sebaiknya dapat memperpanjang TTL lewat opsi?
- Apakah `has` sebaiknya memperbarui recency (perilaku sebagian pustaka)?
