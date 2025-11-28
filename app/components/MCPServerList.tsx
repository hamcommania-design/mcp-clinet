"use client";

import {
  Server,
  Plug,
  Unplug,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { MCPServerState } from "@/app/types";

interface MCPServerListProps {
  servers: MCPServerState[];
  selectedServerId: string | null;
  onSelectServer: (serverId: string) => void;
  onConnect: (serverId: string) => void;
  onDisconnect: (serverId: string) => void;
  onEdit: (serverId: string) => void;
  onDelete: (serverId: string) => void;
  onRefresh: (serverId: string) => void;
  isConnecting: string | null;
}

export function MCPServerList({
  servers,
  selectedServerId,
  onSelectServer,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onRefresh,
  isConnecting,
}: MCPServerListProps) {
  const getStatusIcon = (server: MCPServerState) => {
    if (isConnecting === server.config.id) {
      return <Loader2 size={16} className="animate-spin text-blue-500" />;
    }
    switch (server.status) {
      case "connected":
        return <CheckCircle2 size={16} className="text-green-500" />;
      case "connecting":
        return <Loader2 size={16} className="animate-spin text-blue-500" />;
      case "error":
        return <AlertCircle size={16} className="text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusText = (server: MCPServerState) => {
    if (isConnecting === server.config.id) return "연결 중...";
    switch (server.status) {
      case "connected":
        return "연결됨";
      case "connecting":
        return "연결 중...";
      case "error":
        return server.error || "오류";
      default:
        return "연결 안됨";
    }
  };

  const getTransportBadge = (transport: string) => {
    const colors: Record<string, string> = {
      stdio: "bg-purple-100 text-purple-700",
      sse: "bg-blue-100 text-blue-700",
      "streamable-http": "bg-green-100 text-green-700",
    };
    return colors[transport] || "bg-gray-100 text-gray-700";
  };

  if (servers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Server size={48} className="mx-auto mb-4 opacity-50" />
        <p>등록된 MCP 서버가 없습니다.</p>
        <p className="text-sm mt-1">새 서버를 추가해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {servers.map((server) => (
        <div
          key={server.config.id}
          className={`p-4 rounded-lg border transition-colors cursor-pointer ${
            selectedServerId === server.config.id
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onClick={() => onSelectServer(server.config.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getStatusIcon(server)}
                <h3 className="font-medium truncate">{server.config.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${getTransportBadge(
                    server.config.transport
                  )}`}
                >
                  {server.config.transport.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {server.config.transport === "stdio"
                  ? `${server.config.command} ${server.config.args?.join(" ") || ""}`
                  : server.config.url}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {getStatusText(server)}
              </p>
              {server.status === "error" && server.suggestion && (
                <div className="mt-2 p-2 rounded bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>💡 제안:</strong> {server.suggestion}
                  </p>
                </div>
              )}
              {server.status === "connected" && (
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Tools: {server.tools.length}</span>
                  <span>Prompts: {server.prompts.length}</span>
                  <span>Resources: {server.resources.length}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {server.status === "connected" ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefresh(server.config.id);
                    }}
                    className="p-2 rounded hover:bg-muted transition-colors"
                    title="새로고침"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDisconnect(server.config.id);
                    }}
                    className="p-2 rounded hover:bg-muted transition-colors text-red-500"
                    title="연결 해제"
                  >
                    <Unplug size={16} />
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConnect(server.config.id);
                  }}
                  disabled={isConnecting === server.config.id}
                  className="p-2 rounded hover:bg-muted transition-colors text-green-600 disabled:opacity-50"
                  title="연결"
                >
                  <Plug size={16} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(server.config.id);
                }}
                className="p-2 rounded hover:bg-muted transition-colors"
                title="수정"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(server.config.id);
                }}
                className="p-2 rounded hover:bg-muted transition-colors text-red-500"
                title="삭제"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

