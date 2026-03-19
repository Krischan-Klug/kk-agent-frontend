import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styled from "styled-components";
import { session as sessionApi, provider as providerApi, mcp as mcpApi, agent as agentApi } from "@/lib/api";
import type { SessionState, ModelInfo, McpListItem, AgentDefinition } from "@/types/api";
import { PageTitle } from "@/components/Layout.styled";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import ModelSelect from "@/components/ModelSelect";

const Grid = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
`;

const SessionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
`;

const SessionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
`;

const SessionId = styled.code`
  color: var(--text-muted);
  font-size: var(--font-size-sm);
`;

const SessionMeta = styled.div`
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
`;

const Actions = styled.div`
  display: flex;
  gap: var(--space-sm);
`;

const FormGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);

  label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-xs);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-family: inherit;
  outline: none;

  &:focus {
    border-color: var(--border-focus);
  }

  option {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--text-secondary);
  cursor: pointer;

  input {
    accent-color: var(--accent);
  }
`;

export default function SessionPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Create form
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [mcps, setMcps] = useState<McpListItem[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedMcps, setSelectedMcps] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const [modelIds, setModelIds] = useState<string[]>([]);

  useEffect(() => {
    loadSessions();
    providerApi.getModels().then((res) => setModelIds(res.models.map((m) => m.id))).catch(() => {});
  }, []);

  async function loadSessions() {
    try {
      const data = await sessionApi.list();
      setSessions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function openCreateForm() {
    try {
      const [modelData, mcpData, agentData] = await Promise.all([
        providerApi.getModels(),
        mcpApi.list(),
        agentApi.list(),
      ]);
      setModels(modelData.models);
      setSelectedModel(modelData.activeModel);
      setMcps(mcpData);
      setAgents(agentData);
      if (agentData.length > 0) {
        setSelectedAgent(agentData[0].id);
        // Pre-select the agent's MCPs
        setSelectedMcps(new Set(agentData[0].mcpIds));
      }
      setShowCreate(true);
    } catch (err) {
      console.error(err);
    }
  }

  function handleAgentChange(agentId: string) {
    setSelectedAgent(agentId);
    const ag = agents.find((a) => a.id === agentId);
    if (ag) {
      setSelectedMcps(new Set(ag.mcpIds));
    }
  }

  async function handleCreate() {
    if (!selectedAgent) return;
    setCreating(true);
    try {
      const s = await sessionApi.create({
        agentId: selectedAgent,
        model: selectedModel || undefined,
        activeMcpIds: selectedMcps.size > 0 ? [...selectedMcps] : undefined,
      });
      setShowCreate(false);
      setSelectedMcps(new Set());
      localStorage.setItem("activeSessionId", s.id);
      window.dispatchEvent(new Event("session-changed"));
      await loadSessions();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await sessionApi.delete(id);
      setDeleteTarget(null);
      if (localStorage.getItem("activeSessionId") === id) {
        localStorage.removeItem("activeSessionId");
      }
      window.dispatchEvent(new Event("session-changed"));
      await loadSessions();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleModelSwitch(sessionId: string, model: string) {
    try {
      const updated = await sessionApi.update(sessionId, { model });
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch (err) {
      console.error(err);
    }
  }

  function openChat(id: string) {
    localStorage.setItem("activeSessionId", id);
    router.push("/chat");
  }

  // Find agent name for display
  const agentNames = new Map<string, string>();
  agents.forEach((a) => agentNames.set(a.id, a.name));

  if (loading) return <Spinner />;

  return (
    <>
      <PageTitle>Sessions</PageTitle>

      <div style={{ marginBottom: "var(--space-lg)" }}>
        <Button onClick={openCreateForm}>Neue Session</Button>
      </div>

      <Grid>
        {sessions.map((s) => (
          <SessionRow key={s.id}>
            <SessionInfo>
              {s.name && (
                <span style={{ fontWeight: 600 }}>{s.name}</span>
              )}
              <SessionMeta>
                <Badge variant="info">{agentNames.get(s.agentId) ?? s.agentId}</Badge>
                {modelIds.length > 0 ? (
                  <ModelSelect
                    models={modelIds}
                    currentModel={s.model}
                    onSelect={(m) => handleModelSwitch(s.id, m)}
                  />
                ) : (
                  <Badge variant="info">{s.model}</Badge>
                )}
                <span>{s.messages.length} Nachrichten</span>
                {s.activeMcpIds.length > 0 && (
                  <span>{s.activeMcpIds.length} MCPs</span>
                )}
              </SessionMeta>
              <SessionId>{s.id}</SessionId>
            </SessionInfo>
            <Actions>
              <Button size="sm" variant="secondary" onClick={() => openChat(s.id)}>
                Chat
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteTarget(s.id)}>
                Löschen
              </Button>
            </Actions>
          </SessionRow>
        ))}
        {sessions.length === 0 && (
          <p style={{ color: "var(--text-secondary)" }}>
            Noch keine Sessions. Erstelle eine neue Session.
          </p>
        )}
      </Grid>

      {showCreate && (
        <Modal title="Neue Session" onClose={() => setShowCreate(false)}>
          <FormGrid>
            <div>
              <label>Agent</label>
              <Select
                value={selectedAgent}
                onChange={(e) => handleAgentChange(e.target.value)}
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label>Model</label>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label>MCPs (vorausgewählt vom Agent)</label>
              {mcps.map((m) => (
                <CheckboxRow key={m.id}>
                  <input
                    type="checkbox"
                    checked={selectedMcps.has(m.id)}
                    onChange={() =>
                      setSelectedMcps((prev) => {
                        const next = new Set(prev);
                        next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                        return next;
                      })
                    }
                  />
                  {m.name}
                </CheckboxRow>
              ))}
            </div>
            <Button onClick={handleCreate} disabled={creating || !selectedAgent}>
              {creating ? <Spinner size={14} /> : "Erstellen"}
            </Button>
          </FormGrid>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Session löschen?" onClose={() => setDeleteTarget(null)}>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <Actions>
            <Button variant="danger" onClick={() => handleDelete(deleteTarget)}>
              Löschen
            </Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Abbrechen
            </Button>
          </Actions>
        </Modal>
      )}
    </>
  );
}
