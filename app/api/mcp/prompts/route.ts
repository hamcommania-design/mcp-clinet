import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcpClient";

// GET: List all prompts for a server
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

    const prompts = await mcpClientManager.listPrompts(serverId);

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("[MCP List Prompts Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list prompts",
      },
      { status: 500 }
    );
  }
}

// POST: Get a prompt
export async function POST(req: NextRequest) {
  try {
    const { serverId, promptName, args } = await req.json();

    if (!serverId || !promptName) {
      return NextResponse.json(
        { error: "Missing required fields: serverId, promptName" },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json(
        { error: "Server is not connected" },
        { status: 400 }
      );
    }

    const result = await mcpClientManager.getPrompt(
      serverId,
      promptName,
      args || {}
    );

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[MCP Get Prompt Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get prompt",
      },
      { status: 500 }
    );
  }
}

