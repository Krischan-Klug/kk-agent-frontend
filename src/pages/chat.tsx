import { useEffect, useState, useRef, useCallback } from "react";
import styled from "styled-components";
import { session as sessionApi, provider as providerApi, mcp as mcpApi, agent as agentApi } from "@/lib/api";
import type { SessionState, SessionMessage, StreamEvent, McpListItem, AgentDefinition, AgentLoopState, ModelInfo, ModelSettings, ReasoningEffort } from "@/types/api";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Spinner from "@/components/Spinner";
import CodeBlock from "@/components/CodeBlock";
import ModelSelect from "@/components/ModelSelect";
import McpSelect from "@/components/McpSelect";
import AgentSelect from "@/components/AgentSelect";

/* ── Styled Components ── */

const ChatWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: calc(100vh - 2 * var(--space-lg));
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-md);
  flex-shrink: 0;
`;

const TopBarInfo = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
`;

const PhaseBar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  margin-bottom: var(--space-sm);
  font-size: var(--font-size-sm);
  flex-shrink: 0;
`;

const PhaseDot = styled.span<{ $status: "completed" | "active" | "pending" }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) =>
    p.$status === "completed"
      ? "var(--success)"
      : p.$status === "active"
        ? "var(--accent)"
        : "var(--border)"};
  ${(p) =>
    p.$status === "active" &&
    `animation: pulse 1s infinite;
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }`}
`;

const PhasePill = styled.span`
  padding: 1px var(--space-sm);
  background: var(--accent-muted);
  color: var(--accent);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-mono);
`;

const Messages = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: 0 0 var(--space-md);
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
`;

const MessageBubble = styled.div<{ $role: string }>`
  max-width: 80%;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  align-self: ${(p) => (p.$role === "user" ? "flex-end" : "flex-start")};
  background: ${(p) =>
    p.$role === "user"
      ? "var(--accent-muted)"
      : p.$role === "tool"
        ? "var(--bg-elevated)"
        : "var(--bg-surface)"};
  border: 1px solid
    ${(p) => (p.$role === "user" ? "var(--accent)" : "var(--border)")};
  ${(p) => p.$role === "user" && "white-space: pre-wrap;"}
  word-break: break-word;
  font-size: var(--font-size-base);
  ${(p) =>
    p.$role === "tool" &&
    `
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  `}
`;

const RoleLabel = styled.div`
  margin-bottom: var(--space-xs);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
`;

const CollapsibleCard = styled.details`
  margin-top: var(--space-sm);
  border-radius: var(--radius-sm);
  overflow: hidden;

  &[open] > summary {
    border-bottom: 1px solid var(--border);
  }
`;

const ReasoningCard = styled.details`
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: color-mix(in srgb, var(--warning) 10%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--warning) 30%, var(--border));
  font-size: 0.85em;
  margin-bottom: var(--space-sm);
  display: flex;
  flex-direction: column-reverse;

  &[open] > summary {
    border-top: 1px solid color-mix(in srgb, var(--warning) 30%, var(--border));
  }
`;

const ToolCard = styled(CollapsibleCard)`
  background: var(--bg-elevated);
  border: 1px solid var(--border);
`;

const CardSummary = styled.summary`
  cursor: pointer;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  user-select: none;

  &::-webkit-details-marker {
    display: none;
  }

  &::before {
    content: "▶";
    font-size: 10px;
    transition: transform 0.15s;
  }

  details[open] > &::before {
    transform: rotate(90deg);
  }
`;

const ReasoningSummary = styled.summary`
  cursor: pointer;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  user-select: none;

  &::-webkit-details-marker {
    display: none;
  }

  &::before {
    content: "▲";
    font-size: 10px;
    transition: transform 0.15s;
  }

  details:not([open]) > &::before {
    content: "▼";
  }
`;

const CardContent = styled.div`
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  max-height: 300px;
  overflow-y: auto;
