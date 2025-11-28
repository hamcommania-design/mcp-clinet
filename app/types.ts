export interface Message {
  role: "user" | "assistant";
  content: string;
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

