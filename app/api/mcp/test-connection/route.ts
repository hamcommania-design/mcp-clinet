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

    console.log("[MCP Test] 연결 시도:", {
      serverId: config.id,
      name: config.name,
      transport: config.transport,
      command: config.command,
      args: config.args,
      hasEnv: !!config.env && Object.keys(config.env).length > 0,
    });

    // 기존 연결이 있으면 먼저 해제
    if (mcpClientManager.isConnected(config.id)) {
      try {
        await mcpClientManager.disconnect(config.id);
        console.log("[MCP Test] 기존 연결 해제됨");
      } catch (error) {
        console.warn("[MCP Test] 기존 연결 해제 실패:", error);
      }
    }

    // 연결 시도
    const startTime = Date.now();
    try {
      await mcpClientManager.connect(config);
      const connectTime = Date.now() - startTime;
      console.log("[MCP Test] 연결 성공:", { connectTime: `${connectTime}ms` });

      // 서버 기능 확인
      const [tools, prompts, resources] = await Promise.all([
        mcpClientManager.listTools(config.id).catch((err) => {
          console.error("[MCP Test] Tools 조회 실패:", err);
          return [];
        }),
        mcpClientManager.listPrompts(config.id).catch((err) => {
          console.error("[MCP Test] Prompts 조회 실패:", err);
          return [];
        }),
        mcpClientManager.listResources(config.id).catch((err) => {
          console.error("[MCP Test] Resources 조회 실패:", err);
          return [];
        }),
      ]);

      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        serverId: config.id,
        connectTime: `${connectTime}ms`,
        totalTime: `${totalTime}ms`,
        tools: {
          count: tools.length,
          list: tools.map((t) => ({ name: t.name, description: t.description })),
        },
        prompts: {
          count: prompts.length,
          list: prompts.map((p) => ({ name: p.name, description: p.description })),
        },
        resources: {
          count: resources.length,
          list: resources.map((r) => ({ uri: r.uri, name: r.name })),
        },
      });
    } catch (error) {
      const connectTime = Date.now() - startTime;
      console.error("[MCP Test] 연결 실패:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 오류 메시지 분석
      let suggestion = "";
      if (errorMessage.includes("BRAVE_API_KEY") || errorMessage.includes("API key")) {
        suggestion = "BRAVE_API_KEY 환경 변수를 설정해야 합니다. 설정 페이지에서 환경 변수에 BRAVE_API_KEY=your_api_key 형식으로 추가하세요.";
      } else if (errorMessage.includes("command") || errorMessage.includes("not found")) {
        suggestion = "npx 명령어를 찾을 수 없습니다. Node.js가 설치되어 있는지 확인하세요.";
      } else if (errorMessage.includes("timeout")) {
        suggestion = "연결 시간이 초과되었습니다. 네트워크 연결을 확인하거나 서버가 실행 중인지 확인하세요.";
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          connectTime: `${connectTime}ms`,
          suggestion,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[MCP Test] 예상치 못한 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to test connection",
      },
      { status: 500 }
    );
  }
}

