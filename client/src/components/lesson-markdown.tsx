import { Fragment, useState, type ReactNode } from "react";
import katex from "katex";
import { Check, Copy, Sparkles } from "lucide-react";

/**
 * Rich markdown + KaTeX math renderer for generated lesson prose, takeaways,
 * quizzes, diagnostic primers, and AI tutor responses.
 *
 * Supports:
 * - Display math: `$$ ... $$`, `\[ ... \]`, and standalone bare-LaTeX equation lines
 *   (e.g. `\nabla^2 \mathbf{E} + ... = 0` when an author omitted delimiters)
 * - Inline math: `$ ... $` and `\( ... \)`
 * - Fenced code blocks, headings, bold/italic/code, links, lists, blockquotes, rules
 *
 * Uses KaTeX (`trust: false`, `throwOnError: false`) so equations render as crisp
 * textbook typography instead of wrapping raw LaTeX text across multiple lines.
 */

const LATEX_CMD_SIGNAL =
  /\\(?:nabla|frac|sqrt|partial|mathbf|mathrm|mathit|mathcal|mathbb|text|left|right|int|sum|prod|vec|hat|bar|tilde|dot|ddot|varepsilon|epsilon|lambda|omega|Omega|Delta|delta|alpha|beta|gamma|theta|phi|psi|rho|sigma|mu|nu|pi|tau|cdot|times|approx|neq|leq|geq|infty|pm|mp|propto|equiv|rightarrow|to|implies)\b/;

/** Detect a standalone line that is clearly an unwrapped LaTeX equation. */
function isBareLatexLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (trimmed.startsWith("#") || trimmed.startsWith(">") || /^[-*+]\s/.test(trimmed)) return false;
  if (trimmed.includes("http://") || trimmed.includes("https://")) return false;
  if (!LATEX_CMD_SIGNAL.test(trimmed)) return false;
  // Must look equation-like (has =, \frac, \nabla, \int, \sum, or high symbol density)
  const hasMathOperator = /[=<>^_]|\\(?:frac|nabla|int|sum|partial|left|mathbf)/.test(trimmed);
  if (!hasMathOperator) return false;
  // Reject normal English prose sentences that just happen to contain one LaTeX macro
  const plainWordMatches = trimmed
    .replace(/\\[a-zA-Z]+/g, " ")
    .match(/\b[A-Za-z]{4,}\b/g);
  const plainWordCount = plainWordMatches ? plainWordMatches.length : 0;
  return plainWordCount <= 3;
}

function renderKatexHtml(expr: string, displayMode: boolean): string {
  const cleaned = expr.trim();
  if (!cleaned) return "";
  try {
    return katex.renderToString(cleaned, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      output: "htmlAndMathml",
    });
  } catch {
    return "";
  }
}

function InlineMath({ value }: { value: string }) {
  const html = renderKatexHtml(value, false);
  if (!html) {
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
        {value}
      </code>
    );
  }
  return (
    <span
      className="synapse-math-inline align-baseline text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MathBlock({
  value,
  onExplainEquation,
}: {
  value: string;
  onExplainEquation?: (latex: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const cleaned = value.trim();
  const html = renderKatexHtml(cleaned, true);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleaned);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="group relative my-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-foreground"
      aria-label="Mathematical expression"
    >
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {onExplainEquation && (
          <button
            type="button"
            onClick={() => onExplainEquation(cleaned)}
            title="Ask the AI Tutor to unpack every symbol and physical meaning of this equation"
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-background/90 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" />
            <span>Explain</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          title="Copy LaTeX source"
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>LaTeX</span>
            </>
          )}
        </button>
      </div>
      {html ? (
        <div
          className="synapse-math-block overflow-x-auto py-1 text-center"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
          {cleaned}
        </pre>
      )}
    </div>
  );
}

