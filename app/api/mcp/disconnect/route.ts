import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcpClient";

export async function POST(req: NextRequest) {
  try {
    const { serverId } = await req.json();

    if (!serverId) {
      return NextResponse.json(
        { error: "Missing required field: serverId" },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json(
        { error: "Server is not connected" },
        { status: 400 }
      );
    }

    await mcpClientManager.disconnect(serverId);

    return NextResponse.json({
      success: true,
      serverId,
    });
  } catch (error) {
    console.error("[MCP Disconnect Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect from server",
      },
      { status: 500 }
    );
  }
}

