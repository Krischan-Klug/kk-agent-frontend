/* ── Session ── */

export interface SessionState {
  id: string;
  name: string;
  model: string;
  agentId: string;
  activeMcpIds: string[];
  systemPrompt: string;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  messages: SessionMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  reasoning?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CreateSessionBody {
  agentId: string;
  model?: string;
  activeMcpIds?: string[];
  reasoningEffort?: ReasoningEffort;
}

/* ── MCP ── */

export interface McpServerConfig {
  id: string;
  name: string;
  active: boolean;
  instruction: string;
  transport: "stdio" | "sse";
  server: McpStdioConfig | McpSseConfig;
}

export interface McpStdioConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpSseConfig {
  url: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  mcpId: string;
}

export interface McpListItem extends McpServerConfig {
  running: boolean;
  tools: McpToolDefinition[];
}

export interface ModelInfo {
  id: string;
  object: string;
  maxContextLength?: number;
  contextLength?: number;
}

export interface ReasoningLevelConfig {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ModelSettings {
  reasoningEffort?: ReasoningEffort;
  reasoningOnOff?: boolean;
  levels?: Record<string, ReasoningLevelConfig>;
  compactionPrompt?: string;
}

export interface CreateMcpBody {
  name: string;
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  instruction?: string;
}

export interface UpdateMcpBody {
  name?: string;
  transport?: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  instruction?: string;
}

/* ── Agent ── */

export type ReasoningEffort = string;

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  loopStrategy: LoopStrategy;
  promptTemplates: PromptTemplates;
  mcpIds: string[];
  mcpInstructions: Record<string, string>;
  variables: Record<string, string>;
  defaultModel?: string;
  reasoningEffort?: ReasoningEffort;
  compactionPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplates {
  base: string;
  phases: Record<string, string>;
}

export interface LoopStrategy {
  initialPhase: string;
  maxTotalIterations: number;
  phases: LoopPhase[];
}

export interface LoopPhase {
  name: string;
  description: string;
  maxIterations: number;
  toolFilter?: ToolFilter;
  completionCriteria?: PhaseCompletionCriteria;
  continueOnStop?: boolean;
  transitions: PhaseTransition[];
  autoAdvance: boolean;
}

export interface PhaseCompletionCriteria {
  mode: "stop" | "signal";
  signal?: string;
  requiresToolCall?: boolean;
}

export interface ToolFilter {
  mode: "include" | "exclude";
  toolNames: string[];
}

export interface PhaseTransition {
  to: string;
  condition: TransitionCondition;
}

export type TransitionCondition =
  | { type: "max_iterations" }
  | { type: "no_tool_calls" }
  | { type: "tool_called"; toolName: string }
  | { type: "tool_result_error" }
  | { type: "phase_complete" }
  | { type: "keyword"; keyword: string }
  | { type: "always" };

export interface AgentLoopState {
  sessionId: string;
  agentId: string;
  status: "idle" | "running" | "completed" | "error";
  currentPhase: string;
  phaseIteration: number;
  totalIteration: number;
  phaseHistory: PhaseHistoryEntry[];
  startedAt: string;
  updatedAt: string;
}

export interface PhaseHistoryEntry {
  phase: string;
  iterations: number;
  toolCallCount: number;
  transitionReason: string;
  startedAt: string;
  endedAt: string;
}

export interface CreateAgentBody {
  name: string;
  description?: string;
  loopStrategy: LoopStrategy;
  promptTemplates: PromptTemplates;
  mcpIds?: string[];
  mcpInstructions?: Record<string, string>;
  variables?: Record<string, string>;
  defaultModel?: string;
  reasoningEffort?: ReasoningEffort;
  compactionPrompt?: string;
}

export interface UpdateAgentBody {
  name?: string;
  description?: string;
  loopStrategy?: LoopStrategy;
  promptTemplates?: PromptTemplates;
  mcpIds?: string[];
  mcpInstructions?: Record<string, string>;
  variables?: Record<string, string>;
  defaultModel?: string;
  reasoningEffort?: ReasoningEffort;
  compactionPrompt?: string;
}

/* ── Streaming ── */

export type StreamEvent =
  | { type: "content"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_call"; toolCall: { id: string; name: string; arguments: Record<string, unknown> } }
  | { type: "tool_result"; toolCallId: string; content: string; isError: boolean }
  | { type: "phase_change"; from: string; to: string; reason: string }
  | { type: "loop_state"; state: AgentLoopState }
  | { type: "stats"; inputTokens: number; outputTokens: number; reasoningTokens: number }
  | { type: "done"; session: SessionState }
  | { type: "error"; message: string };
