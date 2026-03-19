import { useEffect, useState, useRef } from "react";
import styled from "styled-components";
import { agent as agentApi, session as sessionApi } from "@/lib/api";
import type { AgentLoopState, PhaseHistoryEntry, SessionState, LoopPhase } from "@/types/api";
import Badge from "./Badge";

/* ── Styled ── */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h4`
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
`;

const SessionSelect = styled.select`
  padding: 4px 8px;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-family: inherit;
  outline: none;

  &:focus {
    border-color: var(--border-focus);
  }
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-md);
  font-size: var(--font-size-sm);
`;

const StatusDot = styled.span<{ $status: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) =>
    p.$status === "running"
      ? "var(--accent)"
      : p.$status === "completed"
        ? "var(--success)"
        : p.$status === "error"
          ? "var(--danger)"
          : "var(--text-muted)"};
  ${(p) =>
    p.$status === "running" &&
    `animation: pulse 1s infinite;
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }`}
`;

const Timeline = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: var(--space-sm) 0;
  overflow-x: auto;
`;

const PhaseNode = styled.div<{ $status: "completed" | "active" | "pending" }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  background: ${(p) =>
    p.$status === "completed"
      ? "var(--success)"
      : p.$status === "active"
        ? "var(--accent)"
        : "var(--bg-surface)"};
  color: ${(p) =>
    p.$status === "pending" ? "var(--text-muted)" : "#fff"};
  border: 1px solid ${(p) =>
    p.$status === "completed"
      ? "var(--success)"
      : p.$status === "active"
        ? "var(--accent)"
        : "var(--border)"};
  ${(p) =>
    p.$status === "active" &&
    `animation: pulse 1.5s infinite;
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }`}
`;

const PhaseArrow = styled.span`
  color: var(--text-muted);
  font-size: 10px;
  padding: 0 2px;
`;

const IterBadge = styled.span`
  font-size: 10px;
  opacity: 0.8;
  font-family: var(--font-mono);
`;

const EventLog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
  font-size: var(--font-size-sm);
  font-family: var(--font-mono);
`;

const EventRow = styled.div<{ $type?: string }>`
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  padding: 2px var(--space-sm);
  border-radius: 2px;
  background: ${(p) =>
    p.$type === "phase_change" ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent"};
`;

const EventTime = styled.span`
  color: var(--text-muted);
  font-size: 10px;
  flex-shrink: 0;
`;

const EventText = styled.span`
  color: var(--text-secondary);
`;

const PhaseTag = styled.span`
  font-size: 9px;
  padding: 0 4px;
  background: var(--accent-muted);
  color: var(--accent);
  border-radius: 2px;
  font-weight: 600;
  flex-shrink: 0;
`;

const Empty = styled.p`
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
`;

/* ── Helpers ── */

interface LogEntry {
  time: string;
  type: "phase_change" | "status" | "info";
  text: string;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

function phaseStatus(
  phaseName: string,
  allPhases: LoopPhase[],
  state: AgentLoopState | null,
): "completed" | "active" | "pending" {
  if (!state) return "pending";
  if (state.currentPhase === phaseName && state.status === "running") return "active";
  if (state.phaseHistory.some((h) => h.phase === phaseName)) return "completed";
  // If the loop is done and this was the current phase
  if (
    state.currentPhase === phaseName &&
    (state.status === "completed" || state.status === "error")
  )
    return "completed";
  return "pending";
}

/* ── Component ── */

interface LoopStateViewerProps {
  agentId: string;
  phases: LoopPhase[];
}

export default function LoopStateViewer({ agentId, phases }: LoopStateViewerProps) {
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [loopState, setLoopState] = useState<AgentLoopState | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Load sessions for this agent
  useEffect(() => {
    sessionApi.list().then((all) => {
      const agentSessions = all.filter((s) => s.agentId === agentId);
      setSessions(agentSessions);
      // Auto-select the most recent
      if (agentSessions.length > 0 && !selectedSession) {
        setSelectedSession(agentSessions[agentSessions.length - 1].id);
      }
    }).catch(() => {});
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to loop state SSE when session changes
  useEffect(() => {
    // Clean up previous subscription
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!selectedSession) {
      setLoopState(null);
      setLog([]);
      return;
    }

    // Try to get current state first
    agentApi.loopState(selectedSession).then((state) => {
      setLoopState(state);
      // Build initial log from history
      const entries: LogEntry[] = state.phaseHistory.map((h) => ({
        time: formatTime(h.endedAt),
        type: "phase_change" as const,
        text: `${h.phase} → (${h.transitionReason}) [${h.iterations} iter, ${h.toolCallCount} tools]`,
      }));
      if (state.status === "running") {
        entries.push({
          time: formatTime(state.updatedAt),
          type: "info",
          text: `Aktiv: ${state.currentPhase} (Iteration ${state.phaseIteration})`,
        });
      }
      setLog(entries);
    }).catch(() => {
      // No active loop state — that's fine
      setLoopState(null);
      setLog([]);
    });

    // Subscribe to live updates
    const unsub = agentApi.loopStateStream(selectedSession, (state) => {
      setLoopState(state);

      // Add log entries for changes
      setLog((prev) => {
        const last = prev[prev.length - 1];
        const entry: LogEntry = {
          time: formatTime(state.updatedAt),
          type: "info",
          text: `${state.currentPhase} — Iteration ${state.phaseIteration}/${state.totalIteration} [${state.status}]`,
        };

        // Detect phase changes from history
        if (state.phaseHistory.length > 0) {
          const latestHistory = state.phaseHistory[state.phaseHistory.length - 1];
          const alreadyLogged = prev.some(
            (e) => e.type === "phase_change" && e.text.startsWith(latestHistory.phase + " →"),
          );
          if (!alreadyLogged) {
            return [
              ...prev,
              {
                time: formatTime(latestHistory.endedAt),
                type: "phase_change",
                text: `${latestHistory.phase} → ${state.currentPhase} (${latestHistory.transitionReason}) [${latestHistory.iterations} iter, ${latestHistory.toolCallCount} tools]`,
              },
              entry,
            ];
          }
        }

        // Deduplicate status updates
        if (last?.text === entry.text) return prev;
        return [...prev, entry];
      });
    });

    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [selectedSession]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <Wrapper>
      <Header>
        <Title>Live Loop Viewer</Title>
        <SessionSelect
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
        >
          <option value="">-- Session wählen --</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.id.slice(0, 12)}
            </option>
          ))}
        </SessionSelect>
      </Header>

