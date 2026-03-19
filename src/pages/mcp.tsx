import { useEffect, useState } from "react";
import styled from "styled-components";
import { mcp as mcpApi } from "@/lib/api";
import type { McpListItem, CreateMcpBody } from "@/types/api";
import { PageTitle } from "@/components/Layout.styled";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import TextArea from "@/components/TextArea";
import Spinner from "@/components/Spinner";
import Modal from "@/components/Modal";

const Grid = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
`;

const McpHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
`;

const McpName = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: 600;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
`;

const ToolList = styled.div`
  margin-top: var(--space-md);
`;

const ToolItem = styled.div`
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-xs);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);

  span {
    color: var(--text-secondary);
    font-family: var(--font-sans);
    margin-left: var(--space-sm);
  }
`;

const SectionRow = styled.div`
  margin-top: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-sm);

  label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
`;

const EditSection = styled.div`
  margin-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
`;

const Input = styled.input`
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

const TransportTabs = styled.div`
  display: flex;
  gap: var(--space-xs);
`;

const TransportTab = styled.button<{ $active?: boolean }>`
  padding: 6px 16px;
  border: 1px solid ${(p) => (p.$active ? "var(--accent)" : "var(--border)")};
  background: ${(p) => (p.$active ? "var(--accent-muted)" : "var(--bg-elevated)")};
  color: ${(p) => (p.$active ? "var(--accent)" : "var(--text-secondary)")};
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-family: inherit;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--accent);
  }
`;

const Actions = styled.div`
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
`;

const ConfigDetail = styled.div`
  margin-top: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
`;

