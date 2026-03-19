# kk-agent-frontend

Frontend fuer `kk-agent-backend`. Die App bietet Chat, Agent-Editor, MCP-Verwaltung und Provider-Settings auf Basis der aktuellen Backend-API.

## Seiten

- `/chat` - Streaming-Chat mit Loop-State, Tool-Cards, Thinking-Ansicht und Session-Controls
- `/agent` - Agent-Editor fuer Prompt, Phasen, Transitionen, MCP-Zuordnung und Compaction Prompt
- `/session` - Sessions erstellen, loeschen und verwalten
- `/mcp` - MCP-Server anlegen, starten, stoppen und konfigurieren
- `/provider` - Modellwahl und Model-Settings

## API-Vertrag

Das Frontend folgt der aktuellen Backend-Shape:

- Assistant-Messages trennen `content` und `reasoning`
- Thinking wird aus `message.reasoning` gerendert, nicht aus `<think>`-Parsing
- nur strukturierte `tool_calls` sind echte Tool-Aufrufe
- Pseudo-Toolcalls aus Text oder Thinking werden nicht heuristisch interpretiert
- es gibt keine manuelle Session-Compaction-API mehr

### Relevante Typen

```ts
type SessionMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  reasoning?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
};

type LoopPhase = {
  name: string;
  description: string;
  maxIterations: number;
  toolFilter?: { mode: "include" | "exclude"; toolNames: string[] };
  completionCriteria?: {
    mode: "stop" | "signal";
    signal?: string;
    requiresToolCall?: boolean;
  };
  continueOnStop?: boolean;
  transitions: Array<{
    to: string;
    condition:
      | { type: "max_iterations" }
      | { type: "no_tool_calls" }
      | { type: "tool_called"; toolName: string }
      | { type: "tool_result_error" }
      | { type: "phase_complete" }
      | { type: "keyword"; keyword: string }
      | { type: "always" };
  }>;
  autoAdvance: boolean;
};
```

## Chat-Verhalten

Die Chat-Seite verarbeitet folgende SSE-Events:

- `content`
- `reasoning`
- `tool_call`
- `tool_result`
- `phase_change`
- `loop_state`
- `stats`
- `done`
- `error`

`reasoning` bleibt waehrend des Streams und nach Abschluss sichtbar, weil die finale Session dieselben Daten persistiert zurueckliefert.

## Quick Start

```bash
npm install
npm run dev
```

Standard-Port: `3000`

Per Default wird das Backend unter `http://localhost:3001` erwartet. Ueberschreiben ueber `NEXT_PUBLIC_API_URL`.
