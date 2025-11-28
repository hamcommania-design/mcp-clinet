import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcpClient";
import type { MCPServerConfig } from "@/app/types";

export async function POST(req: NextRequest) {
  try {
    const config: MCPServerConfig = await req.json();

    if (!config.id || !config.name || !config.transport) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, transport" },
        { status: 400 }
      );
    }

    // Validate transport-specific fields
    if (config.transport === "stdio" && !config.command) {
      return NextResponse.json(
        { error: "STDIO transport requires a command" },
        { status: 400 }
      );
    }

    if (
      (config.transport === "sse" || config.transport === "streamable-http") &&
      !config.url
    ) {
      return NextResponse.json(
        { error: `${config.transport.toUpperCase()} transport requires a URL` },
        { status: 400 }
      );
    }

    await mcpClientManager.connect(config);

    // Fetch server capabilities after connection
    const [tools, prompts, resources] = await Promise.all([
      mcpClientManager.listTools(config.id).catch(() => []),
      mcpClientManager.listPrompts(config.id).catch(() => []),
      mcpClientManager.listResources(config.id).catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      serverId: config.id,
      tools,
      prompts,
      resources,
    });
  } catch (error) {
    console.error("[MCP Connect Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to connect to server",
      },
      { status: 500 }
    );
  }
}

