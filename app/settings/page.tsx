"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Download,
  Upload,
  AlertCircle,
} from "lucide-react";
import { useMCP } from "@/app/contexts/MCPContext";
import { MCPServerForm } from "@/app/components/MCPServerForm";
import { MCPServerList } from "@/app/components/MCPServerList";
import { MCPTestPanel } from "@/app/components/MCPTestPanel";
import type { MCPServerConfig, MCPSettings } from "@/app/types";

export default function SettingsPage() {
  const {
    servers,
    addServer,
    updateServer,
    removeServer,
    connectServer,
    disconnectServer,
    refreshServerCapabilities,
    callTool,
    getPrompt,
    readResource,
    exportSettings,
    importSettings,
  } = useMCP();

  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedServer = servers.find((s) => s.config.id === selectedServerId);

  const handleAddServer = (config: MCPServerConfig) => {
    addServer(config);
    setShowForm(false);
    setSelectedServerId(config.id);
  };

  const handleUpdateServer = (config: MCPServerConfig) => {
    updateServer(config);
    setEditingServer(null);
  };

  const handleEditServer = (serverId: string) => {
    const server = servers.find((s) => s.config.id === serverId);
    if (server) {
      setEditingServer(server.config);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (confirm("정말 이 서버를 삭제하시겠습니까?")) {
      await removeServer(serverId);
      if (selectedServerId === serverId) {
        setSelectedServerId(null);
      }
    }
  };

  const handleConnect = async (serverId: string) => {
    setError(null);
    setIsConnecting(serverId);
    try {
      await connectServer(serverId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "연결에 실패했습니다.");
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (serverId: string) => {
    setError(null);
    try {
      await disconnectServer(serverId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "연결 해제에 실패했습니다.");
    }
  };

  const handleRefresh = async (serverId: string) => {
    setError(null);
    try {
      await refreshServerCapabilities(serverId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "새로고침에 실패했습니다.");
    }
  };

  const handleExport = () => {
    const settings = exportSettings();
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcp-settings-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const settings: MCPSettings = JSON.parse(event.target?.result as string);
        if (confirm(`${settings.servers?.length || 0}개의 서버 설정을 가져오시겠습니까? 기존 설정이 대체됩니다.`)) {
          importSettings(settings);
          setSelectedServerId(null);
        }
      } catch {
        setError("잘못된 설정 파일입니다.");
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCallTool = async (toolName: string, args: Record<string, unknown>) => {
    if (!selectedServerId) throw new Error("No server selected");
    return callTool(selectedServerId, toolName, args);
  };

  const handleGetPrompt = async (promptName: string, args: Record<string, string>) => {
    if (!selectedServerId) throw new Error("No server selected");
    return getPrompt(selectedServerId, promptName, args);
  };

  const handleReadResource = async (uri: string) => {
    if (!selectedServerId) throw new Error("No server selected");
    return readResource(selectedServerId, uri);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded hover:bg-muted transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-semibold">MCP 서버 설정</h1>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-input hover:bg-muted transition-colors"
            >
              <Upload size={16} />
              가져오기
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-input hover:bg-muted transition-colors"
            >
              <Download size={16} />
              내보내기
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              서버 추가
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-sm text-red-600 hover:underline mt-1"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* Security Warning */}
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>보안 주의:</strong> 공용 또는 공유 PC에서는 민감한 정보(API 키, 인증 토큰 등)를
            서버 설정에 저장하지 마세요. 설정은 브라우저의 localStorage에 저장됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Server List */}
          <div>
            <h2 className="text-lg font-medium mb-4">등록된 서버</h2>
            <MCPServerList
              servers={servers}
              selectedServerId={selectedServerId}
              onSelectServer={setSelectedServerId}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onEdit={handleEditServer}
              onDelete={handleDeleteServer}
              onRefresh={handleRefresh}
              isConnecting={isConnecting}
            />
          </div>

          {/* Test Panel */}
          <div>
            <h2 className="text-lg font-medium mb-4">
              {selectedServer
                ? `${selectedServer.config.name} - 기능 테스트`
                : "서버 기능 테스트"}
            </h2>
            {selectedServer ? (
              <MCPTestPanel
                server={selectedServer}
                onCallTool={handleCallTool}
                onGetPrompt={handleGetPrompt}
                onReadResource={handleReadResource}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                <p>서버를 선택하면 기능을 테스트할 수 있습니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add/Edit Server Form Modal */}
      {showForm && (
        <MCPServerForm
          onSubmit={handleAddServer}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingServer && (
        <MCPServerForm
          server={editingServer}
          onSubmit={handleUpdateServer}
          onCancel={() => setEditingServer(null)}
        />
      )}
    </div>
  );
}

