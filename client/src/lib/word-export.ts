import katex from "katex";
import type { LessonContent, NextGenContent } from "@shared/schema";

export function escapeWordHtml(str: string): string {
  return String(str || "")
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
    return `<code>${escapeWordHtml(expr)}</code>`;
  }
}

/**
 * Convert markdown & LaTeX into Word-compatible HTML with native MathML equations
 * (Microsoft Word and LibreOffice import MathML directly as editable Equation Editor objects).
 */
export function markdownToWordHtml(text: string): string {
  if (!text || !text.trim()) return "";
  const placeholders: string[] = [];
  const stash = (html: string) => {
    const token = `@@SYNAPSE_MATH_${placeholders.length}@@`;
    placeholders.push(html);
    return token;
  };

  let s = text.replace(/\r\n/g, "\n");
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner) => stash(renderLatexToWordMathMl(inner, true)));
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => stash(renderLatexToWordMathMl(inner, true)));
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => stash(renderLatexToWordMathMl(inner, false)));
  s = s.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$/g, (_m, inner) => stash(renderLatexToWordMathMl(inner, false)));

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

  let html = escapeWordHtml(s);
  html = html.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /`([^`]+)`/g,
    `<code style="font-family:Consolas,monospace;background:#e2e8f0;padding:1px 4px;">$1</code>`,
  );
  html = html.replace(/\n\n+/g, "</p><p>");
  html = html.replace(/\n/g, "<br/>");
  html = `<p>${html}</p>`;

  placeholders.forEach((snippet, idx) => {
    html = html.replace(`@@SYNAPSE_MATH_${idx}@@`, snippet);
  });
  return html;
}

export function triggerWordDownload(filename: string, htmlDoc: string) {
  const blob = new Blob(["\ufeff", htmlDoc], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface CourseMonographUnit {
  id: number;
  title: string;
  difficulty: string;
  outline?: string | null;
  contentJson?: (LessonContent | NextGenContent) | null;
}

/**
 * Compile an entire SynapseJourney course (OER reading list + all units + MathML equations
 * + the learner's saved Feynman Blank Sheet notes from localStorage) into one archivable .doc monograph.
 */
export function buildCourseWordMonographHtml(params: {
  topicTitle: string;
  topicDescription?: string | null;
  generatedByModel?: string | null;
  updatedAt?: string | null;
  recommendedOER?: { name: string; url: string; reason?: string }[];
  units: CourseMonographUnit[];
}): string {
  const dateStr = new Date().toLocaleDateString();
  const tocItems = params.units
    .map((u, idx) => `<li><strong>Lesson ${idx + 1}:</strong> ${escapeWordHtml(u.title)} <em>(${escapeWordHtml(u.difficulty)})</em></li>`)
    .join("");

  const oerHtml =
    params.recommendedOER && params.recommendedOER.length > 0
      ? `<h2>Recommended Open Educational Resources</h2><ul>${params.recommendedOER
          .map(
            (r) =>
              `<li><strong>${escapeWordHtml(r.name)}</strong>: <a href="${escapeWordHtml(r.url)}">${escapeWordHtml(r.url)}</a>${r.reason ? ` — ${escapeWordHtml(r.reason)}` : ""}</li>`,
          )
          .join("")}</ul>`
      : "";

  const unitBlocks = params.units
    .map((u, idx) => {
      let savedNotes: { explanation?: string; roadblocksAndTerms?: string } | null = null;
      try {
        const raw = localStorage.getItem(`synapse_feynman_unit_${u.id}`);
        if (raw) savedNotes = JSON.parse(raw);
      } catch {
        // ignore storage access issues
      }

      const content: any = u.contentJson || {};
      const isNg = u.difficulty === "nextgen" || Boolean(content.researchContext);

      let bodyHtml = "";
      if (isNg) {
        bodyHtml = `
          ${content.researchContext ? `<h3>Research Context</h3><div class="box">${markdownToWordHtml(content.researchContext)}</div>` : ""}
          ${content.industryChallenge?.description ? `<h3>Industry Challenge: ${escapeWordHtml(content.industryChallenge.title || "")}</h3><div class="box">${markdownToWordHtml(content.industryChallenge.description)}</div>` : ""}
        `;
      } else {
        const kt = Array.isArray(content.keyTakeaways)
          ? `<h3>Key Takeaways</h3><ul>${content.keyTakeaways.map((t: string) => `<li>${markdownToWordHtml(t)}</li>`).join("")}</ul>`
          : "";
        const analogy = content.analogy
          ? `<h3>Intuitive Analogy</h3><div class="box">${markdownToWordHtml(content.analogy)}</div>`
          : "";
        const concept = content.concept
          ? `<h3>Concept &amp; Derivations</h3><div class="box">${markdownToWordHtml(content.concept)}</div>`
          : "";
        const example = content.example?.content
          ? `<h3>Worked Example: ${escapeWordHtml(content.example.title || "Example")}</h3><div class="box">${markdownToWordHtml(content.example.content)}</div>${content.example.code ? `<pre>${escapeWordHtml(content.example.code)}</pre>` : ""}`
          : "";
        const refs =
          Array.isArray(content.externalResources) && content.externalResources.length > 0
            ? `<h3>Unit References</h3><ul>${content.externalResources
                .map(
                  (r: any) =>
                    `<li><strong>${escapeWordHtml(r.title)}</strong>: <a href="${escapeWordHtml(r.url)}">${escapeWordHtml(r.url)}</a> — ${escapeWordHtml(r.description || "")}</li>`,
                )
                .join("")}</ul>`
            : "";
        bodyHtml = `${kt}${analogy}${concept}${example}${refs}`;
      }

      const feynmanBlock =
        savedNotes?.explanation?.trim() || savedNotes?.roadblocksAndTerms?.trim()
          ? `<h3>My Feynman Study Notes</h3>
             ${savedNotes?.explanation?.trim() ? `<div class="note-box"><strong>My Explanation:</strong>${markdownToWordHtml(savedNotes.explanation)}</div>` : ""}
             ${savedNotes?.roadblocksAndTerms?.trim() ? `<div class="note-box"><strong>Terms &amp; Roadblocks:</strong>${markdownToWordHtml(savedNotes.roadblocksAndTerms)}</div>` : ""}`
          : "";

      return `
        <div style="page-break-before: always;">
          <h2>Lesson ${idx + 1}: ${escapeWordHtml(u.title)}</h2>
          <div class="meta">Stage: ${escapeWordHtml(u.difficulty)}</div>
          ${bodyHtml || `<p><em>(Lesson content has not been generated yet.)</em></p>`}
          ${feynmanBlock}
        </div>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeWordHtml(params.topicTitle)} — Complete Course Monograph</title>
  <style>
    body { font-family: Calibri, Georgia, serif; line-height: 1.55; color: #111827; max-width: 820px; margin: 24px auto; }
    h1 { font-size: 22pt; color: #1e3a8a; margin-bottom: 6px; }
    h2 { font-size: 15pt; color: #1d4ed8; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-top: 22px; }
    h3 { font-size: 12pt; color: #1e40af; margin-top: 14px; margin-bottom: 4px; }
    .meta { font-size: 9.5pt; color: #4b5563; margin-bottom: 14px; }
    .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; }
    .note-box { background: #fffbeb; border: 1px solid #f59e0b; padding: 10px 14px; border-radius: 6px; margin-top: 8px; }
    pre { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-family: Consolas, monospace; font-size: 9pt; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${escapeWordHtml(params.topicTitle)}</h1>
  <div class="meta">
    <strong>Source:</strong> SynapseJourney Course Monograph &nbsp;|&nbsp;
    <strong>Exported:</strong> ${escapeWordHtml(dateStr)}
    ${params.updatedAt ? ` &nbsp;|&nbsp; <strong>Course Updated:</strong> ${escapeWordHtml(new Date(params.updatedAt).toLocaleDateString())}` : ""}
    ${params.generatedByModel ? ` &nbsp;|&nbsp; <strong>Authored Model:</strong> ${escapeWordHtml(params.generatedByModel)}` : ""}
  </div>
  ${params.topicDescription ? `<p>${escapeWordHtml(params.topicDescription)}</p>` : ""}

  <h2>Course Table of Contents (${params.units.length} Lessons)</h2>
  <ol>${tocItems}</ol>

  ${oerHtml}
  ${unitBlocks}
</body>
</html>`;
}
