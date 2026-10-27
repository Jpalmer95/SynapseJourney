import { Fragment, type ReactNode } from "react";

/**
 * Minimal markdown renderer for generated lesson prose.
 *
 * Lesson `contentJson` fields (concept / analogy / example body / key takeaways) are
 * authored as markdown. They used to be dropped into a single <p>, so learners saw
 * literal "## Heading", "**bold**", "---" and "$$\\mathbf{F}=m\\mathbf{a}$$".
 *
 * This renders the subset we actually emit — headings, bold/italic/code, lists,
 * blockquotes, rules and display math — as React nodes (never innerHTML, so no XSS).
 * Math is shown as a labelled monospace block: correct enough to read, and a KaTeX
 * pass can replace `MathBlock` later without touching call sites.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on **bold**, `code`, *italic*, $math$
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\$[^$\n]+\$)/g;
  const parts = text.split(pattern).filter((p) => p !== "");
  parts.forEach((part, i) => {
    const key = `${keyPrefix}-i${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (/^`[^`]+`$/.test(part)) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>,
      );
    } else if (/^\*[^*\n]+\*$/.test(part)) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else if (/^\$[^$\n]+\$/.test(part)) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<Fragment key={key}>{part}</Fragment>);
    }
  });
  return nodes;
}

function MathBlock({ value }: { value: string }) {
  return (
    <pre
      className="my-2 overflow-x-auto rounded-md border border-border bg-muted/60 p-3 font-mono text-xs leading-relaxed"
      aria-label="Mathematical expression"
    >
      {value.trim()}
    </pre>
  );
}

export function LessonMarkdown({ text, className }: { text?: string | null; className?: string }) {
  if (!text || !text.trim()) return null;

  const source = text.replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const key = `p-${blocks.length}`;
    blocks.push(
      <p key={key} className="leading-relaxed">
        {renderInline(paragraph.join(" "), key)}
      </p>,
    );
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
        <ol key={key} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-1 pl-5">
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
      blocks.push(<MathBlock key={`m-${blocks.length}`} value={math} />);
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
        <Tag key={`h-${blocks.length}`} className="mt-4 mb-2 font-semibold">
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
