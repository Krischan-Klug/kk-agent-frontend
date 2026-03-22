import { useEffect, useState } from "react";
import styled from "styled-components";
import { settings as settingsApi } from "@/lib/api";
import type { AppDefaults } from "@/types/api";
import { PageTitle } from "@/components/Layout.styled";
import Button from "@/components/Button";
import TextArea from "@/components/TextArea";
import Input from "@/components/Input";
import Spinner from "@/components/Spinner";

/* ── Styled ── */

const PageWrapper = styled.div`
  max-width: 820px;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding-bottom: var(--space-xl);
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
`;

const SectionTitle = styled.h3`
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-xs) 0;
`;

const FieldLabel = styled.label`
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: 2px;
  display: block;
`;

const Hint = styled.div`
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  margin-top: -4px;
`;

const Row = styled.div`
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
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
    border-color: var(--accent);
  }
`;

const Actions = styled.div`
  display: flex;
  gap: var(--space-sm);
  align-items: center;
`;

const SaveMsg = styled.span`
  font-size: var(--font-size-sm);
  color: var(--text-muted);
`;

/* ── Page ── */

export default function SettingsPage() {
  const [defaults, setDefaults] = useState<AppDefaults | null>(null);
  const [draft, setDraft] = useState<AppDefaults | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    settingsApi.getDefaults().then((d) => {
      setDefaults(d);
      setDraft(d);
    });
  }, []);

  if (!draft) return <Spinner />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(defaults);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await settingsApi.updateDefaults(draft);
      setDefaults(updated);
      setDraft(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof AppDefaults>(
    section: K,
    field: keyof AppDefaults[K],
    value: string | number,
  ) {
    setDraft((prev) =>
      prev
        ? { ...prev, [section]: { ...prev[section], [field]: value } }
        : prev,
    );
  }

  return (
    <PageWrapper>
      <PageTitle>Settings</PageTitle>

      {/* ── Agent Defaults ── */}
      <Section>
        <SectionTitle>Agent-Defaults</SectionTitle>
        <Hint>Fallback-Werte für neue Agents und Sessions.</Hint>

        <FieldLabel>System-Prompt</FieldLabel>
        <TextArea
          rows={4}
          value={draft.agent.systemPrompt}
          onChange={(e) => update("agent", "systemPrompt", e.target.value)}
        />

        <Row>
          <div>
            <FieldLabel>Max Iterations</FieldLabel>
            <Input
              type="number"
              min={1}
              max={100}
              value={draft.agent.maxIterations}
              onChange={(e) =>
                update("agent", "maxIterations", Number(e.target.value))
              }
              style={{ width: 100 }}
            />
          </div>
          <div>
            <FieldLabel>Compaction Threshold</FieldLabel>
            <Input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={draft.agent.compactionThreshold}
              onChange={(e) =>
                update("agent", "compactionThreshold", Number(e.target.value))
              }
              style={{ width: 100 }}
            />
            <Hint>0.0 – 1.0 (Anteil des Context-Fensters)</Hint>
          </div>
        </Row>
      </Section>

      {/* ── Compaction ── */}
      <Section>
        <SectionTitle>Compaction</SectionTitle>
        <Hint>System-Prompt und Nachricht für die Kontext-Komprimierung.</Hint>

        <FieldLabel>Compaction Prompt</FieldLabel>
        <TextArea
          rows={8}
          value={draft.compaction.prompt}
          onChange={(e) => update("compaction", "prompt", e.target.value)}
        />

        <FieldLabel>Post-Compaction Instruction</FieldLabel>
        <TextArea
          rows={3}
          value={draft.compaction.postInstruction}
          onChange={(e) =>
            update("compaction", "postInstruction", e.target.value)
          }
        />
        <Hint>Wird nach einer Komprimierung als System-Nachricht eingefügt.</Hint>
      </Section>

      {/* ── Retry Instructions ── */}
      <Section>
        <SectionTitle>Retry-Instructions</SectionTitle>
        <Hint>Anweisungen bei Fehlversuchen des Models.</Hint>

        <FieldLabel>Leere Antwort</FieldLabel>
        <TextArea
          rows={3}
          value={draft.retry.emptyResponseInstruction}
          onChange={(e) =>
            update("retry", "emptyResponseInstruction", e.target.value)
          }
        />

        <FieldLabel>Ungültiger Tool-Aufruf</FieldLabel>
        <TextArea
          rows={3}
          value={draft.retry.invalidToolInstruction}
          onChange={(e) =>
            update("retry", "invalidToolInstruction", e.target.value)
          }
        />

        <FieldLabel>Token-Limit erreicht</FieldLabel>
        <TextArea
          rows={3}
          value={draft.retry.lengthInstruction}
          onChange={(e) => update("retry", "lengthInstruction", e.target.value)}
        />
      </Section>

      {/* ── Reasoning ── */}
      <Section>
        <SectionTitle>Reasoning</SectionTitle>

        <FieldLabel>Default Effort</FieldLabel>
        <Select
          value={draft.reasoning.defaultEffort}
          onChange={(e) =>
            update("reasoning", "defaultEffort", e.target.value)
          }
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </Select>
        <Hint>Fallback wenn weder Session noch Model-Settings einen Wert setzen.</Hint>
      </Section>

      {/* ── Save ── */}
      <Actions>
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Speichern..." : "Speichern"}
        </Button>
        {saved && <SaveMsg>Gespeichert!</SaveMsg>}
        {error && <SaveMsg style={{ color: "var(--error)" }}>{error}</SaveMsg>}
      </Actions>
    </PageWrapper>
  );
}
