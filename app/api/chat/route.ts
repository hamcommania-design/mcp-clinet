import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import { mcpClientManager } from "@/lib/mcpClient";
import { uploadImageToStorage } from "@/lib/imageStorage";
import type { EnabledTool, ToolCall, MCPToolCallResult } from "@/app/types";

// Gemini Function Declaration 타입 정의
interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: {
    type: string;
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

// MCP 도구를 Gemini Function Declaration 형식으로 변환
function convertMCPToolToFunctionDeclaration(
  tool: { name: string; description?: string; inputSchema: { type: string; properties?: Record<string, unknown>; required?: string[] } },
  serverId: string
): GeminiFunctionDeclaration {
  // 도구 이름에 서버 ID를 포함시켜 구분
  const functionName = `${serverId}__${tool.name}`;
  
  // inputSchema의 properties를 Gemini 형식으로 변환
  const properties: Record<string, { type: string; description?: string }> = {};
  
  if (tool.inputSchema.properties) {
    for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
      const prop = value as { type?: string; description?: string };
      let schemaType = "STRING";
      
      if (prop.type === "number" || prop.type === "integer") {
        schemaType = "NUMBER";
      } else if (prop.type === "boolean") {
        schemaType = "BOOLEAN";
      } else if (prop.type === "array") {
        schemaType = "ARRAY";
      } else if (prop.type === "object") {
        schemaType = "OBJECT";
      }
      
      properties[key] = {
        type: schemaType,
        description: prop.description,
      };
    }
  }

  return {
    name: functionName,
    description: tool.description || `MCP Tool: ${tool.name}`,
    parameters: {
      type: "OBJECT",
      properties,
      required: tool.inputSchema.required || [],
    },
  };
}

