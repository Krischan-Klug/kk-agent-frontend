import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { provider as providerApi } from "@/lib/api";
import type {
  ProviderConfig,
  ProviderType,
  EndpointType,
  AuthMethod,
  ModelInfo,
  ModelSettings,
  ReasoningLevelConfig,
} from "@/types/api";
import { REASONING_LEVELS, REASONING_LEVEL_DEFAULTS } from "@/constants/reasoningDefaults";
import { PageTitle } from "@/components/Layout.styled";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import Badge from "@/components/Badge";

/* ── Constants ── */

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: "lmstudio", label: "LM Studio" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

const ENDPOINT_OPTIONS: { value: EndpointType; label: string }[] = [
  { value: "chat-completions", label: "/v1/chat/completions" },
  { value: "responses", label: "/v1/responses" },
  { value: "completions", label: "/v1/completions" },
  { value: "embeddings", label: "/v1/embeddings" },
];

const AUTH_OPTIONS: Record<ProviderType, { value: AuthMethod; label: string }[]> = {
  lmstudio: [{ value: "none", label: "Keine" }],
  openai: [
    { value: "api-key", label: "API Key" },
    { value: "session-token", label: "Session Token" },
  ],
  anthropic: [{ value: "api-key", label: "API Key" }],
};

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  lmstudio: "http://localhost:1234",
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
};

/* ── Styled ── */

const Grid = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
`;

const ActiveProviderWrapper = styled.div<{ $active: boolean }>`
  background: var(--bg-elevated);
  border: 1px solid ${(p) => (p.$active ? "var(--accent)" : "var(--border)")};
  border-radius: var(--radius-md);
  padding: var(--space-lg);
`;

const ProviderHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  cursor: pointer;
`;

const ProviderName = styled.div`
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
`;

const ProviderMeta = styled.span`
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  font-family: var(--font-mono);
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
`;

const ExpandedContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-md);
  border-top: 1px solid var(--border);
  padding-top: var(--space-md);
`;

const FormRow = styled.div`
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  flex-wrap: wrap;
`;

const FormField = styled.div<{ $flex?: number }>`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: ${(p) => p.$flex ?? "unset"};
  min-width: 150px;
`;

const Label = styled.label`
  font-size: var(--font-size-sm);
  color: var(--text-muted);
`;

const Select = styled.select`
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;

  &:focus {
    border-color: var(--border-focus);
    outline: none;
  }
`;

const Hint = styled.div`
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  margin-top: 2px;
`;

const TestResult = styled.span<{ $ok: boolean }>`
  font-size: var(--font-size-sm);
  color: ${(p) => (p.$ok ? "var(--success)" : "var(--danger)")};
`;

const SectionDivider = styled.div`
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-top: var(--space-sm);
`;

/* ── Model Settings Grid (reused from old page) ── */

const LevelGrid = styled.div`
  display: grid;
  grid-template-columns: 90px 1fr 1fr;
  margin-top: var(--space-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow: hidden;
  font-size: var(--font-size-sm);
`;

const LevelHeaderCell = styled.div`
  padding: var(--space-xs) var(--space-sm);
  font-weight: 600;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
`;

const UnitHint = styled.span`
  color: var(--text-muted);
  font-weight: 400;
  font-size: 0.7rem;
  margin-left: var(--space-xs);
  opacity: 0.7;
`;

const LevelCell = styled.div<{ $isDefault?: boolean; $isLast?: boolean }>`
  padding: var(--space-xs) var(--space-sm);
  display: flex;
  align-items: center;
  background: ${(p) => (p.$isDefault ? "var(--accent-muted)" : "var(--bg-base)")};
  border-bottom: ${(p) => (p.$isLast ? "none" : "1px solid var(--border)")};
`;

const LevelLabelCell = styled(LevelCell)`
  font-weight: 600;
  color: ${(p) => (p.$isDefault ? "var(--accent)" : "var(--text-secondary)")};
  gap: var(--space-xs);
  font-family: var(--font-mono);
`;

const DefaultDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
`;

const SmallInput = styled.input<{ $isDefault?: boolean }>`
  background: ${(p) => (p.$isDefault ? "rgba(108, 138, 255, 0.08)" : "var(--bg-elevated)")};
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  padding: 2px 6px;
  width: 100%;
  font-family: var(--font-mono);

  &::placeholder {
    color: var(--text-muted);
    font-style: italic;
  }
  &:focus {
    border-color: var(--border-focus);
    outline: none;
  }
`;

const SettingsRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
`;

const SettingsToggle = styled.button`
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 2px var(--space-xs);
  opacity: 0.7;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
    color: var(--text-primary);
  }
