import { useState, useRef, useCallback, useEffect } from "react";
import styled from "styled-components";
import type { LoopPhase, PhaseTransition } from "@/types/api";

/* ── Styled ── */

const Wrapper = styled.div`
  position: relative;
`;

const ZoomControls = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  z-index: 1;
`;

const ZoomBtn = styled.button`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  line-height: 1;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
`;

const SvgCanvas = styled.svg`
  width: 100%;
  min-height: 140px;
  max-height: 250px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: grab;
  overflow: hidden;

  &:active {
    cursor: grabbing;
  }
`;

const PhaseRect = styled.rect<{ $active: boolean; $initial: boolean }>`
  fill: ${(p) => (p.$active ? "var(--accent-muted)" : "var(--bg-elevated)")};
  stroke: ${(p) => (p.$initial ? "var(--accent)" : "var(--border)")};
  stroke-width: ${(p) => (p.$initial ? 2.5 : 1.5)};
  rx: 6;
  cursor: pointer;
  transition: fill 0.15s;

  &:hover {
    fill: var(--bg-hover);
  }
`;

const PhaseText = styled.text`
  fill: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
  text-anchor: middle;
  dominant-baseline: central;
`;

const PhaseSubText = styled.text`
  fill: var(--text-muted);
  font-size: 9px;
  pointer-events: none;
  text-anchor: middle;
  dominant-baseline: central;