export default function McpPage() {
  const [mcps, setMcps] = useState<McpListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedInstructions, setExpandedInstructions] = useState<Set<string>>(new Set());
  const [expandedEdit, setExpandedEdit] = useState<Set<string>>(new Set());
  const [editForms, setEditForms] = useState<
    Record<string, { name: string; command: string; args: string; url: string }>
  >({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateMcpBody>({
    name: "",
    transport: "stdio",
    command: "",
    args: [],
    url: "",
    instruction: "",
  });
  const [creating, setCreating] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadMcps();
  }, []);

  async function loadMcps() {
    try {
      const data = await mcpApi.list();
      setMcps(data);
      const instMap: Record<string, string> = {};
      data.forEach((m) => (instMap[m.id] = m.instruction));
      setInstructions(instMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartStop(id: string, running: boolean) {
    try {
      if (running) {
        await mcpApi.stop(id);
      } else {
        await mcpApi.start(id);
      }
      await loadMcps();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveInstruction(id: string) {
    try {
      await mcpApi.setInstruction(id, instructions[id]);
      await loadMcps();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      await mcpApi.create({
        name: createForm.name,
        transport: createForm.transport,
        command: createForm.transport === "stdio" ? createForm.command : undefined,
        args:
          createForm.transport === "stdio" && createForm.args?.length
            ? createForm.args
            : undefined,
        url: createForm.transport === "sse" ? createForm.url : undefined,
        instruction: createForm.instruction || undefined,
      });
      setShowCreate(false);
      setCreateForm({ name: "", transport: "stdio", command: "", args: [], url: "", instruction: "" });
      await loadMcps();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await mcpApi.remove(id);
      setDeleteTarget(null);
      await loadMcps();
    } catch (err) {
      console.error(err);
    }
  }

  function openEdit(m: McpListItem) {
    const server = m.server as { command?: string; args?: string[]; url?: string };
    setEditForms((prev) => ({
      ...prev,
      [m.id]: {
        name: m.name,
        command: server.command ?? "",
        args: (server.args ?? []).join("\n"),
        url: server.url ?? "",
      },
    }));
    setExpandedEdit((prev) => {
      const next = new Set(prev);
      next.add(m.id);
      return next;
    });
  }

  async function handleSaveEdit(id: string, transport: string) {
    const form = editForms[id];
    if (!form) return;
    try {
      await mcpApi.update(id, {
        name: form.name,
        ...(transport === "stdio"
          ? { command: form.command, args: form.args.split("\n").filter(Boolean) }
          : { url: form.url }),
      });
      setExpandedEdit((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadMcps();
    } catch (err) {
      console.error(err);
    }
  }

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageTitle>MCP Server</PageTitle>

      <div style={{ marginBottom: "var(--space-lg)" }}>
        <Button onClick={() => setShowCreate(true)}>MCP hinzufügen</Button>
      </div>

      <Grid>
        {mcps.map((m) => (
          <Card key={m.id}>
            <McpHeader>
              <McpName>
                {m.name}
                <Badge variant={m.running ? "success" : "danger"}>
                  {m.running ? "running" : "stopped"}
                </Badge>
                <Badge>{m.transport}</Badge>
              </McpName>
              <Controls>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleStartStop(m.id, m.running)}
                >
                  {m.running ? "Stop" : "Start"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    expandedEdit.has(m.id)
                      ? toggleSet(setExpandedEdit, m.id)
                      : openEdit(m)
                  }
                >
                  {expandedEdit.has(m.id) ? "Schließen" : "Bearbeiten"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setDeleteTarget(m.id)}
                >
                  Löschen
                </Button>
              </Controls>
            </McpHeader>

            {/* Config display */}
            {!expandedEdit.has(m.id) && (
              <ConfigDetail>
                {m.transport === "stdio"
                  ? `${(m.server as { command: string }).command} ${((m.server as { args: string[] }).args ?? []).join(" ")}`
                  : (m.server as { url: string }).url}
              </ConfigDetail>
            )}

            {/* Edit section */}
            {expandedEdit.has(m.id) && editForms[m.id] && (
              <EditSection>
                <div>
                  <label>Name</label>
                  <Input
                    value={editForms[m.id].name}
                    onChange={(e) =>
                      setEditForms((prev) => ({
                        ...prev,
                        [m.id]: { ...prev[m.id], name: e.target.value },
                      }))
                    }
                  />
                </div>
                {m.transport === "stdio" ? (
                  <>
                    <div>
                      <label>Command</label>
                      <Input
                        value={editForms[m.id].command}
                        onChange={(e) =>
                          setEditForms((prev) => ({
                            ...prev,
                            [m.id]: { ...prev[m.id], command: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label>Args (ein Argument pro Zeile)</label>
                      <TextArea
                        value={editForms[m.id].args}
                        onChange={(e) =>
                          setEditForms((prev) => ({
                            ...prev,
                            [m.id]: { ...prev[m.id], args: e.target.value },
                          }))
                        }
                        rows={4}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label>URL</label>
                    <Input
                      value={editForms[m.id].url}
                      onChange={(e) =>
                        setEditForms((prev) => ({
                          ...prev,
                          [m.id]: { ...prev[m.id], url: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
                <Actions>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(m.id, m.transport)}
                  >
                    Speichern
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleSet(setExpandedEdit, m.id)}
                  >
                    Abbrechen
                  </Button>
                </Actions>
              </EditSection>
            )}

            {/* Instruction + Tools */}
            <SectionRow>
              <label>Instruction</label>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toggleSet(setExpandedInstructions, m.id)}
              >
                {expandedInstructions.has(m.id) ? "Schließen" : "Bearbeiten"}
              </Button>
              {expandedInstructions.has(m.id) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSaveInstruction(m.id)}
                >
                  Speichern
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => toggleSet(setExpandedTools, m.id)}>
                {expandedTools.has(m.id) ? "Tools verbergen" : `Tools (${m.tools.length})`}
              </Button>
            </SectionRow>
            {expandedInstructions.has(m.id) && (
              <TextArea
                value={instructions[m.id] ?? ""}
                onChange={(e) =>
                  setInstructions((prev) => ({ ...prev, [m.id]: e.target.value }))
                }
                rows={14}
                style={{ marginTop: "var(--space-sm)" }}
              />
            )}
            {expandedTools.has(m.id) && (
              <ToolList>
                {m.tools.map((t) => (
                  <ToolItem key={t.name}>
                    {t.name}
                    <span>{t.description}</span>
                  </ToolItem>
                ))}
              </ToolList>
            )}
          </Card>
        ))}
        {mcps.length === 0 && (
          <p style={{ color: "var(--text-secondary)" }}>
            Keine MCP Server konfiguriert.
          </p>
        )}
      </Grid>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="MCP Server hinzufügen" onClose={() => setShowCreate(false)}>
          <FormGrid>
            <div>
              <label>Name</label>
              <Input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="z.B. Filesystem"
              />
            </div>
            <div>
              <label>Transport</label>
              <TransportTabs>
                <TransportTab
                  $active={createForm.transport === "stdio"}
                  onClick={() =>
                    setCreateForm((prev) => ({ ...prev, transport: "stdio" }))
                  }
                >
                  stdio
                </TransportTab>
                <TransportTab
                  $active={createForm.transport === "sse"}
                  onClick={() =>
                    setCreateForm((prev) => ({ ...prev, transport: "sse" }))
                  }
                >
                  sse
                </TransportTab>
              </TransportTabs>
            </div>
            {createForm.transport === "stdio" ? (
              <>
                <div>
                  <label>Command</label>
                  <Input
                    value={createForm.command ?? ""}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, command: e.target.value }))
                    }
                    placeholder="z.B. npx"
                  />
                </div>
                <div>
                  <label>Args (ein Argument pro Zeile)</label>
                  <TextArea
                    value={(createForm.args ?? []).join("\n")}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        args: e.target.value.split("\n").filter(Boolean),
                      }))
                    }
                    rows={4}
                    placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/path/to/dir"}
                  />
                </div>
              </>
            ) : (
              <div>
                <label>URL</label>
                <Input
                  value={createForm.url ?? ""}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="http://localhost:3002/sse"
                />
              </div>
            )}
            <div>
              <label>Instruction (optional)</label>
              <TextArea
                value={createForm.instruction ?? ""}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, instruction: e.target.value }))
                }
                rows={4}
                placeholder="System-Instruction für diesen MCP..."
              />
            </div>
            <Button onClick={handleCreate} disabled={creating || !createForm.name}>
              {creating ? <Spinner size={14} /> : "Erstellen"}
            </Button>
          </FormGrid>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Modal title="MCP löschen?" onClose={() => setDeleteTarget(null)}>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
            Der MCP Server wird gestoppt und entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
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
