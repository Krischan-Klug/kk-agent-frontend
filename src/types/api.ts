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
  role: "user" | "assistant" | "tool" | "system";
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
  emoji?: string;
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
}

/* ── Provider ── */

export type ProviderType = "lmstudio" | "openai" | "anthropic";
export type EndpointType = "chat-completions" | "responses" | "completions" | "embeddings";
export type AuthMethod = "none" | "api-key" | "session-token";

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  authMethod: AuthMethod;
  apiKey?: string;
  sessionToken?: string;
  endpoint: EndpointType;
  isDefault?: boolean;
}

export interface CreateProviderBody {
  name: string;
  type: ProviderType;
  baseUrl: string;
  authMethod: AuthMethod;
  apiKey?: string;
  sessionToken?: string;
  endpoint: EndpointType;
}

export interface UpdateProviderBody {
  name?: string;
  type?: ProviderType;
  baseUrl?: string;
  authMethod?: AuthMethod;
  apiKey?: string;
  sessionToken?: string;
  endpoint?: EndpointType;
}

export interface CreateMcpBody {
  name: string;
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  instruction?: string;
  emoji?: string;
}

export interface UpdateMcpBody {
  name?: string;
  transport?: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  instruction?: string;
  emoji?: string;
}

/* ── Agent ── */

export type ReasoningEffort = string;

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  maxIterations: number;
  mcpIds: string[];
  mcpInstructions: Record<string, string>;
  variables: Record<string, string>;
  defaultModel?: string;
  reasoningEffort?: ReasoningEffort;
  createdAt: string;
  updatedAt: string;
}

export interface AgentLoopState {
  sessionId: string;
  agentId: string;
  status: "idle" | "running" | "completed" | "error";
  iteration: number;
  maxIterations: number;
  startedAt: string;
  updatedAt: string;
}

export interface CreateAgentBody {
  name: string;
  description?: string;
  systemPrompt?: string;
  maxIterations?: number;
  mcpIds?: string[];
  mcpInstructions?: Record<string, string>;
  variables?: Record<string, string>;
  defaultModel?: string;
  reasoningEffort?: ReasoningEffort;
}

export interface UpdateAgentBody {
  name?: string;
  description?: string;
  systemPrompt?: string;
  maxIterations?: number;
  mcpIds?: string[];
  mcpInstructions?: Record<string, string>;
  variables?: Record<string, string>;
  defaultModel?: string;
  reasoningEffort?: ReasoningEffort;
}

export interface SystemVariablesResponse {
  variables: string[];
}

/* ── Defaults ── */

export interface AppDefaults {
  agent: {
    systemPrompt: string;
    maxIterations: number;
  };
  retry: {
    emptyResponseInstruction: string;
    invalidToolInstruction: string;
    lengthInstruction: string;
  };
  reasoning: {
    defaultEffort: string;
  };
}

/* ── Streaming ── */

export type StreamEvent =
  | { type: "content"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "retry_notice"; message: string }
  | { type: "tool_call"; toolCall: { id: string; name: string; arguments: Record<string, unknown> } }
  | { type: "tool_result"; toolCallId: string; content: string; isError: boolean }
  | { type: "loop_state"; state: AgentLoopState }
  | { type: "stats"; inputTokens: number; outputTokens: number; reasoningTokens: number; source: "provider" | "estimated" | "unknown" }
  | { type: "done"; session: SessionState }
  | { type: "error"; message: string };