      {loopState ? (
        <>
          {/* Status */}
          <StatusRow>
            <StatusDot $status={loopState.status} />
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {loopState.status.toUpperCase()}
            </span>
            <Badge variant="info">
              Phase: {loopState.currentPhase}
            </Badge>
            <span style={{ color: "var(--text-muted)" }}>
              Iteration {loopState.phaseIteration} | Total {loopState.totalIteration}
            </span>
          </StatusRow>

          {/* Phase Timeline */}
          <Timeline>
            {phases.map((phase, i) => {
              const status = phaseStatus(phase.name, phases, loopState);
              const historyEntry = loopState.phaseHistory.find((h) => h.phase === phase.name);
              return (
                <span key={phase.name} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <PhaseArrow>→</PhaseArrow>}
                  <PhaseNode $status={status}>
                    {phase.name}
                    {status === "active" && (
                      <IterBadge>
                        ({loopState.phaseIteration}/{phase.maxIterations})
                      </IterBadge>
                    )}
                    {status === "completed" && historyEntry && (
                      <IterBadge>
                        ({historyEntry.iterations}i, {historyEntry.toolCallCount}t)
                      </IterBadge>
                    )}
                  </PhaseNode>
                </span>
              );
            })}
          </Timeline>

          {/* Phase History Cards */}
          {loopState.phaseHistory.length > 0 && (
            <div style={{ fontSize: "var(--font-size-sm)" }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                Abgeschlossene Phasen:
              </span>
              <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: 4, flexWrap: "wrap" }}>
                {loopState.phaseHistory.map((h, i) => (
                  <PhaseHistoryCard key={i} entry={h} />
                ))}
              </div>
            </div>
          )}

          {/* Event Log */}
          <div>
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: "var(--font-size-sm)",
                fontWeight: 500,
              }}
            >
              Event Log
            </span>
            <EventLog ref={logRef}>
              {log.length === 0 ? (
                <Empty>Keine Events</Empty>
              ) : (
                log.map((entry, i) => (
                  <EventRow key={i} $type={entry.type}>
                    <EventTime>{entry.time}</EventTime>
                    {entry.type === "phase_change" && (
                      <PhaseTag>PHASE</PhaseTag>
                    )}
                    <EventText>{entry.text}</EventText>
                  </EventRow>
                ))
              )}
            </EventLog>
          </div>
        </>
      ) : (
        <Empty>
          {selectedSession
            ? "Kein aktiver Loop für diese Session. Starte einen Chat um den Loop zu sehen."
            : "Wähle eine Session um den Loop-State zu sehen."}
        </Empty>
      )}
    </Wrapper>
  );
}

/* ── Sub-components ── */

const HistoryCard = styled.div`
  padding: 4px 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

function PhaseHistoryCard({ entry }: { entry: PhaseHistoryEntry }) {
  return (
    <HistoryCard>
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{entry.phase}</span>
      <span style={{ color: "var(--text-muted)" }}>
        {entry.iterations} Iterationen, {entry.toolCallCount} Tool-Calls
      </span>
      <span style={{ color: "var(--text-muted)" }}>
        → {entry.transitionReason}
      </span>
    </HistoryCard>
  );
}
