import { useState, useEffect } from "react";
import katex from "katex";
import {
  PenTool,
  Eye,
  EyeOff,
  CheckCircle2,
  Download,
  FileText,
  Sparkles,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LessonMarkdown } from "@/components/lesson-markdown";
import { useToast } from "@/hooks/use-toast";
import type { LessonContent } from "@shared/schema";

interface FeynmanBlankSheetProps {
  topicTitle: string;
  unit: {
    id: number;
    title: string;
    difficulty: string;
  };
  lessonContent: LessonContent;
  blankSheetActive: boolean;
  onToggleBlankSheet: (active: boolean) => void;
  onTeachAiStudent: (draftExplanation: string) => void;
}

interface SavedFeynmanNotes {
  explanation: string;
  roadblocksAndTerms: string;
  updatedAt: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLatexToWordMathMl(expr: string, displayMode: boolean): string {
  try {
    const mathml = katex.renderToString(expr.trim(), {
      displayMode,
      output: "mathml",
      throwOnError: false,
      strict: false,
      trust: false,
    });
    return displayMode
      ? `<div style="text-align:center;margin:10px 0;">${mathml}</div>`
      : mathml;
  } catch {
    return `<code>${escapeHtml(expr)}</code>`;
  }
}

/**
 * Convert lesson markdown & LaTeX into Word-compatible HTML with native MathML
 * equations (Microsoft Word automatically imports MathML as editable Word Equations).
 */
function markdownToWordHtml(text: string): string {
  if (!text || !text.trim()) return "";
  const placeholders: string[] = [];
  const stash = (html: string) => {
    const token = `@@SYNAPSE_MATH_${placeholders.length}@@`;
    placeholders.push(html);
    return token;
  };

  let s = text.replace(/\r\n/g, "\n");
  // Stash display math $$...$$ and \[...\]
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner) => stash(renderLatexToWordMathMl(inner, true)));
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => stash(renderLatexToWordMathMl(inner, true)));
  // Stash inline math \(...\) and $...$
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => stash(renderLatexToWordMathMl(inner, false)));
  s = s.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$/g, (_m, inner) => stash(renderLatexToWordMathMl(inner, false)));

  // Convert standalone bare LaTeX lines (e.g. `\nabla^2 \mathbf{E} + ... = 0`)
  s = s
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (
        t &&
        !t.includes("@@SYNAPSE_MATH_") &&
        /\\(?:nabla|frac|sqrt|partial|mathbf|left|right|int|sum|varepsilon|lambda|omega)\b/.test(t) &&
        /[=<>^_]/.test(t)
      ) {
        const plainWords = t.replace(/\\[a-zA-Z]+/g, " ").match(/\b[A-Za-z]{4,}\b/g);
        if (!plainWords || plainWords.length <= 3) {
          return stash(renderLatexToWordMathMl(t, true));
        }
      }
      return line;
    })
    .join("\n");

  // Escape HTML, then restore basic bold/italic/headings and line breaks
  let html = escapeHtml(s);
  html = html.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code style=\"font-family:Consolas,monospace;background:#e2e8f0;padding:1px 4px;\">$1</code>");
  html = html.replace(/\n\n+/g, "</p><p>");
  html = html.replace(/\n/g, "<br/>");
  html = `<p>${html}</p>`;

  // Restore MathML blocks
  placeholders.forEach((snippet, idx) => {
    html = html.replace(`@@SYNAPSE_MATH_${idx}@@`, snippet);
  });
  return html;
}