`;

const ModelName = styled.div`
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
`;

const ContextInfo = styled.span`
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  font-family: var(--font-mono);
`;

const ModelCard = styled.div`
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
`;

const ModelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
`;

/* ── Page ── */

export default function ProviderPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettings>>({});
  const [activeProviderId, setActiveProviderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [testing, setTesting] = useState<Set<string>>(new Set());

  // Create form state
  const [newType, setNewType] = useState<ProviderType>("lmstudio");
  const [newName, setNewName] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState(DEFAULT_BASE_URLS.lmstudio);
  const [newAuth, setNewAuth] = useState<AuthMethod>("none");
  const [newApiKey, setNewApiKey] = useState("");
  const [newSessionToken, setNewSessionToken] = useState("");
  const [newEndpoint, setNewEndpoint] = useState<EndpointType>("chat-completions");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [providerList, modelsData] = await Promise.all([
        providerApi.listProviders(),
        providerApi.getModels(),
      ]);
      setProviders(providerList);
      setModels(modelsData.models);
      setModelSettings(modelsData.modelSettings ?? {});
      setActiveProviderId(modelsData.activeProviderId ?? "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const created = await providerApi.addProvider({
        name: newName.trim(),
        type: newType,
        baseUrl: newBaseUrl,
        authMethod: newAuth,
        apiKey: newAuth === "api-key" ? newApiKey : undefined,
        sessionToken: newAuth === "session-token" ? newSessionToken : undefined,
        endpoint: newEndpoint,
      });
      setProviders((prev) => [...prev, created]);
      setShowCreate(false);
      resetCreateForm();
    } catch (err) {
      console.error(err);
    }
  }

  function resetCreateForm() {
    setNewType("lmstudio");
    setNewName("");
    setNewBaseUrl(DEFAULT_BASE_URLS.lmstudio);
    setNewAuth("none");
    setNewApiKey("");
    setNewSessionToken("");
    setNewEndpoint("chat-completions");
  }

  async function handleActivate(id: string) {
    try {
      const result = await providerApi.activateProvider(id);
      setActiveProviderId(result.activeProviderId);
      // Reload models for new provider
      const modelsData = await providerApi.getModels();
      setModels(modelsData.models);
      setModelSettings(modelsData.modelSettings ?? {});
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await providerApi.removeProvider(id);
      setProviders((prev) => prev.filter((p) => p.id !== id));
      if (activeProviderId === id) {
        const modelsData = await providerApi.getModels();
        setActiveProviderId(modelsData.activeProviderId ?? "");
        setModels(modelsData.models);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTest(id: string) {
    setTesting((prev) => new Set(prev).add(id));
    try {
      const result = await providerApi.testProvider(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: (err as Error).message } }));
    } finally {
      setTesting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleProviderFieldChange(id: string, field: string, value: string) {
    try {
      const updated = await providerApi.updateProvider(id, { [field]: value });
      setProviders((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleModelSettingsSave(modelId: string, newSettings: ModelSettings) {
    setModelSettings((prev) => ({ ...prev, [modelId]: newSettings }));
    try {
      await providerApi.setModelSettings(modelId, newSettings);
    } catch (err) {
      console.error(err);
    }
  }

  function handleDefaultChange(modelId: string, value: string) {
    const settings = modelSettings[modelId] ?? {};
    handleModelSettingsSave(modelId, { ...settings, reasoningEffort: value || undefined });
  }

  function handleLevelChange(modelId: string, level: string, field: keyof ReasoningLevelConfig, value: string) {
    const settings = modelSettings[modelId] ?? {};
    const levels = { ...settings.levels };
    const levelConfig = { ...levels[level] };

    const numVal = value === "" ? undefined : Number(value);
    levelConfig[field] = numVal;

    if (levelConfig.temperature === undefined && levelConfig.maxOutputTokens === undefined) {
      delete levels[level];
    } else {
      levels[level] = levelConfig;
    }

    handleModelSettingsSave(modelId, { ...settings, levels: Object.keys(levels).length > 0 ? levels : undefined });
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageTitle>Provider</PageTitle>

      <div style={{ marginBottom: "var(--space-md)" }}>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          + Provider hinzufügen
        </Button>
      </div>

      <Grid>
        {providers.length === 0 ? (
          <Card>
            <span style={{ color: "var(--text-muted)" }}>
              Keine Provider konfiguriert. Füge einen hinzu.
            </span>
          </Card>
        ) : (
          providers.map((p) => {
            const isActive = p.id === activeProviderId;
            const isExpanded = expanded.has(p.id);
            const test = testResults[p.id];
            const isTesting = testing.has(p.id);

            return (
              <ActiveProviderWrapper key={p.id} $active={isActive}>
                <ProviderHeader onClick={() => toggleExpand(p.id)}>
                  <ProviderName>
                    {isActive && <Badge variant="info">aktiv</Badge>}
                    {p.name}
                    <ProviderMeta>
                      {p.type} · {p.baseUrl}
                    </ProviderMeta>
                  </ProviderName>
                  <HeaderActions>
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); handleActivate(p.id); }}
                      >
                        Aktivieren
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); handleTest(p.id); }}
                      disabled={isTesting}
                    >
                      {isTesting ? <Spinner size={12} /> : "Testen"}
                    </Button>
                    {test && (
                      <TestResult $ok={test.ok}>
                        {test.ok ? "✓ OK" : `✗ ${test.error ?? "Fehler"}`}
                      </TestResult>
                    )}
                    <span style={{ color: "var(--text-muted)", fontSize: "var(--font-size-sm)" }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </HeaderActions>
                </ProviderHeader>

                {isExpanded && (
                  <ExpandedContent>
                    {/* Provider Settings */}
                    <FormRow>
                      <FormField>
                        <Label>Name</Label>
                        <Input
                          value={p.name}
                          onChange={(e) => handleProviderFieldChange(p.id, "name", e.target.value)}
                        />
                      </FormField>
                      <FormField>
                        <Label>Typ</Label>
                        <Select
                          value={p.type}
                          onChange={(e) => handleProviderFieldChange(p.id, "type", e.target.value)}
                        >
                          {PROVIDER_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField $flex={1}>
                        <Label>Base URL</Label>
                        <Input
                          value={p.baseUrl}
                          onChange={(e) => handleProviderFieldChange(p.id, "baseUrl", e.target.value)}
                        />
                      </FormField>
                      <FormField>
                        <Label>Endpoint</Label>
                        <Select
                          value={p.endpoint}
                          onChange={(e) => handleProviderFieldChange(p.id, "endpoint", e.target.value)}
                        >
                          {ENDPOINT_OPTIONS.map((ep) => (
                            <option key={ep.value} value={ep.value}>{ep.label}</option>
                          ))}
                        </Select>
                      </FormField>
                    </FormRow>

                    {/* Auth */}
                    {p.type !== "lmstudio" && (
                      <FormRow>
                        <FormField>
                          <Label>Auth</Label>
                          <Select
                            value={p.authMethod}
                            onChange={(e) => handleProviderFieldChange(p.id, "authMethod", e.target.value)}
                          >
                            {(AUTH_OPTIONS[p.type] ?? []).map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </Select>
                        </FormField>
                        {p.authMethod === "api-key" && (
                          <FormField $flex={1}>
                            <Label>API Key</Label>
                            <Input
                              type="password"
                              value={p.apiKey ?? ""}
                              onChange={(e) => handleProviderFieldChange(p.id, "apiKey", e.target.value)}
                              placeholder="sk-..."
                            />
                          </FormField>
                        )}
                        {p.authMethod === "session-token" && (
                          <FormField $flex={1}>
                            <Label>Session Token</Label>
                            <Input
                              type="password"
                              value={p.sessionToken ?? ""}
                              onChange={(e) => handleProviderFieldChange(p.id, "sessionToken", e.target.value)}
                              placeholder="__Secure-next-auth.session-token Wert"
                            />
                            <Hint>
                              Browser → DevTools → Application → Cookies → chat.openai.com →
                              __Secure-next-auth.session-token
                            </Hint>
                          </FormField>
                        )}
                      </FormRow>
                    )}

                    {/* Models (only for active provider) */}
                    {isActive && (
                      <>
                        <SectionDivider>Modelle</SectionDivider>
                        {models.length === 0 ? (
                          <span style={{ color: "var(--text-muted)", fontSize: "var(--font-size-sm)" }}>
                            Keine Modelle verfügbar. Ist der Provider gestartet?
                          </span>
                        ) : (
                          models.map((m) => {
                            const settings = modelSettings[m.id] ?? {};
                            return (
                              <ModelCard key={m.id}>
                                <ModelHeader>
                                  <ModelName>
                                    {m.id}
                                    {m.maxContextLength && (
                                      <ContextInfo>
                                        ctx: {m.contextLength ? `${m.contextLength.toLocaleString()} / ` : ""}
                                        {m.maxContextLength.toLocaleString()}
                                      </ContextInfo>
                                    )}
                                  </ModelName>
                                  <SettingsRow>
                                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", fontSize: "var(--font-size-sm)", color: "var(--text-muted)", cursor: "pointer" }}>
                                      <input
                                        type="checkbox"
                                        checked={settings.reasoningOnOff ?? false}
                                        onChange={(e) => handleModelSettingsSave(m.id, { ...settings, reasoningOnOff: e.target.checked || undefined })}
                                        style={{ accentColor: "var(--accent)" }}
                                      />
                                      🧠 On/Off-Mapping
                                    </label>
                                    <Label>Default:</Label>
                                    <Select
                                      value={settings.reasoningEffort ?? ""}
                                      onChange={(e) => handleDefaultChange(m.id, e.target.value)}
                                    >
                                      <option value="">--</option>
                                      {REASONING_LEVELS.map((l) => (
                                        <option key={l} value={l}>{l}</option>
                                      ))}
                                    </Select>
                                    <SettingsToggle
                                      onClick={() =>
                                        setExpandedModels((prev) => {
                                          const next = new Set(prev);
                                          next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                                          return next;
                                        })
                                      }
                                    >
                                      {expandedModels.has(m.id) ? "▲ Settings" : "▼ Settings"}
                                    </SettingsToggle>
                                  </SettingsRow>
                                </ModelHeader>

                                {expandedModels.has(m.id) && (
                                  <LevelGrid>
                                    <LevelHeaderCell>Level</LevelHeaderCell>
                                    <LevelHeaderCell>Temperature<UnitHint>0–2</UnitHint></LevelHeaderCell>
                                    <LevelHeaderCell>Max Output<UnitHint>tokens</UnitHint></LevelHeaderCell>
                                    {REASONING_LEVELS.map((level, i) => {
                                      const lc = settings.levels?.[level] ?? {};
                                      const isDefault = level === settings.reasoningEffort;
                                      const isLast = i === REASONING_LEVELS.length - 1;
                                      const defaults = REASONING_LEVEL_DEFAULTS[level];
                                      return (
                                        <React.Fragment key={level}>
                                          <LevelLabelCell $isDefault={isDefault} $isLast={isLast}>
                                            {isDefault && <DefaultDot />}
                                            {level}
                                          </LevelLabelCell>
                                          <LevelCell $isDefault={isDefault} $isLast={isLast}>
                                            <SmallInput
                                              type="number"
                                              min="0"
                                              max="2"
                                              step="0.1"
                                              $isDefault={isDefault}
                                              placeholder={defaults?.temperature?.toString() ?? "auto"}
                                              value={lc.temperature ?? ""}
                                              onChange={(e) => handleLevelChange(m.id, level, "temperature", e.target.value)}
                                            />
                                          </LevelCell>
                                          <LevelCell $isDefault={isDefault} $isLast={isLast}>
                                            <SmallInput
                                              type="number"
                                              min="-1"
                                              step="1024"
                                              $isDefault={isDefault}
                                              placeholder={
                                                defaults?.maxOutputTokens != null
                                                  ? defaults.maxOutputTokens === -1
                                                    ? "unlimited"
                                                    : defaults.maxOutputTokens.toString()
                                                  : "auto"
                                              }
                                              value={lc.maxOutputTokens ?? ""}
                                              onChange={(e) => handleLevelChange(m.id, level, "maxOutputTokens", e.target.value)}
                                            />
                                          </LevelCell>
                                        </React.Fragment>
                                      );
                                    })}
                                  </LevelGrid>
                                )}
                              </ModelCard>
                            );
                          })
                        )}
                      </>
                    )}

                    {/* Delete */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(p.id)}
                      >
                        Provider löschen
                      </Button>
                    </div>
                  </ExpandedContent>
                )}
              </ActiveProviderWrapper>
            );
          })
        )}
      </Grid>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Neuer Provider" onClose={() => { setShowCreate(false); resetCreateForm(); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <FormField>
              <Label>Typ</Label>
              <Select
                value={newType}
                onChange={(e) => {
                  const type = e.target.value as ProviderType;
                  setNewType(type);
                  setNewBaseUrl(DEFAULT_BASE_URLS[type]);
                  setNewAuth(AUTH_OPTIONS[type][0].value);
                  setNewName(PROVIDER_TYPES.find((t) => t.value === type)?.label ?? "");
                }}
              >
                {PROVIDER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </FormField>

            <FormField>
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Mein LM Studio"
                autoFocus
              />
            </FormField>

            <FormField>
              <Label>Base URL</Label>
              <Input
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
              />
            </FormField>

            <FormField>
              <Label>Endpoint</Label>
              <Select value={newEndpoint} onChange={(e) => setNewEndpoint(e.target.value as EndpointType)}>
                {ENDPOINT_OPTIONS.map((ep) => (
                  <option key={ep.value} value={ep.value}>{ep.label}</option>
                ))}
              </Select>
            </FormField>

            {newType !== "lmstudio" && (
              <>
                <FormField>
                  <Label>Auth</Label>
                  <Select value={newAuth} onChange={(e) => setNewAuth(e.target.value as AuthMethod)}>
                    {AUTH_OPTIONS[newType].map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </Select>
                </FormField>

                {newAuth === "api-key" && (
                  <FormField>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                  </FormField>
                )}

                {newAuth === "session-token" && (
                  <FormField>
                    <Label>Session Token</Label>
                    <Input
                      type="password"
                      value={newSessionToken}
                      onChange={(e) => setNewSessionToken(e.target.value)}
                      placeholder="Cookie-Wert einfügen"
                    />
                    <Hint>
                      Öffne chat.openai.com → DevTools → Application → Cookies →
                      kopiere den Wert von __Secure-next-auth.session-token
                    </Hint>
                  </FormField>
                )}
              </>
            )}

            <Button onClick={handleCreate} disabled={!newName.trim()}>
              Erstellen
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
