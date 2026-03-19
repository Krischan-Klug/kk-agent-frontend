# kk-agent-frontend

Frontend für das Multi-Agent Framework. Verbindet sich mit dem Backend (Port 3001) und bietet Agent-Konfiguration, phasen-basiertes Chat-Streaming und MCP-Verwaltung.

---

## Architektur

```
┌─────────────────────────────────────────────────────────┐
│                        Seiten                           │
│                                                         │
│  /chat          /agent          /session       /mcp     │
│  Streaming-     Agent-Editor    Session-       MCP-     │
│  Chat mit       Phasen-Graph   Verwaltung     CRUD     │
│  Loop-State     Variablen      Agent-Auswahl           │
│                 Prompts                                  │
└────────┬────────────┬──────────────┬───────────┬────────┘
         │            │              │           │
┌────────▼────────────▼──────────────▼───────────▼────────┐
│                    Komponenten                           │
│                                                         │
│  LoopStateViewer   PhaseGraph   AgentSelect   CodeBlock │
│  ModelSelect       McpSelect   Sidebar        Modal     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                     API Layer                            │
│              lib/api.ts → Backend :3001                  │
│                                                         │
│  agent.*    session.*    mcp.*    provider.*             │
│  CRUD,      CRUD,        CRUD,   Models,                │
│  LoopState  Chat/Stream  Tools   Switch                 │
└─────────────────────────────────────────────────────────┘
```

---

## Seiten

| Route | Funktion |
|-------|----------|
| `/chat` | Streaming-Chat mit Live-Reasoning, Tool-Cards, Phase-Anzeige, Loop-State |
| `/agent` | Agent-Editor: Phasen-Graph, Transitions, Prompts, Variablen, MCP-Zuordnung |
| `/session` | Sessions erstellen/löschen, Agent und Model zuweisen |
| `/mcp` | MCP-Server verwalten (stdio/SSE), Tools inspizieren, Instructions |

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
│               │  ──────────────────     │
│               │  Variablen (Key/Value)  │
│               │  ──────────────────     │
│               │  Base-Prompt            │
│               │  Phasen-Prompts         │
│               │  ──────────────────     │
│               │  LoopStateViewer        │
└───────────────┴─────────────────────────┘
```

- **PhaseGraph**: Visualisiert Phasen als Knoten und Transitions als Kanten
- **Variablen**: Custom Template-Variablen (`{{KEY}}`), zusätzlich zu System-Variablen (`{{CURRENT_DATE}}`, etc.)
- **Prompts**: Base-Prompt + phasenspezifische Erweiterungen, beide mit Variable-Resolution

---

## Chat-Integration

Der Chat zeigt den Agent-Loop in Echtzeit:

- **SSE-Events**: `content`, `reasoning`, `tool_call`, `tool_result`, `phase_change`, `loop_state`, `done`, `error`
- **Phase-Anzeige**: Aktuelle Phase und Iteration sichtbar während der Ausführung
- **Tool-Cards**: Tool-Aufrufe und -Ergebnisse als aufklappbare Cards
- **Reasoning-Cards**: `<think>`-Blöcke als togglebare Cards

---

## Schlüssel-Komponenten

| Komponente | Funktion |
|-----------|----------|
| `PhaseGraph` | SVG-Visualisierung des Phasen-Graphen mit Transitions |
| `LoopStateViewer` | Echtzeit Loop-State via SSE, Phase-Timeline, Event-Log |
| `AgentSelect` | Agent-Auswahl für Session-Erstellung |
| `ModelSelect` | Model-Wechsel per Dropdown |
| `McpSelect` | MCP-Toggle pro Session |
| `CodeBlock` | Syntax-Highlighting, Copy, Collapse bei 50+ Zeilen |
| `Sidebar` | Navigation + Session-Liste |

---

## Quick Start

```bash
npm install
npm run dev   # Port 3000
```

Voraussetzung: Backend auf `http://localhost:3001` (konfigurierbar via `NEXT_PUBLIC_API_URL`).

Tech-Stack: Next.js (Pages Router), styled-components, TypeScript.
