# Structure Repo LombokCache v0.1.0

## 1. Struktur folder

```
LombokCache/
  README.md  CHANGELOG.md  SECURITY.md  CONTRIBUTING.md  version.txt
  LICENSE-APACHE  LICENSE-MIT  .gitignore  .gitattributes
  docs/            10 dokumen standar + TECH_DEBT.md (masterplan_ dan architecture_ tidak di-commit)
  vectors/         lombokcache-vectors-v1.json  README.md
  locales/         en/lombokcache.json  id/lombokcache.json
  rust/            Cargo.toml  src/{lib.rs,json.rs}  tests/vectors.rs  LICENSE-*
  typescript/      package.json  tsconfig*.json  src/  test/
  scripts/         gen-vectors.mjs  mutation-test.mjs  run-ts-tests.mjs
  .github/workflows/  ci.yml
```

## 2. Konvensi penamaan

Dokumen: `<jenis>_LombokCache_v<semver>.md`. Paket: npm `lombokcache`, crates.io `lombokcache`. Go (rencana): `github.com/codinglombok/lombokcache/go`.

## 3. Berkas wajib di root

README, LICENSE-APACHE, LICENSE-MIT, CHANGELOG, SECURITY, CONTRIBUTING, `.gitignore` dengan tiga baris ADR-024, `version.txt`.

## 4. Struktur per port

| Port | Isi |
|---|---|
| `rust/` | Satu crate `lombokcache`; fitur `std` (bawaan); `json.rs` adalah parser dan serializer JSON internal yang keluarannya setara `JSON.stringify`; `tests/` dikecualikan dari paket crates.io karena membaca `../vectors` |
| `typescript/` | `src/cache.ts` (`Cache`, `run`, `makeKey`), `src/index.ts`; `test/` dikompilasi ke `dist-test/` |

## 5. Catatan

`LICENSE-*` di `rust/` adalah salinan dari root agar ikut paket crate. `typescript/` menyalin README dan LICENSE saat `npm pack` (skrip `prepack`/`postpack`). Fungsi `call(fn, args)` di port Rust adalah titik masuk dinamis yang dipakai runner vector dan host FFI.
