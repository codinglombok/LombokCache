# Guide How To Use LombokCache v0.1.0

## Instalasi

Belum terbit. Setelah rilis: `npm install lombokcache` atau `cargo add lombokcache`. Sebelum itu, bangun dari repo (lihat `CONTRIBUTING.md`).

## Konsep dasar

1. Entri berisi nilai JSON, waktu kedaluwarsa, dan tag.
2. Jam dipasok lewat opsi `clock` (bawaan `Date.now`). Dalam test, pakai variabel yang Anda ubah sendiri.
3. Entri hidup selama `now < expiresAt`; tepat pada `expiresAt` entri sudah kedaluwarsa.
4. Dengan `maxEntries`, entri kedaluwarsa dibersihkan lebih dulu, lalu yang paling lama tidak dipakai dikeluarkan.

## Contoh

```ts
import { Cache } from "lombokcache";

const cache = new Cache({ maxEntries: 10_000, defaultTtl: 300_000 });
const user = cache.remember(`user:${id}`, () => loadUserFromDb(id));
```

## Recipes

### Counter jendela tetap (rate limit sederhana)

```ts
import { Cache, makeKey } from "lombokcache";
const hit = (ip: string) => cache.increment(makeKey("rl", ip, String(Math.floor(Date.now() / 60_000))), 1, { ttl: 60_000 });
if (hit(clientIp) > 100) reject();
```

### Invalidasi berkelompok

```ts
cache.set("post:1", post1, { tags: ["posts"] });
cache.set("post:2", post2, { tags: ["posts"] });
cache.invalidateTag("posts");   // 2
```

### Test TTL tanpa menunggu

```ts
let now = 0;
const c = new Cache({ clock: () => now });
c.set("k", 1, { ttl: 1000 });
now = 1000;
c.get("k");   // null
```

## Common pitfalls

- `get` mengembalikan `null` untuk miss; bila `null` adalah nilai sah, pakai `has` atau `get(key, sentinel)`.
- `has`, `peek`, dan `ttl` tidak memperbarui urutan LRU.
- `increment` pada kunci yang ada **tidak** memperpanjang TTL; pakai `touch` bila perlu.
- Menulis ulang kunci mengganti tag-nya; tag lama tidak dipertahankan.
- Hanya data JSON yang dapat disimpan; fungsi, `NaN`, dan `undefined` ditolak.
- Cache ini dalam proses; setiap instans serverless atau worker memiliki cache sendiri.

## Lihat juga

README, SPEC_, API_.
