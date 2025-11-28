"use client";

import { useState } from "react";
import {
  Wrench,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  Clock,
  Server,
} from "lucide-react";
import type { ToolCall } from "@/app/types";

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
}

function formatDuration(startTime?: number, endTime?: number): string {
  if (!startTime) return "-";
  const end = endTime || Date.now();
  const duration = end - startTime;
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
}

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = {
    pending: <Clock size={14} className="text-gray-400" />,
    running: <Loader2 size={14} className="text-blue-500 animate-spin" />,
    success: <Check size={14} className="text-emerald-500" />,
    error: <X size={14} className="text-red-500" />,
  };

  const statusColor = {
    pending: "bg-gray-100 border-gray-200",
    running: "bg-blue-50 border-blue-200",
    success: "bg-emerald-50 border-emerald-200",
    error: "bg-red-50 border-red-200",
  };

  // 결과 텍스트 추출 (이미지 제외)
  const getResultText = () => {
    if (toolCall.error) return toolCall.error;
    if (!toolCall.result) return null;
    
    return toolCall.result.content
      .filter((c) => c.type !== "image") // 이미지는 별도로 렌더링
      .map((c) => {
        if (c.type === "text" && c.text) return c.text;
        if (c.type === "resource") return c.text || "[리소스]";
        return `[${c.type}]`;
      })
      .join("\n");
  };

  // 이미지 콘텐츠 추출 (URL 또는 base64 데이터가 있는 것)
  const getImageContents = () => {
    if (!toolCall.result) return [];
    return toolCall.result.content.filter(
      (c) => c.type === "image" && (c.url || c.data)
    );
  };

  const resultText = getResultText();
  const imageContents = getImageContents();

  return (
    <div
      className={`rounded-lg border ${statusColor[toolCall.status]} overflow-hidden`}
    >
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
        )}
        
        <Wrench size={14} className="text-muted-foreground flex-shrink-0" />
        
        <span className="font-medium text-sm flex-1 truncate">
          {toolCall.toolName}
        </span>
        
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Server size={12} />
          {toolCall.serverName}
        </span>
        
        <span className="text-xs text-muted-foreground">
          {formatDuration(toolCall.startTime, toolCall.endTime)}
        </span>
        
        {statusIcon[toolCall.status]}
      </button>

      {/* 확장된 내용 */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-inherit">
          {/* 인자 */}
          {Object.keys(toolCall.args).length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                입력 인자
              </div>
              <pre className="text-xs bg-black/5 rounded p-2 overflow-x-auto">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}

          {/* 이미지 결과 */}
          {imageContents.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                생성된 이미지
              </div>
              <div className="space-y-2">
                {imageContents.map((img, idx) => {
                  // Storage URL이 있으면 우선 사용, 없으면 base64 데이터 URL 사용
                  const imageUrl = img.url 
                    ? img.url
                    : img.data 
                    ? `data:${img.mimeType || "image/png"};base64,${img.data}`
                    : null;
                  
                  if (!imageUrl) return null;
                  
                  return (
                    <div key={idx} className="rounded-lg overflow-hidden border border-border">
                      <img
                        src={imageUrl}
                        alt={`도구 ${toolCall.toolName}에서 생성된 이미지 ${idx + 1}`}
                        className="w-full h-auto max-w-full"
                        style={{ maxHeight: "500px", objectFit: "contain" }}
                        onError={(e) => {
                          // 이미지 로드 실패 시 fallback 처리
                          console.error('이미지 로드 실패:', imageUrl);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 텍스트 결과 */}
          {resultText && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {toolCall.error ? "오류" : "결과"}
              </div>
              <pre
                className={`text-xs rounded p-2 overflow-x-auto whitespace-pre-wrap break-words ${
                  toolCall.error
                    ? "bg-red-100 text-red-700"
                    : "bg-black/5 text-foreground"
                }`}
              >
                {resultText}
              </pre>
            </div>
          )}

          {/* 실행 중 상태 */}
          {toolCall.status === "running" && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 size={14} className="animate-spin" />
              도구 실행 중...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const successCount = toolCalls.filter((t) => t.status === "success").length;
  const errorCount = toolCalls.filter((t) => t.status === "error").length;
  const runningCount = toolCalls.filter((t) => t.status === "running").length;

  return (
    <div className="space-y-2">
      {/* 요약 헤더 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Wrench size={14} />
        <span>
          도구 호출 {toolCalls.length}건
          {successCount > 0 && (
            <span className="text-emerald-600 ml-1">
              (성공 {successCount})
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-red-600 ml-1">(실패 {errorCount})</span>
          )}
          {runningCount > 0 && (
            <span className="text-blue-600 ml-1">(실행 중 {runningCount})</span>
          )}
        </span>
      </div>

      {/* 도구 호출 목록 */}
      <div className="space-y-2">
        {toolCalls.map((toolCall) => (
          <ToolCallItem key={toolCall.id} toolCall={toolCall} />
        ))}
      </div>
    </div>
  );
}

