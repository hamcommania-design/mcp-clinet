"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { MCPServerConfig, MCPTransportType } from "@/app/types";

interface MCPServerFormProps {
  server?: MCPServerConfig;
  onSubmit: (config: MCPServerConfig) => void;
  onCancel: () => void;
}

export function MCPServerForm({ server, onSubmit, onCancel }: MCPServerFormProps) {
  const [name, setName] = useState(server?.name || "");
  const [transport, setTransport] = useState<MCPTransportType>(
    server?.transport || "stdio"
  );
  const [command, setCommand] = useState(server?.command || "");
  const [args, setArgs] = useState(server?.args?.join(" ") || "");
  const [envVars, setEnvVars] = useState(
    server?.env ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join("\n") : ""
  );
  const [url, setUrl] = useState(server?.url || "");

  const isEditing = !!server;

  useEffect(() => {
    if (server) {
      setName(server.name);
      setTransport(server.transport);
      setCommand(server.command || "");
      setArgs(server.args?.join(" ") || "");
      setEnvVars(
        server.env
          ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join("\n")
          : ""
      );
      setUrl(server.url || "");
    }
  }, [server]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const config: MCPServerConfig = {
      id: server?.id || `server-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      transport,
    };

    if (transport === "stdio") {
      config.command = command.trim();
      config.args = args.trim() ? args.trim().split(/\s+/) : [];
      if (envVars.trim()) {
        config.env = {};
        envVars.trim().split("\n").forEach((line) => {
          const [key, ...valueParts] = line.split("=");
          if (key && valueParts.length > 0) {
            config.env![key.trim()] = valueParts.join("=").trim();
          }
        });
      }
    } else {
      config.url = url.trim();
    }

    onSubmit(config);
  };

  const isValid = () => {
    if (!name.trim()) return false;
    if (transport === "stdio" && !command.trim()) return false;
    if ((transport === "sse" || transport === "streamable-http") && !url.trim()) return false;
    return true;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div 
        className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {isEditing ? "서버 수정" : "새 MCP 서버 추가"}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">서버 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: My MCP Server"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Transport 타입</label>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value as MCPTransportType)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="stdio">STDIO</option>
              <option value="sse">SSE</option>
              <option value="streamable-http">Streamable HTTP</option>
            </select>
          </div>

          {transport === "stdio" ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">명령어</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="예: npx, node, python"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  인수 (Arguments)
                </label>
                <input
                  type="text"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="예: -y @modelcontextprotocol/server-filesystem"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  공백으로 구분된 인수들
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  환경 변수 (선택)
                </label>
                <textarea
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                  placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  각 줄에 KEY=value 형식으로 입력
                </p>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">서버 URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="예: http://localhost:3001/sse"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-md border border-input bg-background hover:bg-muted transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!isValid()}
              className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isEditing ? "수정" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

