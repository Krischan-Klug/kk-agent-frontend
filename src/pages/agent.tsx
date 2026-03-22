import { useEffect, useState } from "react";
import styled from "styled-components";
import { agent as agentApi, mcp as mcpApi } from "@/lib/api";
import type {
  AgentDefinition,
  CreateAgentBody,
  McpListItem,
} from "@/types/api";
import { REASONING_LEVELS } from "@/constants/reasoningDefaults";
import { PageTitle } from "@/components/Layout.styled";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import TextArea from "@/components/TextArea";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import Toggle from "@/components/Toggle";

/* ── Styled ── */

const PageLayout = styled.div`
  display: flex;
  gap: var(--space-lg);
  height: calc(100vh - 120px);
`;

const AgentList = styled.div`
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  overflow-y: auto;
`;

const AgentCard = styled.div<{ $active: boolean }>`
  padding: var(--space-md);
  background: ${(p) => (p.$active ? "var(--accent-muted)" : "var(--bg-elevated)")};
  border: 1px solid ${(p) => (p.$active ? "var(--accent)" : "var(--border)")};
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
  }
`;

const AgentName = styled.div`
  font-weight: 600;
  margin-bottom: 2px;
`;

const AgentDesc = styled.div`
  font-size: var(--font-size-sm);
  color: var(--text-muted);
`;

const AgentMeta = styled.div`
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
`;

const EditorArea = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
`;

const SectionTitle = styled.h3`
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
`;

const Row = styled.div`
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
`;

const FieldLabel = styled.label`
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: 2px;
  display: block;
`;

const Select = styled.select`
  padding: 6px 10px;
  background: var(--bg-elevated);
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

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;

  input {
    accent-color: var(--accent);
  }
`;

const McpInstructionRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
`;

const Actions = styled.div`
  display: flex;
  gap: var(--space-sm);
`;

/* ── Component ── */

