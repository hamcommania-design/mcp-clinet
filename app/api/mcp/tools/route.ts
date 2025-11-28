import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcpClient";

// GET: List all tools for a server
export async function GET(req: NextRequest) {
  try {
    const serverId = req.nextUrl.searchParams.get("serverId");

    if (!serverId) {
      return NextResponse.json(
        { error: "Missing required query param: serverId" },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json(
        { error: "Server is not connected" },
        { status: 400 }
      );
    }

    const tools = await mcpClientManager.listTools(serverId);

    return NextResponse.json({ tools });
  } catch (error) {
    console.error("[MCP List Tools Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list tools",
      },
      { status: 500 }
    );
  }
}

// POST: Call a tool
export async function POST(req: NextRequest) {
  try {
    const { serverId, toolName, args } = await req.json();

    if (!serverId || !toolName) {
      return NextResponse.json(
        { error: "Missing required fields: serverId, toolName" },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json(
        { error: "Server is not connected" },
        { status: 400 }
      );
    }

    const result = await mcpClientManager.callTool(
      serverId,
      toolName,
      args || {}
    );

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[MCP Call Tool Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to call tool",
      },
      { status: 500 }
    );
  }
}

