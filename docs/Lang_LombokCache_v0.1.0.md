# Lang LombokCache v0.1.0

## 1. i18n level

Level **E** (error messages and documentation only). The library produces no end-user text other than error messages. The source language of all messages and documentation is English.

## 2. Message ID catalog (normative)

Format `lombokcache.<kind>.<code>`. Catalog files: `locales/<bcp47>/lombokcache.json`, one file for all ports.

| ID | Source text (en) | Error code |
|---|---|---|
| `lombokcache.error.invalid_key` | The cache key or tag must be 1 to 250 UTF-8 bytes without control characters. | `invalid_key` |
| `lombokcache.error.invalid_ttl` | The time to live must be a whole number of milliseconds of at least 1, or null. | `invalid_ttl` |
| `lombokcache.error.invalid_option` | A cache option or script step is invalid. | `invalid_option` |
| `lombokcache.error.invalid_value` | The value is not storable JSON data or is not an integer where one is required. | `invalid_value` |

An error carries `code` (contract, the same in all ports) and `messageId`. The `message` field of the error object is in English and is not normative.

## 3. Current coverage

Core-20: 2 of 20 (`en`, `id`). Nusantara pack: 0 of 6. No other languages yet. Catalogs for additional languages must be reviewed by a native speaker before they are accepted.

## 4. How to add a language

1. Copy `locales/en/lombokcache.json` to `locales/<bcp47>/lombokcache.json`.
2. Translate the values; keys are not changed.
3. Ask a native speaker to review, then open a pull request.

## 5. Dependency on LombokLocale

None in 0.1.0. A consumer that uses LombokLocale can resolve `messageId` against the catalogs above.
