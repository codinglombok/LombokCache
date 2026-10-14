# Guide How To Use LombokCache v0.1.0

## Installation

Not published yet. After the release: `npm install lombokcache` or `cargo add lombokcache`. Until then, build from the repository (see `CONTRIBUTING.md`).

## Basic concepts

1. An entry holds a JSON value, an expiry time and tags.
2. The clock is supplied through the `clock` option (default `Date.now`). In tests, use a variable that you change yourself.
3. An entry is alive while `now < expiresAt`; exactly at `expiresAt` the entry has expired.
4. With `maxEntries`, expired entries are purged first, and then the least recently used one is evicted.

## Example

```ts
import { Cache } from "lombokcache";

const cache = new Cache({ maxEntries: 10_000, defaultTtl: 300_000 });
const user = cache.remember(`user:${id}`, () => loadUserFromDb(id));
```

## Recipes

### A fixed-window counter (simple rate limit)

```ts
import { Cache, makeKey } from "lombokcache";
const hit = (ip: string) => cache.increment(makeKey("rl", ip, String(Math.floor(Date.now() / 60_000))), 1, { ttl: 60_000 });
if (hit(clientIp) > 100) reject();
```

### Grouped invalidation

```ts
cache.set("post:1", post1, { tags: ["posts"] });
cache.set("post:2", post2, { tags: ["posts"] });
cache.invalidateTag("posts");   // 2
```

### Testing TTL without waiting

```ts
let now = 0;
const c = new Cache({ clock: () => now });
c.set("k", 1, { ttl: 1000 });
now = 1000;
c.get("k");   // null
```

## Common pitfalls

- `get` returns `null` for a miss; when `null` is a valid value, use `has` or `get(key, sentinel)`.
- `has`, `peek` and `ttl` do not update the LRU order.
- `increment` on an existing key does **not** extend its TTL; use `touch` if you need that.
- Writing a key again replaces its tags; the old tags are not kept.
- Only JSON data can be stored; functions, `NaN` and `undefined` are rejected.
- This cache is in-process; every serverless instance or worker has its own cache.

## See also

README, SPEC_, API_.
