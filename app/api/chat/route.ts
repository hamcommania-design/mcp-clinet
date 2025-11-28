import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();
  console.log("🔵 [API] 채팅 요청 수신:", {
    timestamp: new Date().toISOString(),
    url: req.url,
  });

  try {
    const { messages } = await req.json();

    console.log("📨 [API] 요청 데이터:", {
      메시지수: messages?.length || 0,
      마지막메시지: messages?.[messages.length - 1]?.content?.substring(0, 50) || "없음",
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

    // 마지막 사용자 메시지 추출
    const userMessage = messages[messages.length - 1]?.content || "";
    if (!userMessage) {
      console.error("❌ [API] 메시지가 없습니다.");
      return new Response(
        JSON.stringify({ error: "메시지가 없습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 이전 대화 내역을 히스토리로 변환
    const chatHistory = messages.slice(0, -1).map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    console.log("🤖 [API] Gemini 모델 호출 시작:", {
      모델: "gemini-2.0-flash-001",
      히스토리길이: chatHistory.length,
      사용자메시지길이: userMessage.length,
    });

    // 스트리밍 응답 생성
    const chat = model.startChat({
      history: chatHistory,
    });

    const geminiStartTime = Date.now();
    const result = await chat.sendMessageStream(userMessage);
    const geminiResponseTime = Date.now() - geminiStartTime;

    console.log("✅ [API] Gemini 응답 수신:", {
      응답시간: `${geminiResponseTime}ms`,
    });

    let chunkCount = 0;
    let totalBytes = 0;

    // ReadableStream 생성
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            chunkCount++;
            const chunkText = chunk.text();
            const encodedChunk = encoder.encode(chunkText);
            totalBytes += encodedChunk.length;
            controller.enqueue(encodedChunk);

            if (chunkCount % 10 === 0 || chunkCount === 1) {
              console.log(`📦 [API] 청크 전송 [${chunkCount}]:`, {
                청크크기: chunkText.length,
                누적바이트: totalBytes,
              });
            }
          }
          console.log("✅ [API] 스트리밍 완료:", {
            총청크수: chunkCount,
            총바이트: totalBytes,
            총처리시간: `${Date.now() - requestStartTime}ms`,
          });
          controller.close();
        } catch (error) {
          console.error("❌ [API] 스트리밍 오류:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
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

