# Security Policy

## Supported versions

| Version | Support |
|---|---|
| 0.1.x | Security fixes |

## Reporting a vulnerability

Use **GitHub Private Vulnerability Reporting** on this repository (Security tab, "Report a vulnerability"). Do not open a public issue for a vulnerability.

- Initial response: within 48 hours.
- Fix for critical findings: 7 days (target).
- Disclosure is coordinated with the reporter.

## Scope

In scope: `Cache` and key validation, in particular any way for an expired entry to be read, for the `maxEntries` limit to be exceeded, for a value to leak between keys, or for an input to cause a panic, a crash or unbounded execution time.

Out of scope: external storage adapters (Redis, files, databases) written by the application.

## Short threat model

See section 8 of `docs/SPEC_LombokCache_v0.1.0.md`.
