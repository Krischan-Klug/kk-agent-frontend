import { useState, useRef, useEffect } from "react";
import styled from "styled-components";

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const Trigger = styled.button`
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 2px var(--space-sm);
  background: var(--accent-muted);
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--accent);
    color: var(--bg-base);
  }

  &::after {
    content: "▼";
    font-size: 8px;
    opacity: 0.7;
  }
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  min-width: 200px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;

const Option = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: ${(p) => (p.$active ? "var(--accent-muted)" : "transparent")};
  color: var(--text-primary);
  border: none;
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-family: var(--font-mono);
  text-align: left;

  &:hover {
    background: var(--bg-hover);
  }

  &::after {
    content: "${(p) => (p.$active ? "✓" : "")}";
    color: var(--accent);
    font-size: 12px;
  }
`;

interface ModelSelectProps {
  models: string[];
  currentModel: string;
  onSelect: (model: string) => void;
}

export default function ModelSelect({ models, currentModel, onSelect }: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <Wrapper ref={wrapperRef}>
      <Trigger onClick={() => setOpen(!open)}>{currentModel}</Trigger>
      {open && (
        <Dropdown>
          {models.map((m) => (
            <Option
              key={m}
              $active={m === currentModel}
              onClick={() => {
                onSelect(m);
                setOpen(false);
              }}
            >
              {m}
            </Option>
          ))}
        </Dropdown>
      )}
    </Wrapper>
  );
}
