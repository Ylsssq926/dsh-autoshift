![Model Autoshift](docs/banner.png)

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ylsssq926/dsh-autoshift/actions/workflows/ci.yml/badge.svg)](https://github.com/Ylsssq926/dsh-autoshift/actions/workflows/ci.yml)
[![Node ≥ 22](https://img.shields.io/badge/node-%3E%3D22-339933.svg?logo=node.js&logoColor=white)](package.json)
[![DSH 0.2.2-rc.1](https://img.shields.io/badge/DSH-0.2.2--rc.1-6d5ce7.svg)](https://github.com/Ylsssq926/dsh-autoshift)
[![i18n: 8 languages](https://img.shields.io/badge/i18n-8%20languages-2db7a3.svg)](README.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-6d5ce7.svg)](CONTRIBUTING.md)

# Model Autoshift (模型自动挡)

> Noch Modelle von Hand wählen? Schalte auf Automatik.

Einen Haufen Relay-Modelle gesammelt und immer noch für jede Aufgabe eins von Hand auswählen? Model Autoshift fügt dem Modellwähler von DSH einen **Auto**-Gang hinzu: Wirf eine Aufgabe hinein, und es wählt das beste Modell aus denen, die du bereits konfiguriert hast — günstige Modelle für Routinearbeit, Flaggschiffe für die harten Brocken. Eine Route für die ganze Sitzung fixiert, kein Drift nach einem Neustart, null zusätzliche Modellaufrufe.

Du bringst die Aufgabe. Auto wählt das Modell.

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · **Deutsch** · [Русский](README.ru.md)

![Betriebsübersicht](docs/flow.en.png)

## Warum Auto

- **Null Konfiguration**: installieren, Auto wählen, loslegen. Kein Pool zum Füllen, kein YAML. Jedes in DSH konfigurierte Modell — offiziell oder Relay — wird erkannt, auch unbekannte IDs.
- **Schaltet nach Aufgabe**: Engineering, Kreatives, Schreiben, Recherche, Architektur und Alltag — sechs Aufgabentypen automatisch zugeordnet, günstige Modelle für Routine, Flaggschiffe für das Schwere.
- **Eine Sitzung, eine Route**: das zuerst gewählte Modell bleibt für die ganze Sitzung fixiert. Kontextkomprimierung und Desktop-Neustarts stellen die Route wieder her, statt neu zu wählen, und halten Kontext und Provider-Cache stabil.
- **Null zusätzliche Aufrufe**: jede Anfrage geht an genau ein Modell — kein „Router-Modell“, das einen zweiten Aufruf verbrennt, kein Voting, kein Aufwärmen, keine Standard-Retries. Usage geht unverändert durch; die Rechnung bleibt gleich.
- **Jede Runde auf einen Blick**: eine Belegzeile am Ende jeder Antwort — `Auto · model · tier · role` — zeigt, wer lief, welche Stufe und ob ein Ersatz genommen wurde.

## Für wen

- **Relay-Poweruser**: Dutzende oder Hunderte Modelle, kein manuelles Wechseln pro Aufgabe;
- **Multi-Provider-Nutzer**: DeepSeek, OpenAI, Gemini, Claude gemischt, nach Aufgabe dispatcht;
- **Einsteiger**: überspring die Modellrecherche, wähle Auto, leg los.

## Installation

```bash
dsh plugin --profile web add -w link:/path/to/model-aware-auto-plugin
```

DSH neu starten und das Plugin aktivieren. Neue Sitzungen zeigen **Model Autoshift → Auto** im Modellwähler. Für die Desktop-App `--profile desktop` verwenden.

## Schnellstart

1. Mindestens ein Textmodell in den DSH-Einstellungen konfigurieren (offiziell oder Relay);
2. Neue Sitzung, **Auto** wählen;
3. Aufgabe stellen.

Das war's.

<img src="docs/entry.en.png" alt="Einstieg: der Auto-Gang im Modellwähler" width="440">

## Drei Modi

| Modus | Verhalten |
|---|---|
| `economy` | Routine geht an günstige Modelle; Kosten gewichten am stärksten |
| `balanced` (Standard) | Aufgabenpassung zuerst, Kosten berücksichtigt |
| `quality` | Nur Aufgabenpassung, Kosten ignoriert |

```yaml
mode: economy
```

## Beispielaufgaben

| Rolle | Was du hineinwirfst |
|---|---|
| Engineering | Stack Trace beheben, Funktion refactoren, Skript schreiben, API deployen, Tests laufen lassen |
| Kreatives | Gedicht schreiben, Geschichte erfinden, Rollenspiel, Copy entwerfen |
| Schreiben | E-Mail feilen, Artikel zusammenfassen, übersetzen, Wochenbericht schreiben |
| Recherche | Literatur sichten, Optionen vergleichen, Benchmark laufen lassen |
| Architektur | Systemdesign, Technologieauswahl, Microservices aufteilen |
| Alltag | Plaudern, Fragen & Antworten, allerlei Routine |

Welche Rolle die Aufgabe auch ergibt, Auto wählt ein Modell für diese Rolle aus deinem Pool — Routine in Economy, harte Brocken als Flaggschiff.

## Relay-Modelle ohne Konfiguration erkannt

Relay-Pools stecken voller unbekannter IDs. Auto stuft sie nach Namen ein und dispatcht:

- **Economy**: `mini / flash / lite / haiku / free / turbo`, plus kleine Open-Weight-Modelle wie `7b / 8b`;
- **Flagship**: `pro / opus / ultra / max`, plus Reasoning-Modelle wie `r1 / o3 / reasoner / thinking`;
- **Engineering-Tendenz**: `coder / code / dev`, deepseek-/claude-Familie; **kreative Tendenz**: gemini-Familie.

Eine günstige Variante einer Flaggschiff-Familie (`pro-flash`) zählt weiter als Economy. Weitergeleitet wird immer die exakte Katalog-ID. Zum Feintunen von Kosten oder Rollen mit `economics` in `preferences` / `routes` überschreiben.

## Für die Sitzung fixiert, kein Drift beim Neustart

Die erste erfolgreiche Route bindet die ganze Sitzung. Nach Kontextkomprimierung oder Desktop-Neustart wird die Bindung aus Sitzungsereignissen wiederhergestellt, nie neu gewählt; Kontext wird nie zwischen Modellen gemischt, und das stabile Präfix ist freundlich zum Provider-Cache. Wird das fixierte Modell entfernt, nennt Auto den nächsten Schritt, statt mitten im Gespräch still das Modell zu wechseln.

## Routenbeleg

Eine kleine Zeile am Ende jeder Runde: `Auto · model · tier · role`, plus `fallback×N`, wenn ein Ersatz genommen wurde. Sie liest Routenmetadaten, die bereits in der Sitzung sind — null zusätzliche Anfragen; Nicht-Auto-Runden zeigen nichts.

## Subagent-Aufteilung (optional)

Wenn DSHs natives Subagent-Tool die Modellauswahl aktiviert und die Sitzung eine Kind-Richtlinie hat, führt Auto ein lokales Rollen-Matching plus eine kurze Übergabe für Unteraufgaben **ohne explizites Modell** aus. Explizit gewählte Subagent-Modelle gewinnen immer; Start, Abbruch, Berechtigungen und Recycling bleiben nativ in DSH.

## Berechtigungen & Daten

Auto liest nur deine eingebundenen Modellkataloge und die aktuellen Sitzungsereignisse und leitet nur an Provider weiter, die du konfiguriert hast. Es berührt keine Workspace-Dateien und lädt keine Telemetrie hoch; die gesamte Konfiguration bleibt lokal.

## Konfiguration (alles optional)

### Leichte Präferenzen

```yaml
preferences:
  - provider: your-provider-id
    model: exact-model-id
    roles: [engineering]
```

Präferenzen justieren nur die Reihenfolge; andere eingebundene Modelle nehmen weiter teil.

### Bereichskontrolle

```yaml
scope:
  providers: [provider-a, provider-b]   # Allowlist, leer = alle
  excludeProviders: [provider-c]
  excludeModels: [some-model]
```

### Erweiterte Profile

Eine vollständige `routes`-Liste überschreibt die automatische Erkennung für feste Team-Flows oder langfristiges Tuning: `roles`, `tools`, `behavior`, `dimensions`, `economics`, `contextWindow`, `maxOutputTokens`, `routeRevision`. Echte DSH-Provider-/Modell-IDs verwenden; keine API-Keys in der Konfiguration.

## Gut zu wissen

- Nur Textaufgaben; Bildmodalitäten liegen außerhalb von Autos Katalog;
- Alte Sitzungen, die mit einem anderen Modell gestartet sind, können nicht nachträglich zu Auto wechseln — neue Sitzung starten;
- Hilfsanfragen (Titel, Zusammenfassungen) folgen der fixierten Route der Sitzung.

## Kompatibilität

DSH `0.2.2-rc.1` · Node.js 22+.

## Architektur

![Architecture](docs/architecture.png)

## Entwicklung

```bash
node --test
```

## Lizenz

Apache-2.0 © 2026 掠蓝 (Ylsssq926). Weiterverwendung und abgeleitete Werke müssen die Attribution aus [LICENSE](LICENSE) und [NOTICE](NOTICE) beibehalten und wesentliche Änderungen angeben.