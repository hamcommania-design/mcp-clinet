import { NextRequest, NextResponse } from "next/server";
import { mcpClientManager } from "@/lib/mcpClient";
import type { MCPServerConfig } from "@/app/types";

export async function POST(req: NextRequest) {
  let config: MCPServerConfig | null = null;
  try {
    config = await req.json();

    if (!config || !config.id || !config.name || !config.transport) {
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

    // Brave Search 서버의 경우 환경 변수 검증
    if (config.id === "brave-search" || config.name.toLowerCase().includes("brave")) {
      if (!config.env || !config.env.BRAVE_API_KEY || config.env.BRAVE_API_KEY.trim() === "") {
        return NextResponse.json(
          {
            error: "BRAVE_API_KEY 환경 변수가 설정되지 않았습니다.",
            suggestion: "설정 페이지에서 환경 변수에 BRAVE_API_KEY=your_api_key 형식으로 추가하세요. API 키는 https://brave.com/search/api/ 에서 발급받을 수 있습니다.",
          },
          { status: 400 }
        );
      }
    }

    console.log("[MCP Connect] 연결 시도:", {
      serverId: config.id,
      name: config.name,
      transport: config.transport,
      hasEnv: !!config.env && Object.keys(config.env).length > 0,
    });

    await mcpClientManager.connect(config);

    // 연결 후 서버가 초기화될 때까지 짧은 대기
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fetch server capabilities after connection
    // 각 호출에 타임아웃 설정
    const timeout = 10000; // 10초 타임아웃
    
    const fetchWithTimeout = async <T,>(
      promise: Promise<T>,
      timeoutMs: number
    ): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
        ),
      ]);
    };

    const [tools, prompts, resources] = await Promise.all([
      fetchWithTimeout(
        mcpClientManager.listTools(config.id).catch((err) => {
          console.error("[MCP Connect] Tools 조회 실패:", err);
          if (err instanceof Error && err.message.includes("Connection closed")) {
            throw new Error("서버 연결이 끊어졌습니다. 환경 변수 설정을 확인하세요.");
          }
          return [];
        }),
        timeout
      ),
      fetchWithTimeout(
        mcpClientManager.listPrompts(config.id).catch(() => []),
        timeout
      ),
      fetchWithTimeout(
        mcpClientManager.listResources(config.id).catch(() => []),
        timeout
      ),
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
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    let suggestion = "";
    
    // 오류 메시지 분석 및 제안
    if (errorMessage.includes("BRAVE_API_KEY") || errorMessage.includes("API key")) {
      suggestion = "BRAVE_API_KEY 환경 변수를 설정해야 합니다. 설정 페이지에서 환경 변수에 BRAVE_API_KEY=your_api_key 형식으로 추가하세요.";
    } else if (errorMessage.includes("command") || errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      suggestion = "npx 명령어를 찾을 수 없습니다. Node.js가 설치되어 있는지 확인하세요. (node -v, npm -v로 확인)";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
      suggestion = "연결 시간이 초과되었습니다. 네트워크 연결을 확인하거나 패키지 다운로드가 진행 중일 수 있습니다.";
    } else if (errorMessage.includes("ECONNREFUSED")) {
      suggestion = "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.";
    } else if (errorMessage.includes("spawn") || errorMessage.includes("Cannot find module")) {
      suggestion = "MCP 서버 패키지를 찾을 수 없습니다. npx가 인터넷에 접근할 수 있는지 확인하세요.";
    } else if (errorMessage.includes("Connection closed") || errorMessage.includes("-32000")) {
      if (config && (config.id === "brave-search" || config.name.toLowerCase().includes("brave"))) {
        suggestion = "서버가 즉시 종료되었습니다. BRAVE_API_KEY 환경 변수가 올바르게 설정되었는지 확인하세요. 설정 페이지에서 환경 변수에 BRAVE_API_KEY=your_api_key 형식으로 추가하세요.";
      } else {
        suggestion = "서버 연결이 끊어졌습니다. 서버가 정상적으로 시작되지 않았을 수 있습니다. 환경 변수 설정을 확인하거나 서버 로그를 확인하세요.";
      }
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        suggestion: suggestion || undefined,
      },
      { status: 500 }
    );
  }
}