`;

const ToolLabel = styled.span`
  font-family: var(--font-mono);
  color: var(--text-primary);
  font-weight: 500;
`;

const ToolResultBlock = styled.div<{ $isError: boolean }>`
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
  color: ${(p) => (p.$isError ? "var(--danger)" : "var(--text-secondary)")};
`;

const InputArea = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
`;

const InputLeft = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
`;

const ReasoningSelect = styled.select`
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  padding: 2px 4px;
  cursor: pointer;
`;

const ContextIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
  flex-shrink: 0;
`;

const ChatInput = styled.textarea`
  flex: 1;
  min-width: 0;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-family: inherit;
  resize: none;
  outline: none;
  min-height: 42px;
  max-height: 120px;

  &:focus {
    border-color: var(--border-focus);
  }

  &::placeholder {
    color: var(--text-muted);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-md);
  color: var(--text-secondary);
`;

const StreamingDot = styled.span`
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1s infinite;
  margin-left: var(--space-xs);
  vertical-align: middle;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;

/* ── Types for streaming state ── */

interface ActiveToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: { content: string; isError: boolean };
}

/* ── Context Ring ── */

function ContextRing({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min(used / max, 1) : 0;
  const r = 8;
  const circ = 2 * Math.PI * r;
  const color = pct > 0.95 ? "var(--danger)" : pct > 0.8 ? "var(--warning)" : "var(--accent)";
  return (
    <svg width="20" height="20" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r={r} fill="none" stroke="var(--border)" strokeWidth="2" />
      <circle
        cx="10" cy="10" r={r} fill="none" stroke={color} strokeWidth="2"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        transform="rotate(-90 10 10)"
        style={{ transition: "stroke-dashoffset 0.3s" }}
      />
    </svg>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ── Content Parser ── */

const CODE_FENCE_RE = /```(\w*)\n([\s\S]*?)```/g;

function renderContent(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CODE_FENCE_RE.lastIndex = 0;
  while ((match = CODE_FENCE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t${lastIndex}`} style={{ whiteSpace: "pre-wrap" }}>
          {text.slice(lastIndex, match.index)}
        </span>,
      );
    }
    parts.push(
      <CodeBlock key={`c${match.index}`} code={match[2].replace(/\n$/, "")} language={match[1] || undefined} />,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`t${lastIndex}`} style={{ whiteSpace: "pre-wrap" }}>
        {text.slice(lastIndex)}
      </span>,
    );
  }

  return parts.length > 0 ? parts : text;
}

/* ── Component ── */

