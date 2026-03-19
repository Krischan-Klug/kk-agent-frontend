import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { provider as providerApi } from "@/lib/api";
import type { ModelInfo, ModelSettings, ReasoningEffort, ReasoningLevelConfig } from "@/types/api";
import { REASONING_LEVEL_DEFAULTS } from "@/constants/reasoningDefaults";
import { PageTitle } from "@/components/Layout.styled";
import Card from "@/components/Card";
import Spinner from "@/components/Spinner";

/* ── Styled ── */

const Grid = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
`;

const ModelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
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

const SettingsRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
`;

const Label = styled.span`
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  min-width: 60px;
`;

const Select = styled.select`
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
`;

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

/* ── Constants ── */

const LEVELS = ["off", "low", "medium", "high", "on"] as const;

/* ── Page ── */

export default function ProviderPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettings>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await providerApi.getModels();
      setModels(data.models);
      setModelSettings(data.modelSettings ?? {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(modelId: string, newSettings: ModelSettings) {
    setModelSettings((prev) => ({ ...prev, [modelId]: newSettings }));
    try {
      await providerApi.setModelSettings(modelId, newSettings);
    } catch (err) {
      console.error(err);
    }
  }

  function handleDefaultChange(modelId: string, value: string) {
    const settings = modelSettings[modelId] ?? {};
    saveSettings(modelId, { ...settings, reasoningEffort: (value || undefined) as ReasoningEffort | undefined });
  }

  function handleLevelChange(modelId: string, level: string, field: keyof ReasoningLevelConfig, value: string) {
    const settings = modelSettings[modelId] ?? {};
    const levels = { ...settings.levels };
    const levelConfig = { ...levels[level] };

    const numVal = value === "" ? undefined : Number(value);
    levelConfig[field] = numVal;

    // Clean up empty configs
    if (levelConfig.temperature === undefined && levelConfig.maxOutputTokens === undefined) {
      delete levels[level];
    } else {
      levels[level] = levelConfig;
    }

    saveSettings(modelId, { ...settings, levels: Object.keys(levels).length > 0 ? levels : undefined });
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageTitle>Provider</PageTitle>
      <Grid>
        {models.length === 0 ? (
          <Card>
            <span style={{ color: "var(--text-muted)" }}>
              Keine Modelle verfügbar. Ist der Provider (LM Studio) gestartet?
            </span>
          </Card>
        ) : (
          models.map((m) => {
            const settings = modelSettings[m.id] ?? {};
            return (
              <Card key={m.id}>
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
                    <Label>Default:</Label>
                    <Select
                      value={settings.reasoningEffort ?? ""}
                      onChange={(e) => handleDefaultChange(m.id, e.target.value)}
                    >
                      <option value="">--</option>
                      <option value="off">Off</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="on">On</option>
                    </Select>
                  </SettingsRow>
                </ModelHeader>

                {/* Per-Level Config Grid */}
                <LevelGrid>
                  <LevelHeaderCell>Level</LevelHeaderCell>
                  <LevelHeaderCell>Temperature<UnitHint>0–2</UnitHint></LevelHeaderCell>
                  <LevelHeaderCell>Max Output<UnitHint>tokens</UnitHint></LevelHeaderCell>
                  {LEVELS.map((level, i) => {
                    const lc = settings.levels?.[level] ?? {};
                    const isDefault = level === settings.reasoningEffort;
                    const isLast = i === LEVELS.length - 1;
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
              </Card>
            );
          })
        )}
      </Grid>
    </div>
  );
}
