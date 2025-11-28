"use client";

import { useState } from "react";
import {
  Wrench,
  MessageSquare,
  FileText,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  X,
  ZoomIn,
  Image as ImageIcon,
} from "lucide-react";
import type {
  MCPServerState,
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPToolCallResult,
  MCPResourceResult,
} from "@/app/types";

// 결과가 MCPToolCallResult 구조인지 확인하는 타입 가드
function isMCPToolCallResult(value: unknown): value is MCPToolCallResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    Array.isArray((value as MCPToolCallResult).content)
  );
}

// 결과가 MCPResourceResult 구조인지 확인하는 타입 가드
function isMCPResourceResult(value: unknown): value is MCPResourceResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "contents" in value &&
    Array.isArray((value as MCPResourceResult).contents)
  );
}

type TabType = "tools" | "prompts" | "resources";

interface MCPTestPanelProps {
  server: MCPServerState;
  onCallTool: (
    toolName: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
  onGetPrompt: (
    promptName: string,
    args: Record<string, string>
  ) => Promise<unknown>;
  onReadResource: (uri: string) => Promise<unknown>;
}

export function MCPTestPanel({
  server,
  onCallTool,
  onGetPrompt,
  onReadResource,
}: MCPTestPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("tools");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedResult, setCopiedResult] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Tool execution state
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({});

  // Prompt execution state
  const [promptArgs, setPromptArgs] = useState<Record<string, string>>({});

  const tabs: { id: TabType; label: string; icon: typeof Wrench; count: number }[] = [
    { id: "tools", label: "Tools", icon: Wrench, count: server.tools.length },
    { id: "prompts", label: "Prompts", icon: MessageSquare, count: server.prompts.length },
    { id: "resources", label: "Resources", icon: FileText, count: server.resources.length },
  ];

  const handleExecuteTool = async (tool: MCPTool) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Parse JSON values for non-string types
      const parsedArgs: Record<string, unknown> = {};
      Object.entries(toolArgs).forEach(([key, value]) => {
        try {
          parsedArgs[key] = JSON.parse(value);
        } catch {
          parsedArgs[key] = value;
        }
      });