export function FeynmanBlankSheet({
  topicTitle,
  unit,
  lessonContent,
  blankSheetActive,
  onToggleBlankSheet,
  onTeachAiStudent,
}: FeynmanBlankSheetProps) {
  const { toast } = useToast();
  const storageKey = `synapse_feynman_unit_${unit.id}`;
  const [explanation, setExplanation] = useState("");
  const [roadblocksAndTerms, setRoadblocksAndTerms] = useState("");
  const [showSelfRubric, setShowSelfRubric] = useState(false);
  const [checkedTakeaways, setCheckedTakeaways] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: SavedFeynmanNotes = JSON.parse(raw);
        setExplanation(parsed.explanation || "");
        setRoadblocksAndTerms(parsed.roadblocksAndTerms || "");
      } else {
        setExplanation("");
        setRoadblocksAndTerms("");
      }
    } catch {
      setExplanation("");
      setRoadblocksAndTerms("");
    }
    setShowSelfRubric(false);
    setCheckedTakeaways({});
  }, [storageKey, unit.id]);

  const persistNotes = (nextExp: string, nextTerms: string) => {
    try {
      const payload: SavedFeynmanNotes = {
        explanation: nextExp,
        roadblocksAndTerms: nextTerms,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore localStorage quota errors
    }
  };

  const wordCount = (explanation.trim().match(/\S+/g) || []).length;

  const handleDownloadWordDoc = () => {
    const dateStr = new Date().toLocaleDateString();
    const safeTitle = unit.title.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
    const takeawaysHtml = (lessonContent.keyTakeaways || [])
      .map((t) => `<li>${markdownToWordHtml(t)}</li>`)
      .join("");
    const resourcesHtml = (lessonContent.externalResources || [])
      .map(
        (r) =>
          `<li><strong>${escapeHtml(r.title)}</strong> (${escapeHtml(r.type)}): <a href="${escapeHtml(r.url)}">${escapeHtml(r.url)}</a> — ${escapeHtml(r.description || "")}</li>`,
      )
      .join("");

    const htmlDoc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(unit.title)} — Study Notes</title>
  <style>
    body { font-family: Calibri, Georgia, serif; line-height: 1.55; color: #111827; max-width: 820px; margin: 24px auto; }
    h1 { font-size: 20pt; color: #1e3a8a; margin-bottom: 4px; }
    h2 { font-size: 14pt; color: #1d4ed8; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; }
    h3, h4 { color: #1e40af; margin-top: 12px; margin-bottom: 4px; }
    .meta { font-size: 10pt; color: #4b5563; margin-bottom: 18px; }
    .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 6px; }
    p { margin: 6px 0; }
    pre { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-family: Consolas, monospace; font-size: 9.5pt; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${escapeHtml(unit.title)}</h1>
  <div class="meta">
    <strong>Course:</strong> ${escapeHtml(topicTitle)} &nbsp;|&nbsp;
    <strong>Date:</strong> ${escapeHtml(dateStr)}
  </div>

  <h2>1. My Feynman Blank-Sheet Explanation (Teach It to Myself)</h2>
  <div class="box">${markdownToWordHtml(explanation.trim() || "(No blank-sheet explanation recorded yet.)")}</div>

  <h2>2. Technical Terms, Roadblocks &amp; Q&amp;A Notes</h2>
  <div class="box">${markdownToWordHtml(roadblocksAndTerms.trim() || "(No term definitions or roadblock notes recorded yet.)")}</div>

  <h2>3. Intuitive Analogy ("Think of It Like...")</h2>
  <div class="box">${markdownToWordHtml(lessonContent.analogy || "")}</div>

  <h2>4. Key Takeaways</h2>
  <ul>${takeawaysHtml}</ul>

  <h2>5. Worked Example: ${escapeHtml(lessonContent.example?.title || "Example")}</h2>
  <div class="box">${markdownToWordHtml(lessonContent.example?.content || "")}</div>
  ${lessonContent.example?.code ? `<h3>Code Example</h3><pre>${escapeHtml(lessonContent.example.code)}</pre>` : ""}

  <h2>6. Full Concept Reference</h2>
  <div class="box">${markdownToWordHtml(lessonContent.concept || "")}</div>

  <h2>7. Verified References &amp; Further Reading</h2>
  <ul>${resourcesHtml}</ul>
</body>
</html>`;

    const blob = new Blob(["\ufeff", htmlDoc], {
      type: "application/msword;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}-Study-Notes.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Study document downloaded (.doc)",
      description: "Includes MathML equations that open directly as formatted equations in Microsoft Word & LibreOffice.",
    });
  };

  const handleDownloadMarkdown = () => {
    const dateStr = new Date().toLocaleDateString();
    const safeTitle = unit.title.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
    const md = `# ${unit.title}
**Course:** ${topicTitle}  
**Date:** ${dateStr}

---

## 1. My Feynman Blank-Sheet Explanation
${explanation.trim() || "_(No blank-sheet explanation recorded yet.)_"}

## 2. Technical Terms, Roadblocks & Follow-Up Q&A Notes
${roadblocksAndTerms.trim() || "_(No roadblock notes recorded yet.)_"}

---

## 3. Intuitive Analogy
${lessonContent.analogy || ""}

## 4. Key Takeaways
${(lessonContent.keyTakeaways || []).map((t) => `- ${t}`).join("\n")}

## 5. Worked Example: ${lessonContent.example?.title || "Example"}
${lessonContent.example?.content || ""}

## 6. Concept Reference
${lessonContent.concept || ""}

## 7. Verified References
${(lessonContent.externalResources || []).map((r) => `- [${r.title}](${r.url}) — ${r.description}`).join("\n")}
`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}-Study-Notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Markdown study notes downloaded (.md)",
      description: "Saved your Feynman explanation, term notes, and lesson reference.",
    });
  };

  return (
    <section className="min-w-0 w-full" data-testid="section-feynman-blank-sheet">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <PenTool className="h-5 w-5 text-amber-500 shrink-0" />
          <h2 className="text-xl font-semibold">Feynman Blank Sheet &amp; Study Notebook</h2>
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
            Teach It to Learn It
          </Badge>
        </div>

        <Button
          variant={blankSheetActive ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleBlankSheet(!blankSheetActive)}
          className="h-8 text-xs gap-1.5"
          data-testid="button-toggle-blank-sheet-mode"
        >
          {blankSheetActive ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              <span>Peek at Lesson Reference Above</span>
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              <span>Blank Sheet Mode (Hide Lesson Above)</span>
            </>
          )}
        </Button>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5 overflow-hidden w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            Richard Feynman&apos;s 3-Step Method: (1) Take out a blank sheet and teach the concept to yourself from scratch. (2) When you hit a roadblock, go back to the reference above, unpack the unclear term, and continue. (3) Teach it to someone else — and save your notes.
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Box 1: Teach it to yourself */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Step 1: Teach &ldquo;{unit.title}&rdquo; in Your Own Words
              </label>
              <span className="text-[11px] text-muted-foreground">
                {wordCount} words · Auto-saved in browser
              </span>
            </div>
            <Textarea
              value={explanation}
              onChange={(e) => {
                setExplanation(e.target.value);
                persistNotes(e.target.value, roadblocksAndTerms);
              }}
              placeholder="Pretend you have a blank sheet of paper and a pencil. Explain the core physical/mathematical idea of this lesson from scratch without jargon. Where do you get stuck?"
              className="min-h-[120px] bg-background/90 text-sm"
              data-testid="textarea-feynman-explanation"
            />
          </div>

          {/* Box 2: Unclear technical terms / roadblocks / Q&A notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-cyan-400 block">
              Step 2: Unclear Terms, Roadblocks &amp; Follow-Up Q&amp;A Notes
            </label>
            <Textarea
              value={roadblocksAndTerms}
              onChange={(e) => {
                setRoadblocksAndTerms(e.target.value);
                persistNotes(explanation, e.target.value);
              }}
              placeholder="Whenever you pause on an unfamiliar technical term, symbol, or derivation step, jot down the term and its explanation here so it locks in before you move on..."
              className="min-h-[85px] bg-background/90 text-sm"
              data-testid="textarea-feynman-roadblocks"
            />
          </div>

          {/* Action Row: Offline Self-Check Rubric, AI Feynman Student, and Word/MD Export */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSelfRubric((v) => !v)}
                className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                data-testid="button-feynman-self-check"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{showSelfRubric ? "Hide Self-Check Rubric" : "Check Against First-Principles Rubric"}</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const draft = explanation.trim()
                    ? `I am practicing the Feynman Technique on "${unit.title}". Here is my plain-language explanation so far:\n\n"${explanation.trim()}"\n\n${roadblocksAndTerms.trim() ? `Roadblocks / questions I hit:\n${roadblocksAndTerms.trim()}\n\n` : ""}Act as my curious student: point out any undefined jargon or gaps in my logic and ask me a probing follow-up question.`
                    : `I want to practice the Feynman Technique on "${unit.title}". Ask me to explain the core concept in plain words, and then question my explanation step by step.`;
                  onTeachAiStudent(draft);
                }}
                className="h-8 text-xs gap-1.5"
                data-testid="button-feynman-teach-ai"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Step 3: Teach It to the AI Student</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadWordDoc}
                className="h-8 text-xs gap-1.5"
                title="Download your notes, Q&A, and lesson reference as a Microsoft Word (.doc) document"
                data-testid="button-export-word-doc"
              >
                <Download className="h-3.5 w-3.5 text-blue-400" />
                <span>Save as Word (.doc)</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDownloadMarkdown}
                className="h-8 text-xs gap-1"
                title="Download as Markdown (.md)"
                data-testid="button-export-markdown"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>.md</span>
              </Button>
            </div>
          </div>

          {/* Offline Self-Check Rubric */}
          {showSelfRubric && (
            <div
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-3 text-xs"
              data-testid="panel-feynman-rubric"
            >
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                First-Principles Self-Check — Did your explanation cover these core ideas?
              </div>
              {lessonContent.analogy && (
                <div className="p-2.5 rounded bg-background/70 border border-border/60 space-y-1">
                  <span className="font-semibold text-amber-300 block">Intuitive Anchor:</span>
                  <LessonMarkdown text={lessonContent.analogy} className="text-muted-foreground" />
                </div>
              )}
              {lessonContent.keyTakeaways && lessonContent.keyTakeaways.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground block">
                    Check off each concept you successfully explained in your own words:
                  </span>
                  {lessonContent.keyTakeaways.map((kt, idx) => (
                    <label key={idx} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!checkedTakeaways[idx]}
                        onChange={(e) =>
                          setCheckedTakeaways((prev) => ({ ...prev, [idx]: e.target.checked }))
                        }
                        className="mt-1 rounded border-border"
                      />
                      <LessonMarkdown text={kt} className="text-muted-foreground" />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
