# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-15

### Added

- **Auto gear** in the DSH model selector: task-aware routing across the models
  you already configured, official or relay, with zero setup.
- **Name-pattern tiering** (economy / standard / flagship) that recognizes
  unfamiliar relay IDs, reasoning markers, and small open-weight models.
- **Six-role task classification** (engineering, creative, writing, research,
  architecture, everyday) shared between conversation routing and native
  subagent delegation.
- **Session pinning**: one route per session, recovered after context compaction
  and desktop restarts; no cross-model context mixing.
- **Route receipt**: a per-turn `Auto · model · tier · role` line rendered in the
  conversation, with fallback markers.
- **Three modes**: `economy`, `balanced` (default), `quality`.
- **Optional configuration**: light preferences, scope control, and full route
  profiles.
- **Eight-language UI labels** (zh, en, ja, ko, fr, es, de, ru) and bilingual
  documentation with rendered usage diagrams.
- Offline test suite and CI on Node 22 and 24.

### Guarantees

- Zero extra model calls: one request forwards to exactly one model; no router
  model, voting, warmup, or default retries.
- Fallback only before visible output and before the session is pinned.
- Stable locked identifiers for replay compatibility.

[0.1.0]: https://github.com/Ylsssq926/dsh-autoshift/releases/tag/v0.1.0