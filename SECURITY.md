# Kebijakan Keamanan

## Versi yang didukung

| Versi | Dukungan |
|---|---|
| 0.1.x | Perbaikan keamanan |

## Melaporkan kerentanan

Gunakan **GitHub Private Vulnerability Reporting** pada repo ini (tab Security, "Report a vulnerability"). Jangan membuka issue publik untuk kerentanan.

- Respons awal: paling lama 48 jam.
- Perbaikan untuk temuan kritis: target 7 hari.
- Pengungkapan dikoordinasikan dengan pelapor.

## Cakupan

Dalam cakupan: `Cache` dan validasi kunci, khususnya cara apa pun agar entri kedaluwarsa terbaca, batas `maxEntries` terlampaui, nilai bocor antar kunci, atau masukan menyebabkan panic, crash, atau waktu eksekusi tak terbatas.

Di luar cakupan: adapter penyimpanan eksternal (Redis, berkas, database) yang ditulis aplikasi.

## Model ancaman ringkas

Lihat bagian Keamanan pada `docs/SPEC_LombokCache_v0.1.0.md`.
