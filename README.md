# kk-agent-frontend

Frontend für das Multi-Agent Framework. Verbindet sich mit dem Backend (Port 3001) und bietet Agent-Konfiguration, phasen-basiertes Chat-Streaming und MCP-Verwaltung.

---

## Architektur

```
┌──────────────────────────────────────────────────────────────┐
│                          Seiten                               │
│                                                               │
│  /chat          /agent          /session   /mcp    /provider  │
│  Streaming-     Agent-Editor    Session-   MCP-    Model-     │
│  Chat mit       Phasen-Graph   Verwaltung CRUD    Settings   │
│  Loop-State     Variablen      Agent-             Reasoning  │
│  Reasoning      Prompts        Auswahl            Compaction │
│  Temperature    Compaction                                    │
│  Context-Ring                                                 │
└────────┬────────────┬──────────────┬──────────┬──────┬───────┘
         │            │              │          │      │
┌────────▼────────────▼──────────────▼──────────▼──────▼───────┐
│                      Komponenten                              │
│                                                               │
│  LoopStateViewer   PhaseGraph    AgentSelect    CodeBlock     │
│  ModelSelect       McpSelect    Sidebar         Modal         │
│  ContextRing       Toggle       Card            Spinner       │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────┐
│                       API Layer                                │
│                lib/api.ts → Backend :3001                      │
│                                                               │
│  agent.*    session.*    mcp.*    provider.*                   │
│  CRUD,      CRUD,        CRUD,   Models,                      │
│  LoopState  Chat/Stream  Tools   ModelSettings                │
└───────────────────────────────────────────────────────────────┘
```

---

## Seiten

| Route | Funktion |
|-------|----------|
| `/chat` | Streaming-Chat mit Live-Reasoning, Tool-Cards, Phase-Anzeige, Loop-State, Reasoning/Temperature-Controls, Context-Ring |
| `/agent` | Agent-Editor: Phasen-Graph, Transitions, Prompts, Variablen, MCP-Zuordnung, Reasoning Effort, Compaction Prompt |
| `/session` | Sessions erstellen/löschen, Agent und Model zuweisen |
| `/mcp` | MCP-Server verwalten (stdio/SSE), Tools inspizieren, Instructions, Auto-Start-Status |
| `/provider` | Model-Einstellungen: Reasoning-Default, Level-Config (Temperature/MaxOutput), Custom Compaction Prompt |

---

## Agent-Editor (`/agent`)

Der Agent-Editor ist das Kernstück der Konfiguration:

```
┌─────────────────────────────────────────┐
│  Agent-Liste  │  Editor                 │
│               │                         │
│  > General    │  Name, Description      │
│    Coding     │  ──────────────────     │
│               │  Phasen-Graph (visuell) │
│               │  ──────────────────     │
│               │  MCPs (Multi-Select)    │
│               │  Status-Dots (●/●)     │
│               │  ──────────────────     │
│               │  Variablen (Key/Value)  │
│               │  ──────────────────     │
│               │  Base-Prompt            │
│               │  Phasen-Prompts         │
│               │  ──────────────────     │
│               │  Reasoning Effort       │
│               │  Compaction Prompt      │
│               │  ──────────────────     │
│               │  LoopStateViewer        │
└───────────────┴─────────────────────────┘
```

- **PhaseGraph**: Visualisiert Phasen als Knoten und Transitions als Kanten
- **Variablen**: Custom Template-Variablen (`{{KEY}}`), zusätzlich zu System-Variablen (`{{CURRENT_DATE}}`, etc.)
- **Prompts**: Base-Prompt + phasenspezifische Erweiterungen, beide mit Variable-Resolution
- **MCPs**: Multi-Select mit Status-Dots (grün = running, rot = stopped)
- **Reasoning Effort**: Default Reasoning-Level pro Agent (off/low/medium/high/xhigh)
- **Compaction Prompt**: Opt-in Custom-Prompt für Context-Komprimierung (überschreibt Provider/Default)

---

## Chat-Integration

Der Chat zeigt den Agent-Loop in Echtzeit:

- **SSE-Events**: `content`, `reasoning`, `tool_call`, `tool_result`, `phase_change`, `loop_state`, `stats`, `done`, `error`
- **Phase-Anzeige**: Aktuelle Phase und Iteration sichtbar während der Ausführung
- **Tool-Cards**: Tool-Aufrufe und -Ergebnisse als aufklappbare Cards
- **Reasoning-Cards**: `<think>`-Blöcke als togglebare Cards
- **Reasoning-Select**: Reasoning-Level wählen (Off/Low/Med/High/XHigh) — wird als Session-Override gespeichert
- **Temperature-Select**: Temperature wählen (0.0–2.0 in 0.1-Schritten) — wird als Session-Override gespeichert
- **Context-Ring**: SVG-Kreis-Indikator für Context-Füllstand + Token-Anzeige (current/max). Farben: blau (normal), orange (>80%), rot (>95%)
- **Agent-Wechsel**: Erstellt automatisch eine neue Session für den gewählten Agent
- **Context Compaction**: Automatisch bei 80% Context-Auslastung (Backend-seitig)

---

## Provider-Seite (`/provider`)

Zeigt alle verfügbaren Modelle mit konfigurierbaren Einstellungen:

- **Reasoning Default**: Default Reasoning-Level pro Model (off/low/medium/high/xhigh)
- **On/Off Checkbox**: Per-Model Toggle für Modelle die nur on/off Reasoning können (z.B. qwen) — Backend mappt automatisch
- **Level-Config** (togglebar pro Model): Temperature und Max Output Tokens pro Reasoning-Level
- **Compaction Prompt**: Opt-in Custom-Prompt für Context-Komprimierung (überschreibt Default, wird von Agent überschrieben)

---

## MCP-Verwaltung (`/mcp`)

- **Auto-Start**: Alle konfigurierten MCPs werden beim Backend-Start automatisch gestartet
- **Status**: Running/Stopped Status sichtbar als grüne/rote Dots
- **Toggle**: MCPs können pro Session aktiviert/deaktiviert werden; gestoppte MCPs sind als Toggle deaktiviert
- **Warn-Indikator**: MCP-Trigger-Button wird orange wenn aktive MCPs nicht verfügbar sind

---

## Schlüssel-Komponenten

| Komponente | Funktion |
|-----------|----------|
| `PhaseGraph` | SVG-Visualisierung des Phasen-Graphen mit Transitions |
| `LoopStateViewer` | Echtzeit Loop-State via SSE, Phase-Timeline, Event-Log |
| `AgentSelect` | Agent-Auswahl für Session-Erstellung |
| `ModelSelect` | Model-Wechsel per Dropdown |
| `McpSelect` | MCP-Toggle pro Session, Running/Stopped Status-Dots, Warn-Indikator |
| `ContextRing` | SVG Context-Füllstand (80% warning, 95% danger) mit Token-Zähler |
| `CodeBlock` | Syntax-Highlighting, Copy, Collapse bei 50+ Zeilen |
| `Sidebar` | Navigation + Session-Liste |
| `Toggle` | Wiederverwendbarer Toggle-Switch mit disabled-State |
| `Card` | Standard-Card-Container |

---

## Quick Start

```bash
npm install
npm run dev   # Port 3000
```

Voraussetzung: Backend auf `http://localhost:3001` (konfigurierbar via `NEXT_PUBLIC_API_URL`).

Tech-Stack: Next.js (Pages Router), styled-components, TypeScript.
