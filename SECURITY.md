# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Instead, report privately via GitHub's
[security advisories](https://github.com/Ylsssq926/dsh-autoshift/security/advisories/new)
or email **469906100@qq.com**.

Include:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Your DSH version and plugin version.

We aim to acknowledge reports within a few days and will keep you updated on
the fix and disclosure timeline.

## Scope notes

Model Autoshift reads only your mounted model catalogs and current session
events, and forwards only to providers you configured. It does not read or
write workspace files, upload telemetry, or store API keys. Configuration stays
local. Reports that demonstrate a deviation from these guarantees are
especially welcome.