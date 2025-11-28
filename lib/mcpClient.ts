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
}

class MCPClientManager {
  private static instance: MCPClientManager;
  private clients: Map<string, MCPClientInstance> = new Map();

  private constructor() {}

  static getInstance(): MCPClientManager {
    if (!MCPClientManager.instance) {
      MCPClientManager.instance = new MCPClientManager();
    }
    return MCPClientManager.instance;
  }

  private createTransport(config: MCPServerConfig): Transport {
    switch (config.transport) {
      case "stdio":
        if (!config.command) {
          throw new Error("STDIO transport requires a command");
        }
        return new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: config.env,
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

    await client.connect(transport);

    this.clients.set(config.id, { client, transport });
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
    });
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