/**
 * Normalize inline text so that even if display `$$...$$` or `\[...\]` appears inline
 * or bare LaTeX fragments appear inside a sentence, we tokenize cleanly.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on:
  //  1. `$$...$$` inline display math
  //  2. `\[...\]` inline display math
  //  3. `\(...\)` inline math
  //  4. `[label](https://...)` markdown link
  //  5. `**bold**`
  //  6. `` `code` ``
  //  7. `*italic*`
  //  8. `$math$` (not currency like `$5` followed by space/punctuation without closing `$`)
  const pattern =
    /(\$\$[^$]+\$\$|\\\[[^\]]+\\\]|\\\((?:[^\\]|\\[^)])+\\\)|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\$(?!\s)(?:[^$\n\\]|\\.)+?(?<!\s)\$)/g;

  const parts = text.split(pattern).filter((p) => p !== "");
  parts.forEach((part, i) => {
    const key = `${keyPrefix}-i${i}`;
    if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
      nodes.push(<InlineMath key={key} value={part.slice(2, -2)} />);
    } else if (part.startsWith("\\[") && part.endsWith("\\]") && part.length > 4) {
      nodes.push(<InlineMath key={key} value={part.slice(2, -2)} />);
    } else if (part.startsWith("\\(") && part.endsWith("\\)") && part.length > 4) {
      nodes.push(<InlineMath key={key} value={part.slice(2, -2)} />);
    } else if (/^\[[^\]]+\]\(https?:\/\/[^)\s]+\)$/.test(part)) {
      const m = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (m) {
        nodes.push(
          <a
            key={key}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {m[1]}
          </a>,
        );
      } else {
        nodes.push(<Fragment key={key}>{part}</Fragment>);
      }
    } else if (/^\*\*[^*]+\*\*$/.test(part)) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(part.slice(2, -2), `${key}-b`)}
        </strong>,
      );
    } else if (/^`[^`]+`$/.test(part)) {
      const inner = part.slice(1, -1);
      // If a lesson author wrapped a LaTeX expression inside backticks (e.g. `\nabla^2 E = 0`),
      // render it with KaTeX so equations are readable rather than raw backslash code.
      if (LATEX_CMD_SIGNAL.test(inner) && !inner.includes("http")) {
        nodes.push(<InlineMath key={key} value={inner} />);
      } else {
        nodes.push(
          <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
            {inner}
          </code>,
        );
      }
    } else if (/^\*[^*\n]+\*$/.test(part)) {
      nodes.push(<em key={key}>{renderInline(part.slice(1, -1), `${key}-e`)}</em>);
    } else if (/^\$[^$\n]+\$$/.test(part)) {
      const inner = part.slice(1, -1);
      // Avoid mis-parsing plain dollar currency like "$100" when paired accidentally with another "$200"
      if (/^\d[\d,.]*(?:\s*(?:to|-|and|or)\s*\$?\d[\d,.]*)?$/i.test(inner.trim())) {
        nodes.push(<Fragment key={key}>{part}</Fragment>);
      } else {
        nodes.push(<InlineMath key={key} value={inner} />);
      }
    } else if (isBareLatexLine(part)) {
      nodes.push(<InlineMath key={key} value={part} />);
    } else {
      nodes.push(<Fragment key={key}>{part}</Fragment>);
    }
  });
  return nodes;
}

export function LessonMarkdown({
  text,
  className,
  inline = false,
  onExplainEquation,
}: {
  text?: string | null;
  className?: string;
  inline?: boolean;
  onExplainEquation?: (latex: string) => void;
}) {
  if (!text || !text.trim()) return null;
  // Short strings (quiz prompts, answer options, labels) keep single-line flow.
  if (inline) {
    return <span className={className}>{renderInline(text, "i")}</span>;
  }

  // Promote inline `$$ ... $$` or `\[ ... \]` blocks onto their own lines so they render
  // cleanly as centered display equations even when embedded inside a paragraph.
  const source = text
    .replace(/\r\n/g, "\n")
    .replace(/([^\n])\s*\$\$([\s\S]+?)\$\$\s*([^\n])/g, "$1\n\n$$\n$2\n$$\n\n$3")
    .replace(/([^\n])\s*\\\[([\s\S]+?)\\\]\s*([^\n])/g, "$1\n\n\\[\n$2\n\\]\n\n$3");

  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const key = `p-${blocks.length}`;
    const joined = paragraph.join(" ");
    if (isBareLatexLine(joined)) {
      blocks.push(<MathBlock key={`m-${blocks.length}`} value={joined} onExplainEquation={onExplainEquation} />);
    } else {
      blocks.push(
        <p key={key} className="leading-relaxed">
          {renderInline(joined, key)}
        </p>,
      );
    }
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const key = `l-${blocks.length}`;
    const items = list.items.map((item, i) => (
      <li key={`${key}-${i}`} className="leading-relaxed">
        {renderInline(item, `${key}-${i}`)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={key} className="list-decimal space-y-1.5 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-1.5 pl-5">
          {items}
        </ul>
      ),
    );
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();

    // Fenced code block: ```lang ... ```
    if (line.startsWith("```")) {
      flushAll();
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      while (i + 1 < lines.length && !lines[i + 1].trim().startsWith("```")) {
        i += 1;
        codeLines.push(lines[i]);
      }
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith("```")) {
        i += 1;
      }
      blocks.push(
        <div key={`code-${blocks.length}`} className="my-3 overflow-hidden rounded-lg border border-border bg-muted/60">
          {lang && (
            <div className="border-b border-border/60 bg-muted/80 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      );
      continue;
    }

    // Display math block: $$ ... $$ (single or multi-line)
    if (line.startsWith("$$")) {
      flushAll();
      let math = line.replace(/^\$\$/, "");
      if (!math.includes("$$")) {
        const collected: string[] = [];
        while (i + 1 < lines.length && !lines[i + 1].includes("$$")) {
          i += 1;
          collected.push(lines[i]);
        }
        if (i + 1 < lines.length) {
          i += 1;
          collected.push(lines[i].replace(/\$\$.*$/, ""));
        }
        math = [math, ...collected].join("\n");
      } else {
        math = math.replace(/\$\$.*$/, "");
      }
      blocks.push(<MathBlock key={`m-${blocks.length}`} value={math} onExplainEquation={onExplainEquation} />);
      continue;
    }

    // Display math block: \[ ... \] (single or multi-line)
    if (line.startsWith("\\[")) {
      flushAll();
      let math = line.replace(/^\\\[/, "");
      if (!math.includes("\\]")) {
        const collected: string[] = [];
        while (i + 1 < lines.length && !lines[i + 1].includes("\\]")) {
          i += 1;
          collected.push(lines[i]);
        }
        if (i + 1 < lines.length) {
          i += 1;
          collected.push(lines[i].replace(/\\\].*$/, ""));
        }
        math = [math, ...collected].join("\n");
      } else {
        math = math.replace(/\\\].*$/, "");
      }
      blocks.push(<MathBlock key={`m-${blocks.length}`} value={math} onExplainEquation={onExplainEquation} />);
      continue;
    }

    // Bare standalone LaTeX equation line (e.g. `\nabla^2 \mathbf{E} + ... = 0`)
    if (isBareLatexLine(line)) {
      flushAll();
      blocks.push(<MathBlock key={`m-${blocks.length}`} value={line} onExplainEquation={onExplainEquation} />);
      continue;
    }

    if (line === "") {
      flushAll();
      continue;
    }

    // Rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-4 border-border" />);
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length + 2, 6); // page already has h1/h2
      const Tag = `h${level}` as "h3" | "h4" | "h5" | "h6";
      blocks.push(
        <Tag key={`h-${blocks.length}`} className="mt-4 mb-2 font-semibold text-foreground">
          {renderInline(heading[2], `h-${blocks.length}`)}
        </Tag>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      flushAll();
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground"
        >
          {renderInline(line.replace(/^>\s?/, ""), `q-${blocks.length}`)}
        </blockquote>,
      );
      continue;
    }

    // Lists
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const item = (bullet ? bullet[1] : numbered![1]).trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
      continue;
    }

    paragraph.push(line);
  }

  flushAll();

  return <div className={className ?? "space-y-3 text-muted-foreground"}>{blocks}</div>;
}
