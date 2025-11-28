import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcpClient";

// GET: Get connection status for all servers or a specific server
export async function GET(req: NextRequest) {
  try {
    const serverId = req.nextUrl.searchParams.get("serverId");

    if (serverId) {
      // Return status for a specific server
      const isConnected = mcpClientManager.isConnected(serverId);
      return NextResponse.json({
        serverId,
        connected: isConnected,
      });
    }

    // Return all connected server IDs
    const connectedServers = mcpClientManager.getConnectedServerIds();
    return NextResponse.json({
      connectedServers,
    });
  } catch (error) {
    console.error("[MCP Status Error]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 500 }
    );
  }
}