// 도구 호출 결과를 텍스트로 변환
function formatToolResult(result: MCPToolCallResult): string {
  if (result.isError) {
    return `Error: ${result.content.map(c => c.text || c.type).join("\n")}`;
  }
  
  return result.content
    .map((c) => {
      if (c.type === "text" && c.text) {
        return c.text;
      } else if (c.type === "image") {
        return "[Image data]";
      } else if (c.type === "resource") {
        return c.text || "[Resource]";
      }
      return `[${c.type}]`;
    })
    .join("\n");
}

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();
  console.log("🔵 [API] 채팅 요청 수신:", {
    timestamp: new Date().toISOString(),
    url: req.url,
  });

  try {
    const { messages, enabledTools, mcpEnabled } = await req.json();

    console.log("📨 [API] 요청 데이터:", {
      메시지수: messages?.length || 0,
      마지막메시지: messages?.[messages.length - 1]?.content?.substring(0, 50) || "없음",
      MCP활성화: mcpEnabled,
      활성화된도구수: enabledTools?.length || 0,
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ [API] GEMINI_API_KEY가 설정되지 않았습니다.");
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 마지막 사용자 메시지 추출
    const userMessage = messages[messages.length - 1]?.content || "";
    if (!userMessage) {
      console.error("❌ [API] 메시지가 없습니다.");
      return new Response(
        JSON.stringify({ error: "메시지가 없습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // MCP 도구 설정
    const functionDeclarations: GeminiFunctionDeclaration[] = [];
    const toolMap = new Map<string, { serverId: string; toolName: string; serverName: string }>();

    if (mcpEnabled && enabledTools && enabledTools.length > 0) {
      console.log("🔧 [API] MCP 도구 설정 중...");
      
      // 활성화된 도구들을 Gemini function 형식으로 변환
      for (const enabledTool of enabledTools as EnabledTool[]) {
        try {
          // 서버가 연결되어 있는지 확인
          if (!mcpClientManager.isConnected(enabledTool.serverId)) {
            console.warn(`⚠️ [API] 서버 ${enabledTool.serverId}가 연결되어 있지 않습니다.`);
            continue;
          }

          // 해당 서버의 도구 목록 가져오기
          const tools = await mcpClientManager.listTools(enabledTool.serverId);
          const tool = tools.find(t => t.name === enabledTool.toolName);
          
          if (tool) {
            const funcDecl = convertMCPToolToFunctionDeclaration(tool, enabledTool.serverId);
            functionDeclarations.push(funcDecl);
            toolMap.set(funcDecl.name, {
              serverId: enabledTool.serverId,
              toolName: enabledTool.toolName,
              serverName: enabledTool.serverName,
            });
            console.log(`✅ [API] 도구 등록: ${funcDecl.name}`);
          }
        } catch (error) {
          console.error(`❌ [API] 도구 설정 오류 (${enabledTool.toolName}):`, error);
        }
      }
    }

    // 모델 설정
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelConfig: any = {
      model: "gemini-2.0-flash-001",
    };

    if (functionDeclarations.length > 0) {
      modelConfig.tools = [{ functionDeclarations }];
      console.log(`🔧 [API] ${functionDeclarations.length}개의 도구가 등록됨`);
    }

    const model = genAI.getGenerativeModel(modelConfig);

    // 이전 대화 내역을 히스토리로 변환
    const chatHistory = messages.slice(0, -1).map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    console.log("🤖 [API] Gemini 모델 호출 시작:", {
      모델: "gemini-2.0-flash-001",
      히스토리길이: chatHistory.length,
      사용자메시지길이: userMessage.length,
      도구수: functionDeclarations.length,
    });

    // 채팅 시작
    const chat = model.startChat({
      history: chatHistory,
    });

    // 도구 호출 정보를 저장할 배열
    const toolCalls: ToolCall[] = [];
    let finalResponse = "";

    // 첫 번째 응답 받기
    const geminiStartTime = Date.now();
    let result = await chat.sendMessage(userMessage);
    let response = result.response;
    const geminiResponseTime = Date.now() - geminiStartTime;

    console.log("✅ [API] Gemini 응답 수신:", {
      응답시간: `${geminiResponseTime}ms`,
    });

    // Function calling 루프 (최대 10회)
    let iterationCount = 0;
    const maxIterations = 10;

    while (iterationCount < maxIterations) {
      iterationCount++;
      
      // 응답에서 function call 확인
      const functionCalls = response.functionCalls();
      
      if (!functionCalls || functionCalls.length === 0) {
        // 더 이상 function call이 없으면 최종 응답
        finalResponse = response.text();
        break;
      }

      console.log(`🔄 [API] Function call 감지 (반복 ${iterationCount}):`, {
        호출수: functionCalls.length,
      });

      // 각 function call 실행
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const functionResponses: any[] = [];
      
      for (const functionCall of functionCalls) {
        const toolInfo = toolMap.get(functionCall.name);
        
        if (!toolInfo) {
          console.error(`❌ [API] 알 수 없는 도구: ${functionCall.name}`);
          functionResponses.push({
            functionResponse: {
              name: functionCall.name,
              response: { error: "Unknown tool" },
            },
          });
          continue;
        }

        const toolCallId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const toolCall: ToolCall = {
          id: toolCallId,
          serverId: toolInfo.serverId,
          serverName: toolInfo.serverName,
          toolName: toolInfo.toolName,
          args: functionCall.args as Record<string, unknown>,
          status: "running",
          startTime: Date.now(),
        };
        toolCalls.push(toolCall);

        console.log(`🔧 [API] MCP 도구 호출: ${toolInfo.toolName}`, {
          서버: toolInfo.serverId,
          인자: functionCall.args,
        });

        try {
          // MCP 도구 실행
          const mcpResult = await mcpClientManager.callTool(
            toolInfo.serverId,
            toolInfo.toolName,
            functionCall.args as Record<string, unknown>
          );

          // 이미지가 포함된 경우 Storage에 업로드하고 URL로 교체
          if (!mcpResult.isError && mcpResult.content) {
            const processedContent = await Promise.all(
              mcpResult.content.map(async (contentItem) => {
                if (contentItem.type === "image" && contentItem.data) {
                  try {
                    console.log(`📸 [API] 이미지 업로드 시작: ${toolInfo.toolName}`);
                    const imageUrl = await uploadImageToStorage(
                      contentItem.data,
                      contentItem.mimeType || "image/png"
                    );
                    console.log(`✅ [API] 이미지 업로드 완료: ${imageUrl}`);
                    
                    // base64 데이터를 URL로 교체
                    return {
                      ...contentItem,
                      data: undefined, // base64 데이터 제거
                      url: imageUrl, // Storage URL 추가
                    };
                  } catch (uploadError) {
                    console.error(`❌ [API] 이미지 업로드 실패:`, uploadError);
                    // 업로드 실패 시 원본 데이터 유지
                    return contentItem;
                  }
                }
                return contentItem;
              })
            );

            // 처리된 콘텐츠로 결과 업데이트
            mcpResult.content = processedContent;
          }

          toolCall.status = mcpResult.isError ? "error" : "success";
          toolCall.result = mcpResult;
          toolCall.endTime = Date.now();

          const resultText = formatToolResult(mcpResult);
          console.log(`✅ [API] 도구 실행 완료: ${toolInfo.toolName}`, {
            결과길이: resultText.length,
            소요시간: `${toolCall.endTime - (toolCall.startTime || 0)}ms`,
          });

          functionResponses.push({
            functionResponse: {
              name: functionCall.name,
              response: { result: resultText },
            },
          });
        } catch (error) {
          toolCall.status = "error";
          toolCall.error = error instanceof Error ? error.message : String(error);
          toolCall.endTime = Date.now();

          console.error(`❌ [API] 도구 실행 오류: ${toolInfo.toolName}`, error);

          functionResponses.push({
            functionResponse: {
              name: functionCall.name,
              response: { error: toolCall.error },
            },
          });
        }
      }

      // Function 결과를 Gemini에 전달
      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    if (iterationCount >= maxIterations) {
      console.warn("⚠️ [API] 최대 반복 횟수 도달");
      finalResponse = response.text() || "도구 호출이 너무 많아 중단되었습니다.";
    }

    console.log("✅ [API] 최종 응답 생성:", {
      응답길이: finalResponse.length,
      도구호출수: toolCalls.length,
      총처리시간: `${Date.now() - requestStartTime}ms`,
    });

    // JSON 응답 반환 (도구 호출 정보 포함)
    return new Response(
      JSON.stringify({
        content: finalResponse,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    const errorTime = Date.now() - requestStartTime;
    console.error("❌ [API] Chat API Error:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      처리시간: `${errorTime}ms`,
    });
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