      const response = await onCallTool(tool.name, parsedArgs);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tool execution failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetPrompt = async (prompt: MCPPrompt) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await onGetPrompt(prompt.name, promptArgs);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get prompt");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReadResource = async (resource: MCPResource) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await onReadResource(resource.uri);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read resource");
    } finally {
      setIsLoading(false);
    }
  };

  const copyResult = async () => {
    if (result) {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 2000);
    }
  };

  // 이미지 콘텐츠 렌더링
  const renderImageContent = (data: string, mimeType: string, index: number) => {
    const imageSrc = `data:${mimeType};base64,${data}`;
    return (
      <div key={`image-${index}`} className="relative group">
        <img
          src={imageSrc}
          alt={`Result image ${index + 1}`}
          className="max-w-full h-auto rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
          style={{ maxHeight: "300px", objectFit: "contain" }}
          onClick={() => setZoomedImage(imageSrc)}
        />
        <button
          onClick={() => setZoomedImage(imageSrc)}
          className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="확대 보기"
        >
          <ZoomIn size={16} />
        </button>
      </div>
    );
  };

  // 텍스트 콘텐츠 렌더링
  const renderTextContent = (text: string, index: number) => {
    return (
      <pre
        key={`text-${index}`}
        className="p-3 rounded-lg text-sm overflow-auto bg-muted border border-border whitespace-pre-wrap"
      >
        {text}
      </pre>
    );
  };

  // MCPToolCallResult 결과 렌더링
  const renderToolCallResult = (toolResult: MCPToolCallResult) => {
    const hasImages = toolResult.content.some((c) => c.type === "image");
    const hasMultipleImages = toolResult.content.filter((c) => c.type === "image").length > 1;

    return (
      <div className={`space-y-3 ${hasMultipleImages ? "grid grid-cols-2 gap-3" : ""}`}>
        {toolResult.content.map((content, index) => {
          if (content.type === "image" && content.data && content.mimeType) {
            return (
              <div key={index} className={hasMultipleImages ? "" : ""}>
                {renderImageContent(content.data, content.mimeType, index)}
              </div>
            );
          } else if (content.type === "text" && content.text) {
            return (
              <div key={index} className={hasMultipleImages ? "col-span-2" : ""}>
                {renderTextContent(content.text, index)}
              </div>
            );
          } else if (content.type === "resource") {
            return (
              <div key={index} className={hasMultipleImages ? "col-span-2" : ""}>
                <pre className="p-3 rounded-lg text-sm overflow-auto bg-muted border border-border whitespace-pre-wrap">
                  {content.text || JSON.stringify(content, null, 2)}
                </pre>
              </div>
            );
          }
          // 기타 타입은 JSON으로 표시
          return (
            <div key={index} className={hasMultipleImages ? "col-span-2" : ""}>
              <pre className="p-3 rounded-lg text-sm overflow-auto bg-muted border border-border">
                {JSON.stringify(content, null, 2)}
              </pre>
            </div>
          );
        })}
        {!hasImages && toolResult.isError && (
          <p className="text-sm text-red-500">실행 중 오류가 발생했습니다.</p>
        )}
      </div>
    );
  };

  // MCPResourceResult 결과 렌더링
  const renderResourceResult = (resourceResult: MCPResourceResult) => {
    return (
      <div className="space-y-3">
        {resourceResult.contents.map((content, index) => {
          // blob이 있고 mimeType이 이미지인 경우
          if (content.blob && content.mimeType?.startsWith("image/")) {
            return (
              <div key={index}>
                {renderImageContent(content.blob, content.mimeType, index)}
              </div>
            );
          }
          // 텍스트 콘텐츠
          if (content.text) {
            return (
              <div key={index}>
                <p className="text-xs text-muted-foreground mb-1">URI: {content.uri}</p>
                {renderTextContent(content.text, index)}
              </div>
            );
          }
          // 기타
          return (
            <pre key={index} className="p-3 rounded-lg text-sm overflow-auto bg-muted border border-border">
              {JSON.stringify(content, null, 2)}
            </pre>
          );
        })}
      </div>
    );
  };

  // 결과 렌더링 메인 함수
  const renderResult = () => {
    if (!result) return null;

    // MCPToolCallResult 구조 확인
    if (isMCPToolCallResult(result)) {
      return renderToolCallResult(result);
    }

    // MCPResourceResult 구조 확인
    if (isMCPResourceResult(result)) {
      return renderResourceResult(result);
    }

    // 기타 결과는 JSON으로 표시
    return (
      <pre className="p-3 rounded-lg text-sm overflow-auto max-h-64 bg-muted border border-border">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  // 결과에 이미지가 포함되어 있는지 확인
  const hasImageInResult = (): boolean => {
    if (isMCPToolCallResult(result)) {
      return result.content.some((c) => c.type === "image");
    }
    if (isMCPResourceResult(result)) {
      return result.contents.some(
        (c) => c.blob && c.mimeType?.startsWith("image/")
      );
    }
    return false;
  };

  const renderToolItem = (tool: MCPTool) => {
    const isExpanded = expandedItem === `tool-${tool.name}`;
    const properties = tool.inputSchema.properties || {};
    const required = tool.inputSchema.required || [];

    return (
      <div key={tool.name} className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setExpandedItem(isExpanded ? null : `tool-${tool.name}`);
            setToolArgs({});
            setResult(null);
            setError(null);
          }}
          className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors text-left"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Wrench size={16} className="text-purple-500" />
          <span className="font-medium">{tool.name}</span>
        </button>

        {isExpanded && (
          <div className="p-3 border-t border-border bg-muted/30">
            {tool.description && (
              <p className="text-sm text-muted-foreground mb-3">{tool.description}</p>
            )}

            {Object.keys(properties).length > 0 && (
              <div className="space-y-3 mb-4">
                <h4 className="text-sm font-medium">Parameters</h4>
                {Object.entries(properties).map(([key, schema]) => {
                  const propSchema = schema as { type?: string; description?: string };
                  return (
                    <div key={key}>
                      <label className="block text-sm mb-1">
                        {key}
                        {required.includes(key) && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                        {propSchema.type && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({propSchema.type})
                          </span>
                        )}
                      </label>
                      {propSchema.description && (
                        <p className="text-xs text-muted-foreground mb-1">
                          {propSchema.description}
                        </p>
                      )}
                      <input
                        type="text"
                        value={toolArgs[key] || ""}
                        onChange={(e) =>
                          setToolArgs((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={propSchema.type === "object" || propSchema.type === "array" ? "JSON format" : ""}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => handleExecuteTool(tool)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              실행
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderPromptItem = (prompt: MCPPrompt) => {
    const isExpanded = expandedItem === `prompt-${prompt.name}`;

    return (
      <div key={prompt.name} className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setExpandedItem(isExpanded ? null : `prompt-${prompt.name}`);
            setPromptArgs({});
            setResult(null);
            setError(null);
          }}
          className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors text-left"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <MessageSquare size={16} className="text-blue-500" />
          <span className="font-medium">{prompt.name}</span>
        </button>

        {isExpanded && (
          <div className="p-3 border-t border-border bg-muted/30">
            {prompt.description && (
              <p className="text-sm text-muted-foreground mb-3">{prompt.description}</p>
            )}

            {prompt.arguments && prompt.arguments.length > 0 && (
              <div className="space-y-3 mb-4">
                <h4 className="text-sm font-medium">Arguments</h4>
                {prompt.arguments.map((arg) => (
                  <div key={arg.name}>
                    <label className="block text-sm mb-1">
                      {arg.name}
                      {arg.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {arg.description && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {arg.description}
                      </p>
                    )}
                    <input
                      type="text"
                      value={promptArgs[arg.name] || ""}
                      onChange={(e) =>
                        setPromptArgs((prev) => ({ ...prev, [arg.name]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => handleGetPrompt(prompt)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              가져오기
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderResourceItem = (resource: MCPResource) => {
    const isExpanded = expandedItem === `resource-${resource.uri}`;

    return (
      <div key={resource.uri} className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setExpandedItem(isExpanded ? null : `resource-${resource.uri}`);
            setResult(null);
            setError(null);
          }}
          className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors text-left"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <FileText size={16} className="text-green-500" />
          <div className="flex-1 min-w-0">
            <span className="font-medium block truncate">{resource.name}</span>
            <span className="text-xs text-muted-foreground block truncate">
              {resource.uri}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="p-3 border-t border-border bg-muted/30">
            {resource.description && (
              <p className="text-sm text-muted-foreground mb-3">{resource.description}</p>
            )}
            {resource.mimeType && (
              <p className="text-xs text-muted-foreground mb-3">
                MIME Type: {resource.mimeType}
              </p>
            )}

            <button
              onClick={() => handleReadResource(resource)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              읽기
            </button>
          </div>
        )}
      </div>
    );
  };

  if (server.status !== "connected") {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>서버에 연결되어 있지 않습니다.</p>
        <p className="text-sm mt-1">서버를 연결한 후 기능을 테스트할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setExpandedItem(null);
                setResult(null);
                setError(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {tab.label}
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {activeTab === "tools" && (
          <>
            {server.tools.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                사용 가능한 Tool이 없습니다.
              </p>
            ) : (
              server.tools.map(renderToolItem)
            )}
          </>
        )}

        {activeTab === "prompts" && (
          <>
            {server.prompts.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                사용 가능한 Prompt가 없습니다.
              </p>
            ) : (
              server.prompts.map(renderPromptItem)
            )}
          </>
        )}

        {activeTab === "resources" && (
          <>
            {server.resources.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                사용 가능한 Resource가 없습니다.
              </p>
            ) : (
              server.resources.map(renderResourceItem)
            )}
          </>
        )}
      </div>

      {/* Result/Error Display */}
      {(result || error) && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              {error ? "오류" : "결과"}
              {hasImageInResult() && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ImageIcon size={12} />
                  이미지 포함
                </span>
              )}
            </h4>
            {result && (
              <button
                onClick={copyResult}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedResult ? <Check size={14} /> : <Copy size={14} />}
                {copiedResult ? "복사됨" : "복사"}
              </button>
            )}
          </div>
          {error ? (
            <pre className="p-3 rounded-lg text-sm overflow-auto max-h-64 bg-red-50 text-red-700 border border-red-200">
              {error}
            </pre>
          ) : (
            <div className="max-h-96 overflow-auto">
              {renderResult()}
            </div>
          )}
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
              title="닫기"
            >
              <X size={24} />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed image"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

