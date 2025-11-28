"use client";

import { Plus, Trash2 } from "lucide-react";
import { ChatSession } from "../types";

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectChat: (sessionId: string) => void;
  onDeleteChat: (sessionId: string) => void;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: ChatSidebarProps) {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="w-64 border-r border-border bg-sidebar flex flex-col h-screen relative z-10">
      {/* 새 채팅 버튼 */}
      <div className="p-4 border-b border-border">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} />
          <span>새 채팅</span>
        </button>
      </div>

      {/* 채팅 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {sortedSessions.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            채팅 내역이 없습니다
          </div>
        ) : (
          <div className="space-y-1">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  currentSessionId === session.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => onSelectChat(session.id)}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium truncate ${
                      currentSessionId === session.id
                        ? "text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {session.title}
                  </div>
                  <div
                    className={`text-xs truncate ${
                      currentSessionId === session.id
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {new Date(session.createdAt).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("이 채팅을 삭제하시겠습니까?")) {
                      onDeleteChat(session.id);
                    }
                  }}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/20 transition-opacity ${
                    currentSessionId === session.id
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                  aria-label="채팅 삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

