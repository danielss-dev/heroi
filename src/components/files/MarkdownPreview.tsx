import { useEffect, useMemo, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import mermaid from "mermaid";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
}

type MarkdownSegment =
  | {
      type: "markdown";
      content: string;
    }
  | {
      type: "mermaid";
      content: string;
    };

let mermaidInitialized = false;
let mermaidRenderCounter = 0;

function ensureMermaidInitialized() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
  });
  mermaidInitialized = true;
}

function nextMermaidId(): string {
  mermaidRenderCounter += 1;
  return `markdown-mermaid-${mermaidRenderCounter}`;
}

function splitMarkdownAndMermaid(content: string): MarkdownSegment[] {
  const mermaidFenceRegex = /```mermaid\s*\r?\n([\s\S]*?)```/gi;
  const segments: MarkdownSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = mermaidFenceRegex.exec(content);

  while (match) {
    const [fullMatch, mermaidDiagram = ""] = match;
    if (match.index > lastIndex) {
      segments.push({
        type: "markdown",
        content: content.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: "mermaid",
      content: mermaidDiagram.trim(),
    });

    lastIndex = match.index + fullMatch.length;
    match = mermaidFenceRegex.exec(content);
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "markdown",
      content: content.slice(lastIndex),
    });
  }

  if (segments.length === 0) {
    return [{ type: "markdown", content }];
  }

  return segments;
}

function MermaidDiagram({ content }: { content: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const render = async () => {
      if (!content) {
        setSvg("");
        setError("Mermaid block is empty.");
        return;
      }

      try {
        ensureMermaidInitialized();
        const { svg: renderedSvg } = await mermaid.render(nextMermaidId(), content);
        if (disposed) return;
        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        if (disposed) return;
        setSvg("");
        const errorMessage = err instanceof Error ? err.message : "Unknown mermaid rendering error.";
        setError(errorMessage);
      }
    };

    render().catch(() => {
      if (!disposed) {
        setError("Unable to render Mermaid diagram.");
      }
    });

    return () => {
      disposed = true;
    };
  }, [content]);

  if (error) {
    return (
      <div className="markdown-mermaid-block markdown-mermaid-error">
        <div className="markdown-mermaid-error-title">Unable to render Mermaid diagram</div>
        <pre className="markdown-mermaid-error-message">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="markdown-mermaid-loading">Rendering Mermaid diagram...</div>;
  }

  return (
    <div className="markdown-mermaid-block">
      <div className="markdown-mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

const markdownComponents: Components = {
  pre({ children }) {
    return <pre className="markdown-code-block">{children}</pre>;
  },
  code({ className, children }) {
    const classes = className ? `markdown-inline-code ${className}` : "markdown-inline-code";
    return <code className={classes}>{children}</code>;
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className="markdown-link">
        {children}
      </a>
    );
  },
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const segments = useMemo(() => splitMarkdownAndMermaid(content), [content]);

  return (
    <div className="markdown-preview">
      {segments.map((segment, index) =>
        segment.type === "mermaid" ? (
          <MermaidDiagram key={`mermaid-${index}`} content={segment.content} />
        ) : (
          <div key={`markdown-${index}`} className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {segment.content}
            </ReactMarkdown>
          </div>
        ),
      )}
    </div>
  );
}