export default function AgentPage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [mcps, setMcps] = useState<McpListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editAgent, setEditAgent] = useState<AgentDefinition | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([agentApi.list(), mcpApi.list()])
      .then(([a, m]) => {
        setAgents(a);
        setMcps(m);
        if (a.length > 0) {
          setSelectedId(a[0].id);
          setEditAgent(structuredClone(a[0]));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function selectAgent(id: string) {
    const ag = agents.find((a) => a.id === id);
    if (ag) {
      setSelectedId(id);
      setEditAgent(structuredClone(ag));
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const body: CreateAgentBody = {
        name: newName.trim(),
      };
      const created = await agentApi.create(body);
      setAgents((prev) => [...prev, created]);
      setSelectedId(created.id);
      setEditAgent(structuredClone(created));
      setShowCreate(false);
      setNewName("");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSave() {
    if (!editAgent || !selectedId) return;
    setSaving(true);
    try {
      const updated = await agentApi.update(selectedId, {
        name: editAgent.name,
        description: editAgent.description,
        systemPrompt: editAgent.systemPrompt,
        maxIterations: editAgent.maxIterations,
        mcpIds: editAgent.mcpIds,
        mcpInstructions: editAgent.mcpInstructions,
        variables: editAgent.variables,
        defaultModel: editAgent.defaultModel,
        reasoningEffort: editAgent.reasoningEffort,
        compactionPrompt: editAgent.compactionPrompt,
        compactionThreshold: editAgent.compactionThreshold,
      });
      setAgents((prev) => prev.map((a) => (a.id === selectedId ? updated : a)));
      setEditAgent(structuredClone(updated));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    try {
      await agentApi.delete(selectedId);
      const remaining = agents.filter((a) => a.id !== selectedId);
      setAgents(remaining);
      if (remaining.length > 0) {
        selectAgent(remaining[0].id);
      } else {
        setSelectedId(null);
        setEditAgent(null);
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageTitle>Agents</PageTitle>

      <PageLayout>
        {/* Agent List */}
        <AgentList>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Neuer Agent
          </Button>
          {agents.map((a) => (
            <AgentCard key={a.id} $active={a.id === selectedId} onClick={() => selectAgent(a.id)}>
              <AgentName>{a.name}</AgentName>
              {a.description && <AgentDesc>{a.description}</AgentDesc>}
              <AgentMeta>
                <Badge variant="info">{a.maxIterations} Iterationen</Badge>
                {a.mcpIds.length > 0 && <Badge variant="success">{a.mcpIds.length} MCPs</Badge>}
              </AgentMeta>
            </AgentCard>
          ))}
        </AgentList>

        {/* Editor Area */}
        {editAgent ? (
          <EditorArea>
            {/* Basic Info */}
            <Section>
              <SectionTitle>Agent Info</SectionTitle>
              <Row>
                <div style={{ flex: 1 }}>
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    value={editAgent.name}
                    onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <FieldLabel>Beschreibung</FieldLabel>
                  <Input
                    value={editAgent.description}
                    onChange={(e) => setEditAgent({ ...editAgent, description: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Reasoning Effort</FieldLabel>
                  <Select
                    value={editAgent.reasoningEffort ?? ""}
                    onChange={(e) =>
                      setEditAgent({
                        ...editAgent,
                        reasoningEffort: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">-- Default --</option>
                    {REASONING_LEVELS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </Select>
                </div>
              </Row>
            </Section>

            {/* Iteration */}
            <Section>
              <SectionTitle>Iteration</SectionTitle>
              <Row>
                <div>
                  <FieldLabel>Max Iterationen</FieldLabel>
                  <Input
                    type="number"
                    value={editAgent.maxIterations}
                    onChange={(e) =>
                      setEditAgent({
                        ...editAgent,
                        maxIterations: parseInt(e.target.value) || 10,
                      })
                    }
                    style={{ width: 80 }}
                  />
                </div>
                <div>
                  <FieldLabel>Compaction Threshold</FieldLabel>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <input
                      type="range"
                      min={50}
                      max={95}
                      step={5}
                      value={Math.round((editAgent.compactionThreshold ?? 0.8) * 100)}
                      onChange={(e) =>
                        setEditAgent({
                          ...editAgent,
                          compactionThreshold: parseInt(e.target.value) / 100,
                        })
                      }
                      style={{ width: 120, accentColor: "var(--accent)" }}
                    />
                    <span style={{ fontSize: "var(--font-size-sm)", fontFamily: "var(--font-mono)", minWidth: 36 }}>
                      {Math.round((editAgent.compactionThreshold ?? 0.8) * 100)}%
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1, paddingTop: 18 }}>
                  <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>
                    Der Agent iteriert (LLM → Tools → repeat) bis keine Tool-Calls mehr kommen oder das Limit erreicht ist. Bei {Math.round((editAgent.compactionThreshold ?? 0.8) * 100)}% Context-Auslastung wird der bisherige Verlauf komprimiert.
                  </span>
                </div>
              </Row>
            </Section>

            {/* System Prompt */}
            <Section>
              <SectionTitle>System Prompt</SectionTitle>
              <TextArea
                value={editAgent.systemPrompt}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, systemPrompt: e.target.value })
                }
                rows={15}
                placeholder="Der System-Prompt für diesen Agent..."
              />
            </Section>

            {/* MCP Configuration */}
            <Section>
              <SectionTitle>MCPs</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
                {mcps.map((m) => (
                  <CheckboxRow key={m.id}>
                    <input
                      type="checkbox"
                      checked={editAgent.mcpIds.includes(m.id)}
                      onChange={() => {
                        const newIds = editAgent.mcpIds.includes(m.id)
                          ? editAgent.mcpIds.filter((id) => id !== m.id)
                          : [...editAgent.mcpIds, m.id];
                        setEditAgent({ ...editAgent, mcpIds: newIds });
                      }}
                    />
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: m.running ? "var(--success)" : "var(--danger)",
                        flexShrink: 0,
                      }}
                    />
                    {m.name}
                    {!m.running && (
                      <span style={{ color: "var(--danger)", fontSize: "0.7rem" }}>(stopped)</span>
                    )}
                  </CheckboxRow>
                ))}
              </div>

              {/* Agent-specific MCP Instructions */}
              {editAgent.mcpIds.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  <FieldLabel>MCP Instructions</FieldLabel>
                  {editAgent.mcpIds.map((mcpId) => {
                    const mcpItem = mcps.find((m) => m.id === mcpId);
                    const isOverridden = mcpId in editAgent.mcpInstructions;
                    return (
                      <McpInstructionRow key={mcpId}>
                        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>
                            {mcpItem?.name ?? mcpId}
                          </span>
                          <Row style={{ alignItems: "center", gap: "var(--space-xs)" }}>
                            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>
                              Überschreiben
                            </span>
                            <Toggle
                              checked={isOverridden}
                              onChange={() => {
                                const newInstr = { ...editAgent.mcpInstructions };
                                if (isOverridden) {
                                  delete newInstr[mcpId];
                                } else {
                                  newInstr[mcpId] = "";
                                }
                                setEditAgent({ ...editAgent, mcpInstructions: newInstr });
                              }}
                            />
                          </Row>
                        </Row>
                        {isOverridden && (
                          <TextArea
                            value={editAgent.mcpInstructions[mcpId] ?? ""}
                            onChange={(e) =>
                              setEditAgent({
                                ...editAgent,
                                mcpInstructions: { ...editAgent.mcpInstructions, [mcpId]: e.target.value },
                              })
                            }
                            rows={2}
                            placeholder="Leer = MCP-Instruction komplett unterdrücken"
                          />
                        )}
                      </McpInstructionRow>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Variables */}
            <Section>
              <SectionTitle>Variablen</SectionTitle>
              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>
                System-Variablen: <code>{"{{CURRENT_DATE}}"}</code>, <code>{"{{CURRENT_TIME}}"}</code>, <code>{"{{iteration}}"}</code>, <code>{"{{maxIterations}}"}</code>
              </span>
              {Object.entries(editAgent.variables).map(([key, value]) => (
                <Row key={key} style={{ alignItems: "center" }}>
                  <Input
                    value={key}
                    onChange={(e) => {
                      const newVars = { ...editAgent.variables };
                      delete newVars[key];
                      newVars[e.target.value] = value;
                      setEditAgent({ ...editAgent, variables: newVars });
                    }}
                    placeholder="KEY"
                    style={{ width: 160, fontFamily: "var(--font-mono)", fontSize: "var(--font-size-sm)" }}
                  />
                  <Input
                    value={value}
                    onChange={(e) =>
                      setEditAgent({
                        ...editAgent,
                        variables: { ...editAgent.variables, [key]: e.target.value },
                      })
                    }
                    placeholder="Wert"
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      const newVars = { ...editAgent.variables };
                      delete newVars[key];
                      setEditAgent({ ...editAgent, variables: newVars });
                    }}
                  >
                    x
                  </Button>
                </Row>
              ))}
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setEditAgent({
                    ...editAgent,
                    variables: { ...editAgent.variables, [`VAR_${Object.keys(editAgent.variables).length + 1}`]: "" },
                  })
                }
              >
                + Variable
              </Button>
            </Section>

            {/* Compaction Prompt (opt-in) */}
            <Section>
              <SectionTitle>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editAgent.compactionPrompt != null}
                    onChange={(e) =>
                      setEditAgent({
                        ...editAgent,
                        compactionPrompt: e.target.checked ? "" : undefined,
                      })
                    }
                    style={{ accentColor: "var(--accent)" }}
                  />
                  Custom Compaction Prompt
                </label>
              </SectionTitle>
              {editAgent.compactionPrompt != null && (
                <div>
                  <TextArea
                    value={editAgent.compactionPrompt}
                    onChange={(e) => setEditAgent({ ...editAgent, compactionPrompt: e.target.value })}
                    rows={8}
                    placeholder="Überschreibt den Default-Compaction-Prompt für diesen Agent..."
                  />
                </div>
              )}
            </Section>

            {/* Actions */}
            <Actions>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={14} /> : "Speichern"}
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Agent löschen
              </Button>
            </Actions>
          </EditorArea>
        ) : (
          <EditorArea>
            <p style={{ color: "var(--text-secondary)" }}>Wähle einen Agent aus oder erstelle einen neuen.</p>
          </EditorArea>
        )}
      </PageLayout>

      {showCreate && (
        <Modal title="Neuer Agent" onClose={() => setShowCreate(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Coding Agent"
                autoFocus
              />
            </div>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              Erstellen
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
