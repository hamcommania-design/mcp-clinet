// 도구 호출 정보
export interface ToolCall {
  id: string;
  serverId: string;
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "success" | "error";
  result?: MCPToolCallResult;
  error?: string;
  startTime?: number;
  endTime?: number;
}

// 메시지 타입 (도구 호출 정보 포함)
export interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

// MCP Types
export type MCPTransportType = "stdio" | "sse" | "streamable-http";

export type MCPConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: MCPTransportType;
  description?: string;
  // For STDIO transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // For SSE/Streamable HTTP transport
  url?: string;
  headers?: Record<string, string>;
}

export interface MCPServerState {
  config: MCPServerConfig;
  status: MCPConnectionStatus;
  error?: string;
  suggestion?: string;
  tools: MCPTool[];
  prompts: MCPPrompt[];
  resources: MCPResource[];
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
    url?: string; // Storage에 업로드된 이미지의 URL
  }>;
  isError?: boolean;
}

export interface MCPPromptResult {
  description?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: {
      type: string;
      text?: string;
    };
  }>;
}

export interface MCPResourceResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

// MCP Settings for import/export
export interface MCPSettings {
  version: string;
  servers: MCPServerConfig[];
}

// 활성화된 도구 정보 (채팅에서 사용할 도구 선택용)
export interface EnabledTool {
  serverId: string;
  serverName: string;
  toolName: string;
  description?: string;
}

// Chat API 요청 타입
export interface ChatRequest {
  messages: Message[];
  enabledTools?: EnabledTool[];
  mcpEnabled?: boolean;
}

// Chat API 응답의 도구 호출 정보
export interface ChatToolCallInfo {
  toolCalls: ToolCall[];
  finalResponse: string;
}

