"use client";

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { MemoizedMarkdown } from "./components/MemoizedMarkdown";
import { ChatSidebar } from "./components/ChatSidebar";
import { Snowfall } from "./components/Snowfall";
import { Message, ChatSession } from "./types";
import {
  getSessions,
  createSession,
  updateSessionMessages,
  deleteSession,
  migrateFromLocalStorage,
} from "@/lib/chatStorage";

// 남산한옥마을 배경 이미지 (로컬 이미지)
// 이미지 파일을 public/images/namsan-hanok.jpg 경로에 저장하세요
const BACKGROUND_IMAGE_URL = "/images/namsan-hanok.jpg";

// 눈사람 이미지 URL (Unsplash)
const SNOWMAN_IMAGE_URL = "https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=800&q=80";

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // DB에서 채팅 세션 불러오기 및 localStorage 마이그레이션
  useEffect(() => {
    const loadSessions = async () => {
      try {
        // 먼저 localStorage 데이터가 있으면 마이그레이션
        await migrateFromLocalStorage();

        // DB에서 세션 불러오기
        const dbSessions = await getSessions();
        setSessions(dbSessions);

        // 가장 최근 세션 선택
        if (dbSessions.length > 0) {
          const latestSession = dbSessions.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          setCurrentSessionId(latestSession.id);
          setMessages(latestSession.messages);
        }
      } catch (error) {
        console.error("Failed to load chat sessions:", error);
      }
    };

    loadSessions();
  }, []);

  // 현재 세션의 메시지가 변경될 때 로컬 상태 업데이트
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? { ...session, messages }
            : session
        )
      );
    }
  }, [messages, currentSessionId]);


  // 메시지 목록이 업데이트될 때 스크롤을 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInput("");
  };

  const handleSelectChat = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
    }
  };

  const handleDeleteChat = async (sessionId: string) => {
    // DB에서 삭제
    const success = await deleteSession(sessionId);
    if (!success) {
      console.error("Failed to delete session");
      return;
    }

    // 로컬 상태 업데이트
    setSessions((prev) => {
      const remainingSessions = prev.filter((s) => s.id !== sessionId);

      // 삭제된 세션이 현재 세션이면 다른 세션으로 전환
      if (currentSessionId === sessionId) {
        if (remainingSessions.length > 0) {
          const latestSession = remainingSessions.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          setCurrentSessionId(latestSession.id);
          setMessages(latestSession.messages);
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }

      return remainingSessions;
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const userMessageContent = input.trim();
    const newMessages = [...messages, userMessage];
    
    console.log("📤 메시지 전송 시작:", {
      사용자메시지: userMessageContent,
      현재메시지수: messages.length,
      세션ID: currentSessionId,
    });
    
    // 첫 메시지인 경우 새 세션 생성
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const title =
        userMessageContent.length > 30
          ? userMessageContent.substring(0, 30) + "..."
          : userMessageContent;

      console.log("🆕 새 세션 생성:", { sessionId, title });

      // DB에 세션 생성
      const newSession = await createSession(sessionId, title, newMessages);
      if (newSession) {
        setSessions((prev) => [...prev, newSession]);
        setCurrentSessionId(sessionId);
        console.log("✅ 세션 생성 성공:", sessionId);
      } else {
        console.error("❌ 세션 생성 실패");
        return;
      }
    }

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const requestBody = { messages: newMessages };
      console.log("🌐 API 요청 전송:", {
        url: "/api/chat",
        method: "POST",
        메시지수: newMessages.length,
        요청본문: requestBody,
      });

      const startTime = performance.now();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const requestTime = performance.now() - startTime;
      console.log("📥 API 응답 수신:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        응답시간: `${requestTime.toFixed(2)}ms`,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API 오류 응답:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`응답을 받는 중 오류가 발생했습니다. (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let chunkCount = 0;

      if (reader) {
        console.log("📡 스트리밍 시작");
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("✅ 스트리밍 완료:", {
              총청크수: chunkCount,
              최종메시지길이: assistantMessage.length,
            });
            break;
          }

          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          assistantMessage += chunk;

          if (chunkCount % 10 === 0 || chunkCount === 1) {
            console.log(`📦 청크 수신 [${chunkCount}]:`, {
              청크크기: chunk.length,
              누적길이: assistantMessage.length,
            });
          }

          // 스트리밍 중 실시간 업데이트
          const streamingMessages = [
            ...newMessages,
            { role: "assistant" as const, content: assistantMessage },
          ];
          setMessages(streamingMessages);
        }

        // 스트리밍 완료 후 최종 메시지로 DB 업데이트
        const finalMessages = [
          ...newMessages,
          { role: "assistant" as const, content: assistantMessage },
        ];
        console.log("💾 DB 업데이트 시작:", {
          sessionId,
          총메시지수: finalMessages.length,
        });
        setMessages(finalMessages);
        const updateResult = await updateSessionMessages(sessionId, finalMessages);
        if (updateResult) {
          console.log("✅ DB 업데이트 성공");
        } else {
          console.error("❌ DB 업데이트 실패");
        }
      } else {
        console.error("❌ 응답 스트림을 읽을 수 없습니다");
      }
    } catch (error) {
      console.error("❌ 오류 발생:", {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "오류가 발생했습니다. 다시 시도해주세요.",
        },
      ]);
    } finally {
      setIsLoading(false);
      console.log("🏁 메시지 전송 완료");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen relative">
      {/* 배경 이미지 레이어 */}
      <div
        className="fixed inset-0 z-0 bg-[oklch(0.98_0.01_240)]"
        style={{
          backgroundImage: `url(${BACKGROUND_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      />
      
      {/* 오버레이 레이어 - 텍스트 가독성을 위한 반투명 레이어 (어둡게 조정하여 눈송이 가시성 개선) */}
      <div className="fixed inset-0 z-[1] bg-black/30" />
      
      {/* 눈사람 이미지 레이어 */}
      <div
        className="fixed inset-0 z-[1] flex items-center justify-center pointer-events-none"
      >
        <div
          className="w-96 h-96 md:w-[500px] md:h-[500px]"
          style={{
            backgroundImage: `url(${SNOWMAN_IMAGE_URL})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.7,
          }}
        />
      </div>
      
      {/* 눈 내리는 애니메이션 */}
      <Snowfall count={80} />
      
      {/* 사이드바 */}
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* 헤더 */}
        <header className="border-b border-border px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">AI 채팅</h1>
        </header>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg mb-2">안녕하세요! 무엇을 도와드릴까요?</p>
                  <p className="text-sm">메시지를 입력하고 전송하세요.</p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-[oklch(0.92_0.02_60)] text-[oklch(0.25_0.01_0)]"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <MemoizedMarkdown content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-lg px-4 py-3">
                  <span className="animate-pulse">입력 중...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="border-t border-border px-4 py-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              className="flex-1 min-h-[44px] max-h-[120px] px-4 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="전송"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
