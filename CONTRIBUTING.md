# Contributing to Model Autoshift

Thanks for helping make Model Autoshift better. This guide keeps changes
consistent with the plugin's core promises.

## Setup

- Node.js 22 or newer.
- No build step and no runtime dependencies — the plugin is plain ES modules.

```bash
node --test
```

All tests are offline: no network, no model calls, no DSH host required.

## Ground rules

These invariants are what users rely on. Please preserve them:

- **Zero extra model calls.** Routing is local text heuristics. Never add a
  "router model", voting, warmup, or default retries. One request forwards to
  exactly one model.
- **Fallback only before visible output.** A route may switch to a backup only
  while nothing has been emitted and the session is not yet pinned.
- **Locked identifiers never change:** provider id `model-aware-auto`, model id
  `auto`, display name `Auto`, replay tag `model-aware-auto/v1`, the cordis
  plugin id and client module id `model-aware-auto`, failure codes, and the
  handoff protocol. Old sessions must keep recovering their pinned route.
- **Forward the exact catalog ID.** Name normalization is for classification
  only; the original provider/model ID is always what gets forwarded.

## Adding a language

1. Add `locale/<code>.json` with `meta.title` and `meta.description`.
2. Add a matching entry to the `LABELS` table in **both** `core/receipt.mjs` and
   `client.js` — they must stay identical. `client.test.mjs` guards against drift.
3. Add a translated `README.<code>.md` and link it in the language switcher.
4. Add a label assertion to `receipt.test.mjs`.

## Pull requests

- Keep changes focused; one concern per PR.
- Run `node --test` and make sure it passes.
- Update the relevant docs (README languages, CHANGELOG) when behavior changes.
- Fill in the pull request template.

## Reporting bugs

Use the bug report template. Including the route receipt line
(`Auto · model · tier · role`) and your DSH version makes issues much faster to
diagnose.