export default function ChatPage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const [models, setModels] = useState<string[]>([]);
  const [modelInfoMap, setModelInfoMap] = useState<Map<string, ModelInfo>>(new Map());
  const [modelSettingsMap, setModelSettingsMap] = useState<Record<string, ModelSettings>>({});
  const [mcps, setMcps] = useState<McpListItem[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);

  // Streaming state
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamReasoning, setStreamReasoning] = useState("");
  const [streamToolCalls, setStreamToolCalls] = useState<ActiveToolCall[]>([]);
  const [loopState, setLoopState] = useState<AgentLoopState | null>(null);
  const [tokenStats, setTokenStats] = useState<{ input: number; output: number; reasoning: number } | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  const loadSession = useCallback(() => {
    const id = localStorage.getItem("activeSessionId");
    if (id) {
      sessionApi
        .get(id)
        .then(setSession)
        .catch(() => {
          localStorage.removeItem("activeSessionId");
          setSession(null);
        })
        .finally(() => setLoading(false));
    } else {
      setSession(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
    providerApi.getModels().then((res) => {
      setModels(res.models.map((m) => m.id));
      setModelInfoMap(new Map(res.models.map((m) => [m.id, m])));
      setModelSettingsMap(res.modelSettings ?? {});
    }).catch(() => {});
    mcpApi.list().then(setMcps).catch(() => {});
    agentApi.list().then(setAgents).catch(() => {});

    window.addEventListener("session-changed", loadSession);
    return () => window.removeEventListener("session-changed", loadSession);
  }, [loadSession]);

  useEffect(scrollToBottom, [session?.messages, streamContent, streamReasoning, streamToolCalls, scrollToBottom]);

  // Get the current agent's phases for the phase bar
  const currentAgent = agents.find((a) => a.id === session?.agentId);
  const phases = currentAgent?.loopStrategy.phases ?? [];
  const hasMultiplePhases = phases.length > 1;

  // Resolve effective reasoning effort: session override > model default > "medium"
  const resolvedEffort: ReasoningEffort = session
    ? (session.reasoningEffort ?? modelSettingsMap[session.model]?.reasoningEffort ?? "medium")
    : "medium";

  // Resolve effective temperature: session override > level config > default (1.0)
  const resolvedTemp: number = session?.temperature ?? 1.0;

  // Context info
  const modelInfo = session ? modelInfoMap.get(session.model) : undefined;
  const maxCtx = modelInfo?.contextLength ?? modelInfo?.maxContextLength ?? 0;

  async function handleSend() {
    if (!input.trim() || !session || sending) return;
    const message = input.trim();
    setInput("");
    setSending(true);
    setStreaming(true);
    setStreamContent("");
    setStreamReasoning("");
    setStreamToolCalls([]);
    setLoopState(null);

    // Optimistic: add user message
    setSession((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, { role: "user" as const, content: message }] }
        : prev,
    );

    try {
      await sessionApi.chatStream(session.id, message, (event: StreamEvent) => {
        switch (event.type) {
          case "content":
            setStreamContent((prev) => prev + event.content);
            break;
          case "reasoning":
            setStreamReasoning((prev) => prev + event.content);
            break;
          case "tool_call":
            setStreamToolCalls((prev) => [
              ...prev,
              { id: event.toolCall.id, name: event.toolCall.name, arguments: event.toolCall.arguments },
            ]);
            break;
          case "tool_result":
            setStreamToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === event.toolCallId
                  ? { ...tc, result: { content: event.content, isError: event.isError } }
                  : tc,
              ),
            );
            break;
          case "phase_change":
            setStreamContent("");
            setStreamReasoning("");
            break;
          case "loop_state":
            setLoopState(event.state);
            break;
          case "stats":
            setTokenStats({ input: event.inputTokens, output: event.outputTokens, reasoning: event.reasoningTokens });
            break;
          case "done":
            setSession(event.session);
            setStreaming(false);
            setStreamContent("");
            setStreamReasoning("");
            setStreamToolCalls([]);
            setLoopState(null);
            window.dispatchEvent(new Event("session-changed"));
            break;
          case "error":
            console.error("Stream error:", event.message);
            setStreaming(false);
            setLoopState(null);
            break;
        }
      });
    } catch (err) {
      console.error(err);
      setStreaming(false);
      setLoopState(null);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleModelSwitch(model: string) {
    if (!session || model === session.model) return;
    try {
      const updated = await sessionApi.update(session.id, { model });
      setSession(updated);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMcpToggle(mcpId: string, enabled: boolean) {
    if (!session) return;
    const newIds = enabled
      ? [...session.activeMcpIds, mcpId]
      : session.activeMcpIds.filter((id) => id !== mcpId);
    try {
      const updated = await sessionApi.update(session.id, { activeMcpIds: newIds });
      setSession(updated);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReasoningEffort(value: string) {
    if (!session) return;
    const reasoningEffort = (value || undefined) as ReasoningEffort | undefined;
    try {
      const updated = await sessionApi.update(session.id, { reasoningEffort });
      setSession(updated);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTemperature(value: string) {
    if (!session) return;
    try {
      const updated = await sessionApi.update(session.id, { temperature: Number(value) });
      setSession(updated);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAgentSwitch(agentId: string) {
    if (!session || agentId === session.agentId) return;
    try {
      const newSession = await sessionApi.create({
        agentId,
        model: session.model,
        activeMcpIds: session.activeMcpIds,
      });
      localStorage.setItem("activeSessionId", newSession.id);
      setSession(newSession);
      setTokenStats(null);
      window.dispatchEvent(new Event("session-changed"));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleNewSession() {
    const agentId = agents.length > 0 ? agents[0].id : "general-assistant";
    try {
      const newSession = await sessionApi.create({ agentId });
      localStorage.setItem("activeSessionId", newSession.id);
      setSession(newSession);
      setTokenStats(null);
      window.dispatchEvent(new Event("session-changed"));
    } catch (err) {
      console.error(err);
    }
  }

  function renderToolCalls(toolCalls: ActiveToolCall[]) {
    return toolCalls.map((tc) => (
      <ToolCard key={tc.id}>
        <CardSummary>
          <ToolLabel>{tc.name}</ToolLabel>
          {tc.result ? (
            <Badge variant={tc.result.isError ? "danger" : "success"}>
              {tc.result.isError ? "Fehler" : "Fertig"}
            </Badge>
          ) : (
            <Spinner size={12} />
          )}
        </CardSummary>
        <CardContent>
          <div style={{ color: "var(--text-muted)", marginBottom: "var(--space-xs)" }}>Arguments:</div>
          {JSON.stringify(tc.arguments, null, 2)}
          {tc.result && (
            <ToolResultBlock $isError={tc.result.isError}>
              <div style={{ color: "var(--text-muted)", marginBottom: "var(--space-xs)" }}>Result:</div>
              {tc.result.content}
            </ToolResultBlock>
          )}
        </CardContent>
      </ToolCard>
    ));
  }

  function renderMessage(msg: SessionMessage, idx: number) {
    const hasThinkTags = msg.role === "assistant" && msg.content.includes("<think>");
    let reasoning = "";
    let content = msg.content;

    if (hasThinkTags) {
      const match = msg.content.match(/<think>([\s\S]*?)<\/think>/);
      if (match) {
        reasoning = match[1];
        content = msg.content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
      }
    }

    if (msg.role === "tool") return null;

    return (
      <MessageBubble key={idx} $role={msg.role}>
        {msg.role !== "user" && (
          <RoleLabel>
            <Badge variant="info">assistant</Badge>
          </RoleLabel>
        )}

        {reasoning && (
          <ReasoningCard>
            <ReasoningSummary>Reasoning</ReasoningSummary>
            <CardContent>{reasoning}</CardContent>
          </ReasoningCard>
        )}

        {renderContent(content)}

        {msg.tool_calls && msg.tool_calls.length > 0 &&
          renderToolCalls(
            msg.tool_calls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
              result: (() => {
                const toolMsg = session?.messages.find(
                  (m) => m.role === "tool" && m.tool_call_id === tc.id,
                );
                return toolMsg
                  ? { content: toolMsg.content, isError: false }
                  : undefined;
              })(),
            })),
          )}
      </MessageBubble>
    );
  }

  if (loading) return <Spinner />;

  if (!session) {
    return (
      <ChatWrapper>
        <EmptyState>
          <p>Keine aktive Session.</p>
          <Button onClick={handleNewSession}>Neue Session starten</Button>
        </EmptyState>
      </ChatWrapper>
    );
  }

  return (
    <ChatWrapper>
      <TopBar>
        <TopBarInfo>
          {agents.length > 0 && (
            <AgentSelect agents={agents} currentAgentId={session.agentId} onSelect={handleAgentSwitch} />
          )}
          {models.length > 0 ? (
            <ModelSelect models={models} currentModel={session.model} onSelect={handleModelSwitch} />
          ) : (
            <Badge variant="info">{session.model}</Badge>
          )}
          <McpSelect
            mcps={mcps}
            activeMcpIds={session.activeMcpIds}
            onToggle={handleMcpToggle}
          />
          <span style={{
            color: "var(--text-secondary)",
            fontSize: "var(--font-size-sm)",
            fontFamily: "var(--font-mono)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {session.name || session.id.slice(0, 8)}
          </span>
        </TopBarInfo>
        <Button size="sm" variant="secondary" onClick={handleNewSession}>
          Neue Session
        </Button>
      </TopBar>

      {/* Phase indicator bar — only shown for multi-phase agents during streaming */}
      {hasMultiplePhases && streaming && loopState && (
        <PhaseBar>
          {phases.map((phase) => {
            const completed = loopState.phaseHistory.some((h) => h.phase === phase.name);
            const active = loopState.currentPhase === phase.name;
            return (
              <PhaseDot
                key={phase.name}
                $status={completed ? "completed" : active ? "active" : "pending"}
                title={phase.name}
              />
            );
          })}
          <PhasePill>
            {loopState.currentPhase} ({loopState.phaseIteration}/{phases.find((p) => p.name === loopState.currentPhase)?.maxIterations ?? "?"})
          </PhasePill>
        </PhaseBar>
      )}

      <Messages ref={messagesRef}>
        {session.messages.length === 0 && !streaming && (
          <EmptyState>
            <p>Schreibe eine Nachricht um zu starten.</p>
          </EmptyState>
        )}

        {session.messages.map(renderMessage)}

        {/* Live streaming bubble */}
        {streaming && (streamContent || streamReasoning || streamToolCalls.length > 0) && (
          <MessageBubble $role="assistant">
            <RoleLabel>
              <Badge variant="info">assistant</Badge>
              <StreamingDot />
            </RoleLabel>

            {streamReasoning && (
              <ReasoningCard open>
                <ReasoningSummary>Reasoning</ReasoningSummary>
                <CardContent>{streamReasoning}</CardContent>
              </ReasoningCard>
            )}

            {renderContent(streamContent)}

            {streamToolCalls.length > 0 && renderToolCalls(streamToolCalls)}
          </MessageBubble>
        )}

        {streaming && !streamContent && !streamReasoning && streamToolCalls.length === 0 && (
          <div style={{ alignSelf: "flex-start" }}>
            <Spinner />
          </div>
        )}
      </Messages>

      <InputArea>
        <InputLeft>
          <span style={{ fontSize: "var(--font-size-sm)" }}>🧠</span>
          <ReasoningSelect
            value={resolvedEffort}
            onChange={(e) => handleReasoningEffort(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Med</option>
            <option value="high">High</option>
          </ReasoningSelect>
          <span style={{ fontSize: "var(--font-size-sm)" }}>🔥</span>
          <ReasoningSelect
            value={resolvedTemp.toFixed(1)}
            onChange={(e) => handleTemperature(e.target.value)}
          >
            {Array.from({ length: 21 }, (_, i) => {
              const v = (i * 0.1).toFixed(1);
              return <option key={v} value={v}>{v}</option>;
            })}
          </ReasoningSelect>
        </InputLeft>
        <ChatInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht eingeben..."
          rows={1}
          disabled={sending}
        />
        <Button onClick={handleSend} disabled={sending || !input.trim()}>
          Senden
        </Button>
        {tokenStats && maxCtx > 0 && (
          <ContextIndicator
            title={`Input: ${tokenStats.input.toLocaleString()} | Output: ${tokenStats.output.toLocaleString()} | Reasoning: ${tokenStats.reasoning.toLocaleString()}`}
          >
            <ContextRing used={tokenStats.input} max={maxCtx} />
            <span>{formatTokens(tokenStats.input)}/{formatTokens(maxCtx)}</span>
          </ContextIndicator>
        )}
      </InputArea>
    </ChatWrapper>
  );
}
