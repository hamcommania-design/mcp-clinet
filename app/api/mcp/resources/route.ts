import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcpClient";

// GET: List all resources for a server
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

    const resources = await mcpClientManager.listResources(serverId);

    return NextResponse.json({ resources });
  } catch (error) {
    console.error("[MCP List Resources Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list resources",
      },
      { status: 500 }
    );
  }
}

// POST: Read a resource
export async function POST(req: NextRequest) {
  try {
    const { serverId, uri } = await req.json();

    if (!serverId || !uri) {
      return NextResponse.json(
        { error: "Missing required fields: serverId, uri" },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json(
        { error: "Server is not connected" },
        { status: 400 }
      );
    }

    const result = await mcpClientManager.readResource(serverId, uri);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[MCP Read Resource Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read resource",
      },
      { status: 500 }
    );
  }
}

