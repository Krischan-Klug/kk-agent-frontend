# kk-agent-frontend

Frontend fuer `kk-agent-backend`. Chat, Agent-Editor, MCP-Verwaltung und Provider-Settings.

## Seiten

- `/chat` — Streaming-Chat mit Iterations-Anzeige, Tool-Cards, Thinking-Ansicht und Session-Controls
- `/agent` — Agent-Editor: System-Prompt, Iteration (maxIterations + compactionThreshold), MCP-Zuordnung, Variablen, Compaction-Prompt
- `/session` — Sessions erstellen, loeschen und verwalten
- `/mcp` — MCP-Server anlegen, starten, stoppen und konfigurieren
- `/provider` — Modellwahl und Model-Settings

## API-Vertrag

Das Frontend folgt der aktuellen Backend-Shape:

- Assistant-Messages trennen `content` und `reasoning`
- Persistierte Compaction-Hinweise erscheinen als neutrale `system`-Verlaufseintraege
- Thinking wird aus `message.reasoning` gerendert, nicht aus `<think>`-Parsing
- Nur strukturierte `tool_calls` sind echte Tool-Aufrufe

### Relevante Typen

```ts
type SessionMessage = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  kind?: "compaction";
  reasoning?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
};

type AgentDefinition = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  maxIterations: number;
  mcpIds: string[];
  mcpInstructions: Record<string, string>;
  variables: Record<string, string>;
  defaultModel?: string;
  reasoningEffort?: string;
  compactionPrompt?: string;
  compactionThreshold?: number;
  createdAt: string;
  updatedAt: string;
};

type AgentLoopState = {
  sessionId: string;
  agentId: string;
  status: "idle" | "running" | "completed" | "error";
  iteration: number;
  maxIterations: number;
  startedAt: string;
  updatedAt: string;
};
```

## Chat-Verhalten

Die Chat-Seite verarbeitet folgende SSE-Events:

- `content` — Gestreamter Antworttext
- `reasoning` — Gestreamtes Thinking/Reasoning
- `tool_call` — LLM ruft ein Tool auf
- `tool_result` — Tool-Ergebnis zurueck
- `loop_state` — Iterations-Status (iteration/maxIterations, status)
- `compaction` — Context wurde komprimiert
- `retry_notice` — Korrekturversuch (leere Antwort, invalider Tool-Call)
- `stats` — Token-Statistiken (input, output, reasoning)
- `done` — Finale Session mit allen Messages
- `error` — Fehlermeldung

Waehrend des Streams zeigt ein `IterationPill` die aktuelle Iteration an (z.B. "Iteration 2/10").

## Quick Start

```bash
npm install
npm run dev
```

Standard-Port: `3000`

Per Default wird das Backend unter `http://localhost:3001` erwartet. Ueberschreiben ueber `NEXT_PUBLIC_API_URL`.
