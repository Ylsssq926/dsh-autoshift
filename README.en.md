# Model Autoshift (模型自动挡)

> Still picking models in manual? Shift to Auto.

Collected a pile of relay models and still hand-picking one for every task? Model Autoshift adds an **Auto** gear to DSH's model selector: drop in a task and it picks the best model from the ones you already configured — cheap models handle chores, flagships chew the hard bones. One route pinned for the whole session, no drift after a restart, zero extra model calls.

You bring the task. Auto picks the model.

[中文](README.md)

![Model Autoshift at a glance](docs/flow.en.png)

## Why Auto

- **Zero config**: install, pick Auto, go. No pool to fill, no YAML. Every model you configured in DSH — official or relay — is recognized, unfamiliar IDs included.
- **Shifts by task**: engineering, creative, writing, research, architecture and everyday chat — six task types matched automatically, cheap models for chores, flagships for the hard stuff.
- **One session, one route**: the first model picked stays pinned for the whole session. Context compaction and desktop restarts recover the route instead of re-picking, keeping context and provider caching steady.
- **Zero extra calls**: each request forwards to one model — no "router model" burning a second call, no voting, no warming, no default retries. Usage passes through untouched; the bill looks the same.
- **Every turn at a glance**: a receipt line at the end of each reply — `Auto · model · tier · role` — shows who ran, which tier, and whether a backup was taken.

## Who it's for

- **Relay power users**: dozens or hundreds of models, no manual switching per task;
- **Multi-provider users**: DeepSeek, OpenAI, Gemini, Claude mixed, dispatched by task;
- **Beginners**: skip the model research, pick Auto, start.

## Install

```bash
dsh plugin --profile web add -w link:/path/to/model-aware-auto-plugin
```

Restart DSH and enable the plugin. New sessions show **Model Autoshift → Auto** in the model selector. Use `--profile desktop` for the desktop app.

## Quick start

1. Configure at least one text model in DSH settings (official or relay);
2. New session, pick **Auto**;
3. Assign the task.

That's it.

<img src="docs/entry.en.png" alt="Where to start: the Auto gear in the model selector" width="440">

## Three modes

| Mode | Behavior |
|---|---|
| `economy` | Chores go to cheap models; cost weighs most |
| `balanced` (default) | Task fit first, cost considered |
| `quality` | Task fit only, cost ignored |

```yaml
mode: economy
```

## Example tasks

| Role | What you drop in |
|---|---|
| Engineering | Fix a stack trace, refactor a function, write a script, deploy an API, run tests |
| Creative | Write a poem, spin a story, roleplay, draft copy |
| Writing | Polish an email, summarize an article, translate, write a weekly report |
| Research | Survey the literature, compare options, run a benchmark |
| Architecture | System design, tech selection, splitting microservices |
| Everyday | Chat, Q&A, assorted chores |

Whatever role the task reads as, Auto picks a model for that role from your pool — chores go economy, hard bones go flagship.

## Relay models recognized with zero config

Relay pools are full of unfamiliar IDs. Auto tiers them by name and dispatches:

- **Economy**: `mini / flash / lite / haiku / free / turbo`, plus small open-weight models like `7b / 8b`;
- **Flagship**: `pro / opus / ultra / max`, plus reasoning models like `r1 / o3 / reasoner / thinking`;
- **Engineering lean**: `coder / code / dev`, deepseek / claude family; **creative lean**: gemini family.

A cheap variant of a flagship family (`pro-flash`) still counts as economy. Forwarding always uses the exact catalog ID. To fine-tune cost or roles, override with `economics` in `preferences` / `routes`.

## Pinned for the session, no drift on restart

The first successful route binds the whole session. After context compaction or a desktop restart the binding is recovered from session events, never re-picked; context is never mixed across models, and the stable prefix is friendly to provider caching. If the pinned model is unmounted, Auto tells you the next step instead of silently switching models mid-conversation.

## Route receipt

A small line at the end of each turn: `Auto · model · tier · role`, plus `fallback×N` when a backup was taken. It reads route metadata already in the session — zero extra requests; non-Auto turns show nothing.

## Subagent division (optional)

When DSH's native subagent tool enables model selection and the session has a child policy, Auto does one local role match plus a short handoff for subtasks **without an explicit model**. Explicitly chosen subagent models always win; starting, cancelling, permissions and recycling stay native to DSH.

## Permissions & data

Auto reads only your mounted model catalogs and current session events, and forwards only to providers you configured. It never touches workspace files or uploads telemetry; all config stays local.

## Configuration (all optional)

### Light preferences

```yaml
preferences:
  - provider: your-provider-id
    model: exact-model-id
    roles: [engineering]
```

Preferences only tune ordering; other mounted models still participate.

### Scope control

```yaml
scope:
  providers: [provider-a, provider-b]   # allowlist, empty = all
  excludeProviders: [provider-c]
  excludeModels: [some-model]
```

### Advanced profiles

A full `routes` list overrides auto-discovery for fixed team flows or long-term tuning: `roles`, `tools`, `behavior`, `dimensions`, `economics`, `contextWindow`, `maxOutputTokens`, `routeRevision`. Use real DSH provider/model IDs; no API keys in config.

## Good to know

- Text tasks only; image modalities are outside Auto's catalog;
- Old sessions started with another model can't switch to Auto mid-way — start a new session;
- Auxiliary requests (titles, summaries) follow the session's pinned route.

## Compatibility

DSH `0.2.2-rc.1` · Node.js 22+.

## Development

```bash
node --test
```