"use client";

import { useState, useEffect, useRef } from "react";
import { Wrench, ChevronDown, Check } from "lucide-react";
import { useMCP } from "@/app/contexts/MCPContext";
import type { EnabledTool, MCPTool } from "@/app/types";

interface MCPToolToggleProps {
  enabledTools: EnabledTool[];
  onToolsChange: (tools: EnabledTool[]) => void;
  mcpEnabled: boolean;
  onMcpEnabledChange: (enabled: boolean) => void;
}

interface ServerToolGroup {
  serverId: string;
  serverName: string;
  tools: MCPTool[];
  isConnected: boolean;
}

// Time Server MCP 도구 설명 한글 번역
const TOOL_DESCRIPTIONS_KR: Record<string, Record<string, string>> = {
  "time-server": {
    "get_current_time": "지정된 타임존의 현재 시간을 가져옵니다. 타임존을 지정하지 않으면 시스템 기본 타임존을 사용합니다.",
    "convert_time": "한 타임존에서 다른 타임존으로 시간을 변환합니다. 원본 시간, 원본 타임존, 대상 타임존을 지정할 수 있습니다.",
  },
};

// 도구 설명을 한글로 가져오는 함수
function getToolDescription(serverId: string, toolName: string, originalDescription?: string): string {
  const serverTranslations = TOOL_DESCRIPTIONS_KR[serverId];
  if (serverTranslations && serverTranslations[toolName]) {
    return serverTranslations[toolName];
  }
  return originalDescription || "";
}

export function MCPToolToggle({
  enabledTools,
  onToolsChange,
  mcpEnabled,
  onMcpEnabledChange,
}: MCPToolToggleProps) {
  const { servers, getConnectedServers } = useMCP();
  const [isOpen, setIsOpen] = useState(false);
  const [serverTools, setServerTools] = useState<ServerToolGroup[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 연결된 서버들의 도구 목록 로드
  useEffect(() => {
    getConnectedServers();
    const toolGroups: ServerToolGroup[] = servers.map((server) => ({
      serverId: server.config.id,
      serverName: server.config.name,
      tools: server.tools || [],
      isConnected: server.status === "connected",
    }));
    setServerTools(toolGroups);
  }, [servers, getConnectedServers]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 도구 토글
  const toggleTool = (serverId: string, serverName: string, tool: MCPTool) => {
    const isEnabled = enabledTools.some(
      (t) => t.serverId === serverId && t.toolName === tool.name
    );

    if (isEnabled) {
      onToolsChange(
        enabledTools.filter(
          (t) => !(t.serverId === serverId && t.toolName === tool.name)
        )
      );
    } else {
      onToolsChange([
        ...enabledTools,
        {
          serverId,
          serverName,
          toolName: tool.name,
          description: tool.description,
        },
      ]);
    }
  };

  // 서버의 모든 도구 토글
  const toggleAllServerTools = (serverGroup: ServerToolGroup) => {
    const serverToolsEnabled = serverGroup.tools.filter((tool) =>
      enabledTools.some(
        (t) => t.serverId === serverGroup.serverId && t.toolName === tool.name
      )
    );

    if (serverToolsEnabled.length === serverGroup.tools.length) {
      // 모두 활성화되어 있으면 모두 비활성화
      onToolsChange(
        enabledTools.filter((t) => t.serverId !== serverGroup.serverId)
      );
    } else {
      // 일부만 활성화되어 있으면 모두 활성화
      const newTools = serverGroup.tools
        .filter(
          (tool) =>
            !enabledTools.some(
              (t) => t.serverId === serverGroup.serverId && t.toolName === tool.name
            )
        )
        .map((tool) => ({
          serverId: serverGroup.serverId,
          serverName: serverGroup.serverName,
          toolName: tool.name,
          description: tool.description,
        }));
      onToolsChange([...enabledTools, ...newTools]);
    }
  };

  // 연결된 서버 수
  const connectedCount = serverTools.filter((s) => s.isConnected).length;
  const totalToolCount = serverTools
    .filter((s) => s.isConnected)
    .reduce((sum, s) => sum + s.tools.length, 0);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
          mcpEnabled && enabledTools.length > 0
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        <Wrench size={14} />
        <span>
          도구 {enabledTools.length}/{totalToolCount}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-background border border-border rounded-lg shadow-lg z-50">
          {/* MCP 활성화 토글 */}
          <div className="p-3 border-b border-border">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-medium">MCP 도구 사용</span>
              <button
                onClick={() => onMcpEnabledChange(!mcpEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  mcpEnabled ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    mcpEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </label>
            {connectedCount === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                연결된 MCP 서버가 없습니다. 설정에서 서버를 연결하세요.
              </p>
            )}
          </div>

          {/* 서버별 도구 목록 */}
          {mcpEnabled && (
            <div className="p-2">
              {serverTools.map((serverGroup) => (
                <div key={serverGroup.serverId} className="mb-3 last:mb-0">
                  {/* 서버 헤더 */}
                  <div
                    className={`flex items-center justify-between px-2 py-1.5 rounded ${
                      serverGroup.isConnected
                        ? "bg-muted/50"
                        : "bg-gray-100 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          serverGroup.isConnected ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      <span className="font-medium text-sm">
                        {serverGroup.serverName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({serverGroup.tools.length})
                      </span>
                    </div>
                    {serverGroup.isConnected && serverGroup.tools.length > 0 && (
                      <button
                        onClick={() => toggleAllServerTools(serverGroup)}
                        className="text-xs text-primary hover:underline"
                      >
                        {serverGroup.tools.every((tool) =>
                          enabledTools.some(
                            (t) =>
                              t.serverId === serverGroup.serverId &&
                              t.toolName === tool.name
                          )
                        )
                          ? "모두 해제"
                          : "모두 선택"}
                      </button>
                    )}
                  </div>

                  {/* 도구 목록 */}
                  {serverGroup.isConnected && serverGroup.tools.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {serverGroup.tools.map((tool) => {
                        const isEnabled = enabledTools.some(
                          (t) =>
                            t.serverId === serverGroup.serverId &&
                            t.toolName === tool.name
                        );
                        return (
                          <button
                            key={tool.name}
                            onClick={() =>
                              toggleTool(
                                serverGroup.serverId,
                                serverGroup.serverName,
                                tool
                              )
                            }
                            className={`w-full flex items-start gap-2 px-3 py-2 rounded text-left text-sm transition-colors ${
                              isEnabled
                                ? "bg-emerald-50 hover:bg-emerald-100"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <span
                              className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border flex items-center justify-center ${
                                isEnabled
                                  ? "bg-emerald-500 border-emerald-500"
                                  : "border-gray-300"
                              }`}
                            >
                              {isEnabled && (
                                <Check size={12} className="text-white" />
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {tool.name}
                              </div>
                              {(tool.description || TOOL_DESCRIPTIONS_KR[serverGroup.serverId]?.[tool.name]) && (
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {getToolDescription(serverGroup.serverId, tool.name, tool.description)}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : serverGroup.isConnected ? (
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      사용 가능한 도구가 없습니다.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      서버가 연결되어 있지 않습니다.
                    </p>
                  )}
                </div>
              ))}

              {serverTools.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  등록된 MCP 서버가 없습니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

