import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  MCPServerConfig,
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPToolCallResult,
  MCPPromptResult,
  MCPResourceResult,
} from "@/app/types";

interface MCPClientInstance {
  client: Client;
  transport: Transport;
  config: MCPServerConfig;
}

// Global 객체에 MCPClientManager 인스턴스를 저장하기 위한 타입 정의
declare global {
  var __mcpClientManager: MCPClientManager | undefined;
}

class MCPClientManager {
  private clients: Map<string, MCPClientInstance> = new Map();

  constructor() {}

  static getInstance(): MCPClientManager {
    // Node.js global 객체를 사용하여 Next.js 서버 인스턴스 간 공유
    // 이렇게 하면 페이지 이동이나 HMR 시에도 연결이 유지됨
    if (!global.__mcpClientManager) {
      global.__mcpClientManager = new MCPClientManager();
    }
    return global.__mcpClientManager;
  }

  private createTransport(config: MCPServerConfig): Transport {
    switch (config.transport) {
      case "stdio":
        if (!config.command) {
          throw new Error("STDIO transport requires a command");
        }
        
        // 환경 변수 준비 (기존 환경 변수에 추가)
        const envRaw = {
          ...process.env,
          ...(config.env || {}),
        };
        
        // 빈 값과 undefined 제거 후 Record<string, string> 타입으로 변환
        const env: Record<string, string> = {};
        Object.keys(envRaw).forEach((key) => {
          const value = envRaw[key];
          if (value !== undefined && value !== "") {
            env[key] = value;
          }
        });
        
        console.log("[MCP Client] STDIO Transport 생성:", {
          command: config.command,
          args: config.args,
          envKeys: Object.keys(env).filter((k) => k.startsWith("BRAVE") || k.startsWith("MCP")),
        });
        
        return new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: env,
        });

      case "sse":
        if (!config.url) {
          throw new Error("SSE transport requires a URL");
        }
        return new SSEClientTransport(new URL(config.url));

      case "streamable-http":
        if (!config.url) {
          throw new Error("Streamable HTTP transport requires a URL");
        }
        return new StreamableHTTPClientTransport(new URL(config.url));

      default:
        throw new Error(`Unsupported transport type: ${config.transport}`);
    }
  }

  async connect(config: MCPServerConfig): Promise<void> {
    // Disconnect existing connection if any
    if (this.clients.has(config.id)) {
      await this.disconnect(config.id);
    }

    const transport = this.createTransport(config);
    const client = new Client(
      {
        name: "mcp-client-app",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    try {
      console.log("[MCP Client] 연결 시작:", config.id);
      await client.connect(transport);
      console.log("[MCP Client] 연결 성공:", config.id);
      
      // 연결 후 서버가 초기화될 때까지 짧은 대기
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      this.clients.set(config.id, { client, transport, config });
    } catch (error) {
      console.error("[MCP Client] 연결 실패:", config.id, error);
      // 연결 실패 시 클라이언트 정리
      try {
        await client.close();
      } catch {
        // 무시
      }
      throw error;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const instance = this.clients.get(serverId);
    if (instance) {
      await instance.client.close();
      this.clients.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.keys()).map((id) =>
      this.disconnect(id)
    );
    await Promise.all(disconnectPromises);
  }

  isConnected(serverId: string): boolean {
    return this.clients.has(serverId);
  }

  getConnectedServerIds(): string[] {
    return Array.from(this.clients.keys());
  }

  // 연결된 모든 서버의 설정 정보 반환
  getConnectedServers(): { id: string; config: MCPServerConfig }[] {
    return Array.from(this.clients.entries()).map(([id, instance]) => ({
      id,
      config: instance.config,
    }));
  }

  // 연결된 모든 서버의 도구 목록 반환
  async getAllTools(): Promise<{ serverId: string; serverName: string; tools: MCPTool[] }[]> {
    const results: { serverId: string; serverName: string; tools: MCPTool[] }[] = [];
    
    for (const [serverId, instance] of this.clients.entries()) {
      try {
        const tools = await this.listTools(serverId);
        results.push({
          serverId,
          serverName: instance.config.name,
          tools,
        });
      } catch (error) {
        console.error(`Failed to get tools from server ${serverId}:`, error);
      }
    }
    
    return results;
  }

  private getClient(serverId: string): Client {
    const instance = this.clients.get(serverId);
    if (!instance) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return instance.client;
  }

  async listTools(serverId: string): Promise<MCPTool[]> {
    const client = this.getClient(serverId);
    const result = await client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as MCPTool["inputSchema"],
    }));
  }

  async listPrompts(serverId: string): Promise<MCPPrompt[]> {
    const client = this.getClient(serverId);
    const result = await client.listPrompts();
    return result.prompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments?.map((arg) => ({
        name: arg.name,
        description: arg.description,
        required: arg.required,
      })),
    }));
  }

  async listResources(serverId: string): Promise<MCPResource[]> {
    const client = this.getClient(serverId);
    const result = await client.listResources();
    return result.resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolCallResult> {
    const client = this.getClient(serverId);
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    }) as { content: Array<{ type: string; text?: string; data?: string; mimeType?: string; resource?: unknown }>; isError: boolean };
    return {
      content: result.content.map((c) => {
        if (c.type === "text") {
          return { type: "text", text: c.text };
        } else if (c.type === "image") {
          return { type: "image", data: c.data, mimeType: c.mimeType };
        } else if (c.type === "resource") {
          return {
            type: "resource",
            text: (c.resource as { text?: string }).text,
            mimeType: (c.resource as { mimeType?: string }).mimeType,
          };
        }
        return { type: c.type };
      }),
      isError: result.isError,
    };
  }

  async getPrompt(
    serverId: string,
    promptName: string,
    args: Record<string, string>
  ): Promise<MCPPromptResult> {
    const client = this.getClient(serverId);
    const result = await client.getPrompt({
      name: promptName,
      arguments: args,
    });
    return {
      description: result.description,
      messages: result.messages.map((msg) => ({
        role: msg.role,
        content: {
          type: (msg.content as { type: string }).type,
          text: (msg.content as { text?: string }).text,
        },
      })),
    };
  }

  async readResource(
    serverId: string,
    uri: string
  ): Promise<MCPResourceResult> {
    const client = this.getClient(serverId);
    const result = await client.readResource({ uri });
    return {
      contents: result.contents.map((content) => ({
        uri: content.uri,
        mimeType: content.mimeType,
        text: (content as { text?: string }).text,
        blob: (content as { blob?: string }).blob,
      })),
    };
  }
}

// Export singleton instance
export const mcpClientManager = MCPClientManager.getInstance();

