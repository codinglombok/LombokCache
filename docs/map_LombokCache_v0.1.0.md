# Map LombokCache v0.1.0

## 1. Dependency position

L0. The cluster position and catalog number follow the ecosystem parent document v3.6 (not committed, ADR-024). No required Lombok dependencies.

## 2. Example dependents in the ecosystem

This section is the only place where application or framework names may appear (ADR-019). It is an illustration, not ownership; anyone can use LombokCache.

| Dependent | Kind | Integration status | Notes |
|---|---|---|---|
| LombokClarion v3 | Framework | planned (F7) | Replaces the internal v2 array cache driver; the file and database drivers stay in the framework until adapters exist |
| LombokSecurity | Library | planned (optional) | In-process storage of rate-limiter state |
| LombokAuth | Library | planned (optional) | Cache of revoked tokens and RBAC results |
| LombokServer | L4 library | planned | Response cache |

Adapters to external storage (LombokSQL for databases, files through LombokStorage) are not implemented.

## 3. Depends on

Nothing.

## 4. Normative contract path

`docs/SPEC_LombokCache_v0.1.0.md` -> `vectors/lombokcache-vectors-v1.json` (sha256 in SPEC) -> runners `rust/tests/vectors.rs` and `typescript/test/vectors.test.ts`.

## 5. Folder map

See `structure_repo_LombokCache_v0.1.0.md`.
