"use client";

import { memo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

interface MemoizedMarkdownProps {
  content: string;
}

const CodeBlock = memo(
  ({
    inline,
    className,
    children,
    ...props
  }: {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  }) => {
    const [copied, setCopied] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const codeString = String(children).replace(/\n$/, "");

    useEffect(() => {
      const checkDarkMode = () => {
        setIsDark(
          document.documentElement.classList.contains("dark") ||
          (!document.documentElement.classList.contains("light") &&
            window.matchMedia("(prefers-color-scheme: dark)").matches)
        );
      };
      checkDarkMode();
      const observer = new MutationObserver(checkDarkMode);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    }, []);

    const handleCopy = async () => {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    if (inline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }

    return (
      <div className="relative group my-4">
        <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
          {language && (
            <span className="text-xs text-muted-foreground font-mono px-2 py-1 bg-background/80 rounded">
              {language}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded bg-background/80 hover:bg-background border border-border transition-colors"
            aria-label="코드 복사"
          >
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} className="text-foreground" />
            )}
          </button>
        </div>
        <SyntaxHighlighter
          language={language || "text"}
          style={isDark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            borderRadius: "0.5rem",
            padding: "1rem",
            fontSize: "0.875rem",
            background: isDark ? "rgb(30, 30, 30)" : "rgb(250, 250, 250)",
          }}
          PreTag="div"
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }
);

CodeBlock.displayName = "CodeBlock";

export const MemoizedMarkdown = memo(({ content }: MemoizedMarkdownProps) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-words"
            />
          ),
          p: ({ node, ...props }) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-1 ml-2" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-1 ml-2" {...props} />,
          li: ({ node, ...props }) => <li className="ml-2" {...props} />,
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3 first:mt-0" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-4 mb-2 first:mt-0" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-base font-bold mt-3 mb-2 first:mt-0" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-muted-foreground pl-4 italic my-4 text-muted-foreground" {...props} />
          ),
          hr: ({ node, ...props }) => <hr className="my-4 border-border" {...props} />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-border px-4 py-2 bg-muted font-semibold text-left" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-border px-4 py-2" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MemoizedMarkdown.displayName = "MemoizedMarkdown";

