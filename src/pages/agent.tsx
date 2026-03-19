import { useEffect, useState } from "react";
import styled from "styled-components";
import { agent as agentApi, mcp as mcpApi } from "@/lib/api";
import type {
  AgentDefinition,
  CreateAgentBody,
  LoopPhase,
  PhaseTransition,
  TransitionCondition,
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
import PhaseGraph from "@/components/PhaseGraph";
import LoopStateViewer from "@/components/LoopStateViewer";

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

const PhaseEditorPanel = styled.div`
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
`;

const TransitionRow = styled.div`
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-xs) 0;
  font-size: var(--font-size-sm);
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

/* ── Helpers ── */

function emptyPhase(name = "new-phase"): LoopPhase {
  return {
    name,
    description: "",
    maxIterations: 5,
    transitions: [],
    autoAdvance: true,
  };
}

function emptyTransition(phases: LoopPhase[], currentPhaseName: string): PhaseTransition {
  const other = phases.find((p) => p.name !== currentPhaseName);
  return {
    to: other?.name ?? "",
    condition: { type: "no_tool_calls" },
  };
}

const CONDITION_TYPES: { value: TransitionCondition["type"]; label: string }[] = [
  { value: "no_tool_calls", label: "No Tool Calls" },
  { value: "max_iterations", label: "Max Iterations" },
  { value: "tool_called", label: "Tool Called" },
  { value: "keyword", label: "Keyword" },
  { value: "always", label: "Always" },
];

/* ── Component ── */

export default function AgentPage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [mcps, setMcps] = useState<McpListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editAgent, setEditAgent] = useState<AgentDefinition | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
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
      setSelectedPhase(null);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const body: CreateAgentBody = {
        name: newName.trim(),
        description: "",
        loopStrategy: {
          initialPhase: "respond",
          maxTotalIterations: 10,
          phases: [emptyPhase("respond")],
        },
        promptTemplates: { base: "", phases: {} },
        mcpIds: [],
        mcpInstructions: {},
        variables: {},
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
        loopStrategy: editAgent.loopStrategy,
        promptTemplates: editAgent.promptTemplates,
        mcpIds: editAgent.mcpIds,
        mcpInstructions: editAgent.mcpInstructions,
        variables: editAgent.variables,
        defaultModel: editAgent.defaultModel,
        reasoningEffort: editAgent.reasoningEffort,
        compactionPrompt: editAgent.compactionPrompt,
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

  function updatePhase(name: string, update: Partial<LoopPhase>) {
    if (!editAgent) return;
    const phases = editAgent.loopStrategy.phases.map((p) =>
      p.name === name ? { ...p, ...update } : p,
    );
    setEditAgent({
      ...editAgent,
      loopStrategy: { ...editAgent.loopStrategy, phases },
    });
  }

  function addPhase() {
    if (!editAgent) return;
    const name = `phase-${editAgent.loopStrategy.phases.length + 1}`;
    setEditAgent({
      ...editAgent,
      loopStrategy: {
        ...editAgent.loopStrategy,
        phases: [...editAgent.loopStrategy.phases, emptyPhase(name)],
      },
    });
    setSelectedPhase(name);
  }

  function removePhase(name: string) {
    if (!editAgent) return;
    const phases = editAgent.loopStrategy.phases.filter((p) => p.name !== name);
    // Remove transitions pointing to this phase
    const cleaned = phases.map((p) => ({
      ...p,
      transitions: p.transitions.filter((t) => t.to !== name),
    }));
    const newInitial = editAgent.loopStrategy.initialPhase === name
      ? (cleaned[0]?.name ?? "")
      : editAgent.loopStrategy.initialPhase;
    setEditAgent({
      ...editAgent,
      loopStrategy: { ...editAgent.loopStrategy, phases: cleaned, initialPhase: newInitial },
    });
    if (selectedPhase === name) setSelectedPhase(null);
  }

  function addTransition(phaseName: string) {
    if (!editAgent) return;
    const phase = editAgent.loopStrategy.phases.find((p) => p.name === phaseName);
    if (!phase) return;
    updatePhase(phaseName, {
      transitions: [...phase.transitions, emptyTransition(editAgent.loopStrategy.phases, phaseName)],
    });
  }

  function updateTransition(phaseName: string, index: number, update: Partial<PhaseTransition>) {
    if (!editAgent) return;
    const phase = editAgent.loopStrategy.phases.find((p) => p.name === phaseName);
    if (!phase) return;
    const transitions = phase.transitions.map((t, i) => (i === index ? { ...t, ...update } : t));
    updatePhase(phaseName, { transitions });
  }

  function removeTransition(phaseName: string, index: number) {
    if (!editAgent) return;
    const phase = editAgent.loopStrategy.phases.find((p) => p.name === phaseName);
    if (!phase) return;
    updatePhase(phaseName, { transitions: phase.transitions.filter((_, i) => i !== index) });
  }

  function updateCondition(phaseName: string, tIndex: number, type: TransitionCondition["type"]) {
    let condition: TransitionCondition;
    switch (type) {
      case "tool_called": condition = { type: "tool_called", toolName: "" }; break;
      case "keyword": condition = { type: "keyword", keyword: "" }; break;
      default: condition = { type } as TransitionCondition;
    }
    updateTransition(phaseName, tIndex, { condition });
  }

  const activePhase = editAgent?.loopStrategy.phases.find((p) => p.name === selectedPhase);

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
                <Badge variant="info">{a.loopStrategy.phases.length} Phasen</Badge>
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
                System-Variablen sind automatisch verfügbar: <code>{"{{CURRENT_DATE}}"}</code>, <code>{"{{CURRENT_TIME}}"}</code>, <code>{"{{phase}}"}</code>, <code>{"{{iteration}}"}</code>, <code>{"{{maxIterations}}"}</code>
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

            {/* Prompt Templates */}
            <Section>
              <SectionTitle>Prompts</SectionTitle>
              <div>
                <FieldLabel>Base System Prompt</FieldLabel>
                <TextArea
                  value={editAgent.promptTemplates.base}
                  onChange={(e) =>
                    setEditAgent({
                      ...editAgent,
                      promptTemplates: { ...editAgent.promptTemplates, base: e.target.value },
                    })
                  }
                  rows={15}
                  placeholder="Der Basis-System-Prompt für diesen Agent..."
                />
              </div>
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

            {/* Loop Strategy */}
            <Section>
              <SectionTitle>Loop Strategy</SectionTitle>
              <Row>
                <div>
                  <FieldLabel>Max Total Iterations</FieldLabel>
                  <Input
                    type="number"
                    value={editAgent.loopStrategy.maxTotalIterations}
                    onChange={(e) =>
                      setEditAgent({
                        ...editAgent,
                        loopStrategy: {
                          ...editAgent.loopStrategy,
                          maxTotalIterations: parseInt(e.target.value) || 10,
                        },
                      })
                    }
                    style={{ width: 80 }}
                  />
                </div>
                <div>
                  <FieldLabel>Initial Phase</FieldLabel>
                  <Select
                    value={editAgent.loopStrategy.initialPhase}
                    onChange={(e) =>
                      setEditAgent({
                        ...editAgent,
                        loopStrategy: { ...editAgent.loopStrategy, initialPhase: e.target.value },
                      })
                    }
                  >
                    {editAgent.loopStrategy.phases.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div style={{ marginTop: 18 }}>
                  <Button size="sm" onClick={addPhase}>
                    Phase hinzufügen
                  </Button>
                </div>
              </Row>

              {/* Phase Graph */}
              <PhaseGraph
                phases={editAgent.loopStrategy.phases}
                initialPhase={editAgent.loopStrategy.initialPhase}
                selectedPhase={selectedPhase}
                onSelectPhase={setSelectedPhase}
              />

              {/* Selected Phase Editor */}
              {activePhase && (
                <PhaseEditorPanel>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
                    <SectionTitle>Phase: {activePhase.name}</SectionTitle>
                    <Button size="sm" variant="danger" onClick={() => removePhase(activePhase.name)}>
                      Entfernen
                    </Button>
                  </div>
                  <Row>
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <Input
                        value={activePhase.name}
                        onChange={(e) => {
                          const oldName = activePhase.name;
                          const newName = e.target.value;
                          // Rename in transitions
                          const phases = editAgent.loopStrategy.phases.map((p) => {
                            const renamed = p.name === oldName ? { ...p, name: newName } : p;
                            return {
                              ...renamed,
                              transitions: renamed.transitions.map((t) =>
                                t.to === oldName ? { ...t, to: newName } : t,
                              ),
                            };
                          });
                          const newInitial = editAgent.loopStrategy.initialPhase === oldName ? newName : editAgent.loopStrategy.initialPhase;
                          setEditAgent({
                            ...editAgent,
                            loopStrategy: { ...editAgent.loopStrategy, phases, initialPhase: newInitial },
                            promptTemplates: {
                              ...editAgent.promptTemplates,
                              phases: Object.fromEntries(
                                Object.entries(editAgent.promptTemplates.phases).map(([k, v]) =>
                                  [k === oldName ? newName : k, v],
                                ),
                              ),
                            },
                          });
                          setSelectedPhase(newName);
                        }}
                        style={{ width: 120 }}
                      />
                    </div>
                    <div>
                      <FieldLabel>Max Iterations</FieldLabel>
                      <Input
                        type="number"
                        value={activePhase.maxIterations}
                        onChange={(e) => updatePhase(activePhase.name, { maxIterations: parseInt(e.target.value) || 5 })}
                        style={{ width: 80 }}
                      />
                    </div>
                    <div>
                      <FieldLabel>Auto Advance</FieldLabel>
                      <Toggle
                        checked={activePhase.autoAdvance}
                        onChange={() => updatePhase(activePhase.name, { autoAdvance: !activePhase.autoAdvance })}
                      />
                    </div>
                  </Row>
                  {/* Transitions */}
                  <div style={{ marginTop: "var(--space-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <FieldLabel>Transitions</FieldLabel>
                      <Button size="sm" variant="secondary" onClick={() => addTransition(activePhase.name)}>
                        + Transition
                      </Button>
                    </div>
                    {activePhase.transitions.map((t, ti) => (
                      <TransitionRow key={ti}>
                        <Select
                          value={t.condition.type}
                          onChange={(e) => updateCondition(activePhase.name, ti, e.target.value as TransitionCondition["type"])}
                        >
                          {CONDITION_TYPES.map((ct) => (
                            <option key={ct.value} value={ct.value}>
                              {ct.label}
                            </option>
                          ))}
                        </Select>
                        {t.condition.type === "tool_called" && (
                          <Select
                            value={(t.condition as { toolName: string }).toolName}
                            onChange={(e) => updateTransition(activePhase.name, ti, { condition: { type: "tool_called", toolName: e.target.value } })}
                          >
                            <option value="">-- Tool --</option>
                            {mcps
                              .filter((m) => editAgent.mcpIds.includes(m.id))
                              .flatMap((m) => m.tools)
                              .map((tool) => (
                                <option key={tool.name} value={tool.name}>{tool.name}</option>
                              ))}
                          </Select>
                        )}
                        {t.condition.type === "keyword" && (
                          <Input
                            value={(t.condition as { keyword: string }).keyword}
                            onChange={(e) => updateTransition(activePhase.name, ti, { condition: { type: "keyword", keyword: e.target.value } })}
                            placeholder="Keyword"
                            style={{ width: 120 }}
                          />
                        )}
                        <span style={{ color: "var(--text-muted)" }}>→</span>
                        <Select
                          value={t.to}
                          onChange={(e) => updateTransition(activePhase.name, ti, { to: e.target.value })}
                        >
                          <option value="">-- Ziel --</option>
                          {editAgent.loopStrategy.phases
                            .filter((p) => p.name !== activePhase.name)
                            .map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                        </Select>
                        <Button size="sm" variant="danger" onClick={() => removeTransition(activePhase.name, ti)}>
                          x
                        </Button>
                      </TransitionRow>
                    ))}
                    {activePhase.transitions.length === 0 && (
                      <span style={{ color: "var(--text-muted)", fontSize: "var(--font-size-sm)" }}>
                        Keine Transitions (Phase endet wenn LLM fertig ist)
                      </span>
                    )}
                  </div>

                  {/* Phase Prompt */}
                  <div style={{ marginTop: "var(--space-md)" }}>
                    <FieldLabel>Prompt-Erweiterung</FieldLabel>
                    <TextArea
                      value={editAgent.promptTemplates.phases[activePhase.name] ?? ""}
                      onChange={(e) =>
                        setEditAgent({
                          ...editAgent,
                          promptTemplates: {
                            ...editAgent.promptTemplates,
                            phases: { ...editAgent.promptTemplates.phases, [activePhase.name]: e.target.value },
                          },
                        })
                      }
                      rows={15}
                      placeholder={`Phasen-spezifische Prompt-Erweiterung für "${activePhase.name}"...`}
                    />
                  </div>
                </PhaseEditorPanel>
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

            {/* Live Loop Viewer */}
            <LoopStateViewer
              agentId={editAgent.id}
              phases={editAgent.loopStrategy.phases}
            />
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
