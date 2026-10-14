# Structure Repo LombokCache v0.1.0

## 1. Folder structure

```
LombokCache/
  README.md  CHANGELOG.md  SECURITY.md  CONTRIBUTING.md  version.txt
  LICENSE-APACHE  LICENSE-MIT  .gitignore  .gitattributes
  docs/            10 standard documents + TECH_DEBT.md (masterplan_ and architecture_ are not committed)
  vectors/         lombokcache-vectors-v1.json  README.md
  locales/         en/lombokcache.json  id/lombokcache.json
  rust/            Cargo.toml  src/{lib.rs,json.rs}  tests/vectors.rs  LICENSE-*
  typescript/      package.json  tsconfig*.json  src/  test/
  scripts/         gen-vectors.mjs  mutation-test.mjs  run-ts-tests.mjs
  .github/workflows/  ci.yml
```

## 2. Naming conventions

Documents: `<kind>_LombokCache_v<semver>.md`. Packages: npm `lombokcache`, crates.io `lombokcache`. Go (planned): `github.com/codinglombok/lombokcache/go`.

## 3. Required root files

README, LICENSE-APACHE, LICENSE-MIT, CHANGELOG, SECURITY, CONTRIBUTING, `.gitignore` with the three ADR-024 lines, `version.txt`.

## 4. Structure per port

| Port | Contents |
|---|---|
| `rust/` | One crate `lombokcache`; feature `std` (default); `json.rs` is the internal JSON parser and serializer whose output equals `JSON.stringify`; `tests/` is excluded from the crates.io package because it reads `../vectors` |
| `typescript/` | `src/cache.ts` (`Cache`, `run`, `makeKey`), `src/index.ts`; `test/` is compiled to `dist-test/` |

## 5. Notes

`LICENSE-*` in `rust/` are copies of the root files so that they ship in the crate. `typescript/` copies the README and the licenses during `npm pack` (scripts `prepack`/`postpack`). The function `call(fn, args)` in the Rust port is the dynamic entry point used by the vector runner and by FFI hosts. Stray backup files (`*.bak`) must never be committed.