`;

const Arrow = styled.path`
  fill: none;
  stroke: var(--text-muted);
  stroke-width: 1.5;
  marker-end: url(#arrowhead);
`;

const ArrowLabel = styled.text`
  fill: var(--text-muted);
  font-size: 9px;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
`;

/* ── Helpers ── */

interface PhasePosition {
  x: number;
  y: number;
}

const PHASE_W = 100;
const PHASE_H = 36;

function defaultLayout(phases: LoopPhase[]): Map<string, PhasePosition> {
  const positions = new Map<string, PhasePosition>();
  const cols = Math.max(3, Math.ceil(Math.sqrt(phases.length)));
  phases.forEach((phase, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(phase.name, {
      x: 50 + col * 150,
      y: 30 + row * 75,
    });
  });
  return positions;
}

function conditionLabel(t: PhaseTransition): string {
  switch (t.condition.type) {
    case "max_iterations": return "max iter";
    case "no_tool_calls": return "no tools";
    case "tool_called": return `tool: ${t.condition.toolName}`;
    case "tool_result_error": return "tool error";
    case "phase_complete": return "phase done";
    case "keyword": return `kw: ${t.condition.keyword}`;
    case "always": return "always";
  }
}

function edgePath(
  from: PhasePosition,
  to: PhasePosition,
  offset: number,
): string {
  const fx = from.x + PHASE_W / 2;
  const fy = from.y + PHASE_H / 2;
  const tx = to.x + PHASE_W / 2;
  const ty = to.y + PHASE_H / 2;

  const dx = tx - fx;
  const dy = ty - fy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let sx: number, sy: number, ex: number, ey: number;

  if (absDx > absDy) {
    if (dx > 0) {
      sx = from.x + PHASE_W;
      ex = to.x;
    } else {
      sx = from.x;
      ex = to.x + PHASE_W;
    }
    sy = from.y + PHASE_H / 2 + offset * 8;
    ey = to.y + PHASE_H / 2 + offset * 8;
  } else {
    if (dy > 0) {
      sy = from.y + PHASE_H;
      ey = to.y;
    } else {
      sy = from.y;
      ey = to.y + PHASE_H;
    }
    sx = from.x + PHASE_W / 2 + offset * 8;
    ex = to.x + PHASE_W / 2 + offset * 8;
  }

  const cx1 = sx + (ex - sx) * 0.4;
  const cy1 = sy;
  const cx2 = sx + (ex - sx) * 0.6;
  const cy2 = ey;

  return `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey}`;
}

/* ── Component ── */

interface PhaseGraphProps {
  phases: LoopPhase[];
  initialPhase: string;
  selectedPhase?: string | null;
  onSelectPhase: (name: string) => void;
  positions?: Map<string, PhasePosition>;
  onPositionsChange?: (positions: Map<string, PhasePosition>) => void;
}

export default function PhaseGraph({
  phases,
  initialPhase,
  selectedPhase,
  onSelectPhase,
  positions: externalPositions,
  onPositionsChange,
}: PhaseGraphProps) {
  const [internalPositions, setInternalPositions] = useState<Map<string, PhasePosition>>(
    () => defaultLayout(phases),
  );
  const positions = externalPositions ?? internalPositions;
  const setPositions = onPositionsChange ?? setInternalPositions;

  const [dragging, setDragging] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const existing = new Set(positions.keys());
    const needed = phases.map((p) => p.name);
    const hasNew = needed.some((n) => !existing.has(n));
    if (hasNew) {
      setPositions(defaultLayout(phases));
    }
  }, [phases.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate content dimensions
  let contentW = 300, contentH = 150;
  for (const pos of positions.values()) {
    contentW = Math.max(contentW, pos.x + PHASE_W + 30);
    contentH = Math.max(contentH, pos.y + PHASE_H + 30);
  }

  const getSvgPoint = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: panOffset.x + ((e.clientX - rect.left) / rect.width) * (contentW * zoom),
      y: panOffset.y + ((e.clientY - rect.top) / rect.height) * (contentH * zoom),
    };
  }, [panOffset, zoom, contentW, contentH]);

  function handlePhaseMouseDown(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const point = getSvgPoint(e);
    const pos = positions.get(name) ?? { x: 0, y: 0 };
    dragOffset.current = { x: point.x - pos.x, y: point.y - pos.y };
    setDragging(name);
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === "svg") {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y };
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (dragging) {
      const point = getSvgPoint(e);
      const newPositions = new Map(positions);
      newPositions.set(dragging, {
        x: Math.max(0, point.x - dragOffset.current.x),
        y: Math.max(0, point.y - dragOffset.current.y),
      });
      setPositions(newPositions);
    } else if (isPanning) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - panStart.current.x) / rect.width) * (contentW * zoom);
      const dy = ((e.clientY - panStart.current.y) / rect.height) * (contentH * zoom);
      setPanOffset({
        x: panStart.current.panX - dx,
        y: panStart.current.panY - dy,
      });
    }
  }

  function handleMouseUp() {
    setDragging(null);
    setIsPanning(false);
  }

  const vbW = contentW * zoom;
  const vbH = contentH * zoom;

  return (
    <Wrapper>
      <ZoomControls>
        <ZoomBtn onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))}>+</ZoomBtn>
        <ZoomBtn onClick={() => setZoom((z) => Math.min(3, z * 1.2))}>−</ZoomBtn>
      </ZoomControls>
      <SvgCanvas
        ref={svgRef}
        viewBox={`${panOffset.x} ${panOffset.y} ${vbW} ${vbH}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
          </marker>
        </defs>

        {/* Transitions (arrows) */}
        {phases.flatMap((phase) => {
          const targetCounts = new Map<string, number>();
          return phase.transitions.map((t, ti) => {
            const fromPos = positions.get(phase.name);
            const toPos = positions.get(t.to);
            if (!fromPos || !toPos) return null;

            const targetIdx = targetCounts.get(t.to) ?? 0;
            targetCounts.set(t.to, targetIdx + 1);

            const path = edgePath(fromPos, toPos, targetIdx);
            const mx = (fromPos.x + PHASE_W / 2 + toPos.x + PHASE_W / 2) / 2;
            const baseMy = (fromPos.y + PHASE_H / 2 + toPos.y + PHASE_H / 2) / 2 - 8;
            const my = baseMy + targetIdx * 12;

            return (
              <g key={`${phase.name}-${t.to}-${ti}`}>
                <Arrow d={path} />
                <ArrowLabel x={mx} y={my}>
                  {conditionLabel(t)}
                </ArrowLabel>
              </g>
            );
          });
        })}

        {/* Start arrow for initial phase */}
        {(() => {
          const initPos = positions.get(initialPhase);
          if (!initPos) return null;
          return (
            <g>
              <line
                x1={initPos.x - 25}
                y1={initPos.y + PHASE_H / 2}
                x2={initPos.x - 4}
                y2={initPos.y + PHASE_H / 2}
                stroke="var(--accent)"
                strokeWidth={2}
                markerEnd="url(#arrowhead)"
              />
              <circle cx={initPos.x - 25} cy={initPos.y + PHASE_H / 2} r={3} fill="var(--accent)" />
            </g>
          );
        })()}

        {/* Phase boxes */}
        {phases.map((phase) => {
          const pos = positions.get(phase.name);
          if (!pos) return null;
          const isInitial = phase.name === initialPhase;
          const isActive = phase.name === selectedPhase;

          return (
            <g
              key={phase.name}
              onMouseDown={(e) => handlePhaseMouseDown(phase.name, e)}
              onClick={() => onSelectPhase(phase.name)}
            >
              <PhaseRect
                x={pos.x}
                y={pos.y}
                width={PHASE_W}
                height={PHASE_H}
                $active={isActive}
                $initial={isInitial}
              />
              <PhaseText x={pos.x + PHASE_W / 2} y={pos.y + PHASE_H / 2 - 5}>
                {phase.name}
              </PhaseText>
              <PhaseSubText x={pos.x + PHASE_W / 2} y={pos.y + PHASE_H / 2 + 8}>
                max: {phase.maxIterations} | {phase.transitions.length}t
              </PhaseSubText>
            </g>
          );
        })}
      </SvgCanvas>
    </Wrapper>
  );
}
