import React, { useState, useMemo, useRef, lazy, Suspense } from "react";
import { useTheme } from "next-themes";

const LazySandpack = lazy(() =>
  import("@codesandbox/sandpack-react").then((m) => ({ default: m.Sandpack })),
);
import {
  Play,
  Copy,
  Check,
  Download,
  Loader2,
  Sparkles,
  Terminal,
  Code2,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface CodeSandboxProps {
  code: string;
  title?: string;
}

type DetectedLang = "python" | "javascript" | "typescript" | "react" | "html" | "matlab" | "mathematica" | "other";
type ScientificTab = "python" | "matlab" | "mathematica";

function detectLanguage(code: string): DetectedLang {
  const c = code.trim();
  // Explicit Python signals (must be checked BEFORE JS/TS!)
  if (
    /^\s*(?:import\s+\w+|from\s+[\w.]+\s+import\s+)/m.test(c) ||
    /^\s*def\s+\w+\s*\(/m.test(c) ||
    /\bnp\.|\bscipy\.|\bplt\.|\bsympy\.|\bprint\s*\(|__name__\s*==\s*['"]__main__['"]/.test(c) ||
    /^\s*#.*python/im.test(c)
  ) {
    return "python";
  }
  // MATLAB signals
  if (/^\s*function\s+.*=/m.test(c) || /\blinespace\(|\bmeshgrid\(|\bfprintf\(|\bend\s*$/m.test(c) && /%/.test(c)) {
    return "matlab";
  }
  // Mathematica / Wolfram signals
  if (/\b(?:Plot|Plot3D|NDSolve|DSolve|Module|Table|Manipulate|Integrate)\s*\[/.test(c)) {
    return "mathematica";
  }
  // React / JSX
  if (
    c.includes("import React") ||
    c.includes("export default function") ||
    c.includes("useState(") ||
    c.includes("useEffect(")
  ) {
    return "react";
  }
  // Pure HTML
  if (
    c.startsWith("<!DOCTYPE html>") ||
    c.startsWith("<html") ||
    (c.includes("<div") && !c.includes("import ") && !c.includes("def "))
  ) {
    return "html";
  }
  // TypeScript
  if (/\binterface\s+\w+|\btype\s+\w+\s*=|:\s*(?:string|number|boolean)\b/.test(c)) {
    return "typescript";
  }
  // JavaScript
  if (/\b(?:const|let|var|function|console\.log|document\.|window\.)\b/.test(c)) {
    return "javascript";
  }
  return "other";
}

/**
 * Deterministic client-side Python (NumPy/SciPy/Matplotlib) -> MATLAB translator.
 * Gives learners an instant, zero-key MATLAB (.m) equivalent they can inspect or refine with AI.
 */
function quickPythonToMatlab(pythonCode: string): string {
  const lines = pythonCode.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [
    "% MATLAB / GNU Octave translation (auto-converted from Python example)",
    "% Tip: Click 'Refine with AI' if you have a connected AI key for full idiomatic polish.",
    "clear; clc;",
    "",
  ];

  const indentStack: number[] = [];

  const closeIndentsTo = (targetIndent: number) => {
    while (indentStack.length > 0 && indentStack[indentStack.length - 1] >= targetIndent) {
      const closed = indentStack.pop()!;
      out.push(`${" ".repeat(closed)}end`);
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const indent = rawLine.search(/\S|$/);

    if (!trimmed) {
      out.push("");
      continue;
    }

    // Skip Python imports
    if (/^(?:import\s+|from\s+\S+\s+import\s+)/.test(trimmed)) {
      out.push(`% [Python import] ${trimmed}`);
      continue;
    }

    closeIndentsTo(indent);

    // Pure comment
    if (trimmed.startsWith("#")) {
      out.push(`${" ".repeat(indent)}%${trimmed.slice(1)}`);
      continue;
    }

    let line = trimmed;
    // Inline comment conversion (# -> %)
    line = line.replace(/(?<!['"])#(.*)$/, "%$1");
    // Power operator (** -> .^)
    line = line.replace(/\*\*/g, ".^");
    // NumPy / math / SciPy common calls
    line = line
      .replace(/\bnp\.pi\b|\bmath\.pi\b/g, "pi")
      .replace(/\bnp\.linspace\s*\(/g, "linspace(")
      .replace(/\bnp\.arange\s*\(/g, "colon(")
      .replace(/\bnp\.zeros\s*\(/g, "zeros(")
      .replace(/\bnp\.ones\s*\(/g, "ones(")
      .replace(/\bnp\.array\s*\(\s*\[([^\]]*)\]\s*\)/g, "[$1]")
      .replace(/\bnp\.sqrt\s*\(|\bmath\.sqrt\s*\(/g, "sqrt(")
      .replace(/\bnp\.sin\s*\(|\bmath\.sin\s*\(/g, "sin(")
      .replace(/\bnp\.cos\s*\(|\bmath\.cos\s*\(/g, "cos(")
      .replace(/\bnp\.tan\s*\(|\bmath\.tan\s*\(/g, "tan(")
      .replace(/\bnp\.exp\s*\(|\bmath\.exp\s*\(/g, "exp(")
      .replace(/\bnp\.log10\s*\(/g, "log10(")
      .replace(/\bnp\.log\s*\(|\bmath\.log\s*\(/g, "log(")
      .replace(/\bnp\.abs\s*\(/g, "abs(")
      .replace(/\bnp\.real\s*\(/g, "real(")
      .replace(/\bnp\.imag\s*\(/g, "imag(")
      .replace(/\bnp\.conj\s*\(/g, "conj(")
      .replace(/\bnp\.dot\s*\(/g, "dot(")
      .replace(/\bnp\.cross\s*\(/g, "cross(")
      .replace(/\bnp\.linalg\.eig\s*\(/g, "eig(")
      .replace(/\bnp\.linalg\.solve\s*\(/g, "linsolve(")
      .replace(/\bnp\.fft\.fft\s*\(/g, "fft(")
      .replace(/\bspecial\.jv\s*\(|\bjv\s*\(/g, "besselj(")
      .replace(/\bspecial\.kn\s*\(|\bkn\s*\(/g, "besselk(")
      .replace(/\bplt\.figure\s*\([^)]*\)/g, "figure;")
      .replace(/\bplt\.plot\s*\(/g, "plot(")
      .replace(/\bplt\.xlabel\s*\(/g, "xlabel(")
      .replace(/\bplt\.ylabel\s*\(/g, "ylabel(")
      .replace(/\bplt\.title\s*\(/g, "title(")
      .replace(/\bplt\.legend\s*\([^)]*\)/g, "legend show;")
      .replace(/\bplt\.grid\s*\([^)]*\)/g, "grid on;")
      .replace(/\bplt\.show\s*\([^)]*\)/g, "% Figure displayed automatically in MATLAB")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false");

    // Control structures
    const defMatch = line.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:/);
    const forRangeMatch = line.match(/^for\s+(\w+)\s+in\s+range\s*\(([^)]+)\)\s*:/);
    const forInMatch = line.match(/^for\s+(\w+)\s+in\s+(.+)\s*:/);
    const ifMatch = line.match(/^if\s+(.+)\s*:/);
    const elifMatch = line.match(/^elif\s+(.+)\s*:/);
    const elseMatch = line.match(/^else\s*:/);
    const printMatch = line.match(/^print\s*\((.*)\)\s*$/);

    if (defMatch) {
      out.push(`${" ".repeat(indent)}function result = ${defMatch[1]}(${defMatch[2]})`);
      indentStack.push(indent);
    } else if (forRangeMatch) {
      const args = forRangeMatch[2].split(",").map((s) => s.trim());
      const rangeExpr =
        args.length === 1
          ? `0:(${args[0]} - 1)`
          : args.length === 2
          ? `${args[0]}:(${args[1]} - 1)`
          : `${args[0]}:${args[2]}:(${args[1]} - 1)`;
      out.push(`${" ".repeat(indent)}for ${forRangeMatch[1]} = ${rangeExpr}`);
      indentStack.push(indent);
    } else if (forInMatch) {
      out.push(`${" ".repeat(indent)}for ${forInMatch[1]} = ${forInMatch[2]}`);
      indentStack.push(indent);
    } else if (ifMatch) {
      out.push(`${" ".repeat(indent)}if ${ifMatch[1]}`);
      indentStack.push(indent);
    } else if (elifMatch) {
      out.push(`${" ".repeat(indent)}elseif ${elifMatch[1]}`);
    } else if (elseMatch) {
      out.push(`${" ".repeat(indent)}else`);
    } else if (printMatch) {
      const inner = printMatch[1].replace(/^f(["'])/, "$1");
      out.push(`${" ".repeat(indent)}disp(${inner});`);
    } else if (line.startsWith("return ")) {
      out.push(`${" ".repeat(indent)}result = ${line.slice(7)};`);
    } else {
      const needsSemi = !line.endsWith(";") && !line.startsWith("%");
      out.push(`${" ".repeat(indent)}${line}${needsSemi ? ";" : ""}`);
    }
  }

  closeIndentsTo(0);
  return out.join("\n");
}

/**
 * Deterministic client-side Python (NumPy/SciPy/Matplotlib) -> Wolfram Mathematica translator.
 */
function quickPythonToMathematica(pythonCode: string): string {
  const lines = pythonCode.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [
    "(* Wolfram Mathematica / Wolfram Language translation (auto-converted from Python) *)",
    "(* Tip: Click 'Refine with AI' if you have a connected AI key for idiomatic Wolfram symbolic/Plot forms. *)",
    "ClearAll[\"Global`*\"];",
    "",
  ];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (/^(?:import\s+|from\s+\S+\s+import\s+)/.test(trimmed)) {
      out.push(`(* Python import: ${trimmed} — built-in in Mathematica *)`);
      continue;
    }
    if (trimmed.startsWith("#")) {
      out.push(`(* ${trimmed.slice(1).trim()} *)`);
      continue;
    }

    let line = trimmed;
    // Inline comment
    line = line.replace(/(?<!['"])#(.*)$/, " (* $1 *)");
    // Scientific notation 1e-6 -> 1*^-6
    line = line.replace(/(\d+(?:\.\d+)?)e([+-]?\d+)/gi, "$1*^$2");
    // Power operator
    line = line.replace(/\*\*/g, "^");
    // Common functions
    line = line
      .replace(/\bnp\.pi\b|\bmath\.pi\b/g, "Pi")
      .replace(/\bnp\.sqrt\(([^)]+)\)|\bmath\.sqrt\(([^)]+)\)/g, "Sqrt[$1$2]")
      .replace(/\bnp\.sin\(([^)]+)\)|\bmath\.sin\(([^)]+)\)/g, "Sin[$1$2]")
      .replace(/\bnp\.cos\(([^)]+)\)|\bmath\.cos\(([^)]+)\)/g, "Cos[$1$2]")
      .replace(/\bnp\.tan\(([^)]+)\)|\bmath\.tan\(([^)]+)\)/g, "Tan[$1$2]")
      .replace(/\bnp\.exp\(([^)]+)\)|\bmath\.exp\(([^)]+)\)/g, "Exp[$1$2]")
      .replace(/\bnp\.log10\(([^)]+)\)/g, "Log10[$1]")
      .replace(/\bnp\.log\(([^)]+)\)|\bmath\.log\(([^)]+)\)/g, "Log[$1$2]")
      .replace(/\bnp\.abs\(([^)]+)\)/g, "Abs[$1]")
      .replace(/\bspecial\.jv\(([^,]+),\s*([^)]+)\)|\bjv\(([^,]+),\s*([^)]+)\)/g, "BesselJ[$1$3, $2$4]")
      .replace(/\bspecial\.kn\(([^,]+),\s*([^)]+)\)|\bkn\(([^,]+),\s*([^)]+)\)/g, "BesselK[$1$3, $2$4]")
      .replace(/\bnp\.linspace\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, "Subdivide[$1, $2, $3 - 1]")
      .replace(/\bnp\.array\(\[([^\]]*)\]\)/g, "{$1}")
      .replace(/\bnp\.linalg\.eig\(([^)]+)\)/g, "Eigensystem[$1]")
      .replace(/\bplt\.plot\(([^)]+)\)/g, "ListLinePlot[Transpose[{$1}], PlotTheme -> \"Scientific\", GridLines -> Automatic]")
      .replace(/\bplt\.show\([^)]*\)/g, "(* Plots display inline automatically in Mathematica notebooks *)")
      .replace(/\bTrue\b/g, "True")
      .replace(/\bFalse\b/g, "False");

    const defMatch = line.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:/);
    const printMatch = line.match(/^print\s*\((.*)\)\s*$/);
    if (defMatch) {
      const params = defMatch[2]
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `${p.split("=")[0].trim()}_`)
        .join(", ");
      out.push(`${defMatch[1]}[${params}] := Module[{}, (* body below *)`);
    } else if (printMatch) {
      out.push(`Print[${printMatch[1].replace(/^f(["'])/, "$1")}];`);
    } else {
      const needsSemi = !line.endsWith(";") && !line.startsWith("(*") && !line.startsWith("ListLinePlot");
      out.push(`${line}${needsSemi ? ";" : ""}`);
    }
  }

  return out.join("\n");
}

// Singleton lazy Pyodide loader (100% in-browser WebAssembly Python runtime, zero server required)
let pyodideInstancePromise: Promise<any> | null = null;

async function getPyodideRuntime(): Promise<any> {
  if (pyodideInstancePromise) return pyodideInstancePromise;
  pyodideInstancePromise = (async () => {
    const win = window as any;
    if (!win.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Could not load in-browser Python runtime (Pyodide CDN unreachable)."));
        document.head.appendChild(script);
      });
    }
    const pyodide = await win.loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/",
    });
    return pyodide;
  })().catch((err) => {
    pyodideInstancePromise = null;
    throw err;
  });
  return pyodideInstancePromise;
}

function hashCodeKey(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function CodeSandbox({ code, title }: CodeSandboxProps) {
  const { theme } = useTheme();
  const { toast } = useToast();
  const detectedLang = useMemo(() => detectLanguage(code), [code]);

  // Scientific / non-JS code state
  const [activeTab, setActiveTab] = useState<ScientificTab>(
    detectedLang === "matlab" ? "matlab" : detectedLang === "mathematica" ? "mathematica" : "python",
  );
  const [editablePython, setEditablePython] = useState(code);
  const [copied, setCopied] = useState(false);

  // Pyodide execution state
  const [runningPy, setRunningPy] = useState(false);
  const [pyStatus, setPyStatus] = useState<string>("");
  const [pyStdout, setPyStdout] = useState<string>("");
  const [pyError, setPyError] = useState<string>("");
  const [pyPlots, setPyPlots] = useState<string[]>([]);

  // AI-refined translations cached in localStorage
  const codeHash = useMemo(() => hashCodeKey(code), [code]);
  const [aiTranslations, setAiTranslations] = useState<Partial<Record<"matlab" | "mathematica", string>>>(() => {
    const initial: Partial<Record<"matlab" | "mathematica", string>> = {};
    try {
      const m = localStorage.getItem(`synapse_code_tr_${codeHash}_matlab`);
      const w = localStorage.getItem(`synapse_code_tr_${codeHash}_mathematica`);
      if (m) initial.matlab = m;
      if (w) initial.mathematica = w;
    } catch {
      // ignore storage errors
    }
    return initial;
  });
  const [translatingTarget, setTranslatingTarget] = useState<"matlab" | "mathematica" | null>(null);
  const [sandpackFallback, setSandpackFallback] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayedMatlab = useMemo(
    () => aiTranslations.matlab || (detectedLang === "matlab" ? code : quickPythonToMatlab(editablePython)),
    [aiTranslations.matlab, detectedLang, code, editablePython],
  );

  const displayedMathematica = useMemo(
    () => aiTranslations.mathematica || (detectedLang === "mathematica" ? code : quickPythonToMathematica(editablePython)),
    [aiTranslations.mathematica, detectedLang, code, editablePython],
  );

  // For true Web/JS/TS/React/HTML code, use Sandpack (with a safe toggle to plain code if blocked)
  const isWebCode =
    detectedLang === "javascript" ||
    detectedLang === "typescript" ||
    detectedLang === "react" ||
    detectedLang === "html";

  if (isWebCode && !sandpackFallback) {
    let template: "vanilla" | "react" | "vanilla-ts" | "react-ts" = "vanilla";
    let activeFile = "/index.js";

    if (detectedLang === "react") {
      template = code.includes("interface") || code.includes("type ") ? "react-ts" : "react";
      activeFile = template === "react-ts" ? "/App.tsx" : "/App.js";
    } else if (detectedLang === "typescript") {
      template = "vanilla-ts";
      activeFile = "/index.ts";
    } else if (detectedLang === "html") {
      activeFile = "/index.html";
      template = "vanilla";
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5 text-primary" />
            Interactive Browser Sandbox ({detectedLang.toUpperCase()})
          </span>
          <button
            type="button"
            onClick={() => setSandpackFallback(true)}
            className="text-[11px] underline underline-offset-2 hover:text-foreground"
          >
            Switch to plain code view
          </button>
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          <Suspense
            fallback={
              <div className="p-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading interactive web sandbox…
              </div>
            }
          >
            <LazySandpack
              template={template}
              theme={theme === "light" ? "light" : "dark"}
              files={{ [activeFile]: code }}
              options={{
                showNavigator: false,
                showTabs: true,
                editorHeight: 380,
                showLineNumbers: true,
                wrapContent: true,
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Scientific / Python / MATLAB / Mathematica / Plain Code Workbench
  const activeCode =
    activeTab === "python"
      ? editablePython
      : activeTab === "matlab"
      ? displayedMatlab
      : displayedMathematica;

  const activeExtension = activeTab === "python" ? "py" : activeTab === "matlab" ? "m" : "wl";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      toast({ title: "Code copied", description: `Copied ${activeTab.toUpperCase()} code to clipboard.` });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    const safeName = (title || "synapse-example").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 48);
    const blob = new Blob([activeCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.${activeExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunPythonInBrowser = async () => {
    setRunningPy(true);
    setPyError("");
    setPyStdout("");
    setPyPlots([]);
    setPyStatus("Loading in-browser Python (WebAssembly)… first run downloads ~10 MB once.");
    try {
      const pyodide = await getPyodideRuntime();
      setPyStatus("Loading scientific packages (NumPy / SciPy / Matplotlib if needed)…");
      try {
        await pyodide.loadPackagesFromImports(editablePython);
      } catch {
        // non-fatal — some imports may be stdlib or optional
      }

      setPyStatus("Running Python locally in your browser…");
      pyodide.globals.set("__synapse_user_code__", editablePython);

      const runner = `
import sys, io, base64, traceback
_buf = io.StringIO()
_orig_stdout, _orig_stderr = sys.stdout, sys.stderr
sys.stdout = _buf
sys.stderr = _buf
_plots = []
try:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as _plt
        def _capture_show(*args, **kwargs):
            for _num in _plt.get_fignums():
                _fig = _plt.figure(_num)
                _img = io.BytesIO()
                _fig.savefig(_img, format="png", dpi=130, bbox_inches="tight")
                _img.seek(0)
                _plots.append(base64.b64encode(_img.read()).decode("ascii"))
            _plt.close("all")
        _plt.show = _capture_show
    except Exception:
        pass

    exec(compile(__synapse_user_code__, "<lesson_example.py>", "exec"), {"__name__": "__main__"})

    try:
        import matplotlib.pyplot as _plt
        if _plt.get_fignums():
            for _num in _plt.get_fignums():
                _fig = _plt.figure(_num)
                _img = io.BytesIO()
                _fig.savefig(_img, format="png", dpi=130, bbox_inches="tight")
                _img.seek(0)
                _plots.append(base64.b64encode(_img.read()).decode("ascii"))
            _plt.close("all")
    except Exception:
        pass
    _err = ""
except Exception:
    _err = traceback.format_exc()
finally:
    sys.stdout = _orig_stdout
    sys.stderr = _orig_stderr
(_buf.getvalue(), _err, _plots)
`;
      const resultProxy = await pyodide.runPythonAsync(runner);
      const [stdoutStr, errStr, plotsArr] = resultProxy.toJs();
      resultProxy.destroy?.();

      setPyStdout(stdoutStr || "");
      setPyError(errStr || "");
      setPyPlots(Array.isArray(plotsArr) ? Array.from(plotsArr) : []);
      setPyStatus("");
    } catch (err: any) {
      setPyError(err?.message || "Failed to run Python in browser.");
      setPyStatus("");
    } finally {
      setRunningPy(false);
    }
  };

  const handleRefineWithAI = async (targetLanguage: "matlab" | "mathematica") => {
    setTranslatingTarget(targetLanguage);
    try {
      const res = await apiRequest("POST", "/api/ai/translate-code", {
        code: editablePython,
        sourceLanguage: "python",
        targetLanguage,
        contextTitle: title,
      });
      const data = await res.json();
      if (data.translatedCode) {
        setAiTranslations((prev) => ({ ...prev, [targetLanguage]: data.translatedCode }));
        try {
          localStorage.setItem(`synapse_code_tr_${codeHash}_${targetLanguage}`, data.translatedCode);
        } catch {
          // ignore
        }
        toast({
          title: `${targetLanguage === "matlab" ? "MATLAB" : "Mathematica"} translation refined!`,
          description: "Generated an idiomatic version using your connected AI provider.",
        });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      toast({
        title: "AI refinement requires a connected AI key",
        description: msg.includes("401") || msg.includes("402") || msg.includes("CHAT_PROVIDER_REQUIRED")
          ? "The instant auto-translated code is already shown above. Sign in and connect an AI key/subscription in Settings for full AI-idiomatic MATLAB/Mathematica conversion."
          : msg || "Could not refine translation right now.",
        variant: "destructive",
      });
    } finally {
      setTranslatingTarget(null);
    }
  };

  const isScientific =
    detectedLang === "python" || detectedLang === "matlab" || detectedLang === "mathematica" || detectedLang === "other";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid="scientific-code-workbench">
      {/* Header / Language Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {isScientific ? (
            <>
              {(
                [
                  { id: "python", label: "Python", badge: "Run in Browser" },
                  { id: "matlab", label: "MATLAB / Octave", badge: aiTranslations.matlab ? "AI Refined" : "Auto" },
                  { id: "mathematica", label: "Mathematica", badge: aiTranslations.mathematica ? "AI Refined" : "Auto" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors border",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/70 text-muted-foreground border-border/60 hover:text-foreground",
                  )}
                  data-testid={`button-code-lang-${tab.id}`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded px-1 py-0 text-[9px] font-normal",
                      activeTab === tab.id
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.badge}
                  </span>
                </button>
              ))}
            </>
          ) : (
            <Badge variant="outline" className="text-xs uppercase">
              {detectedLang}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeTab === "python" && isScientific && (
            <Button
              type="button"
              size="sm"
              onClick={handleRunPythonInBrowser}
              disabled={runningPy}
              className="h-7 px-2.5 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-run-python-pyodide"
            >
              {runningPy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              <span>{runningPy ? "Running…" : "Run in Browser"}</span>
            </Button>
          )}

          {(activeTab === "matlab" || activeTab === "mathematica") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={translatingTarget === activeTab}
              onClick={() => handleRefineWithAI(activeTab)}
              className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              title="Use your connected AI provider for a publication-grade idiomatic translation"
              data-testid={`button-refine-${activeTab}`}
            >
              {translatingTarget === activeTab ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span>Refine with AI</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-7 px-2 text-xs gap-1"
            data-testid="button-copy-code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>Copy</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
            className="h-7 px-2 text-xs gap-1"
            title={`Download as .${activeExtension}`}
            data-testid="button-download-code"
          >
            <Download className="h-3.5 w-3.5" />
            <span>.{activeExtension}</span>
          </Button>
        </div>
      </div>

      {/* Explanatory Banner (No mysterious remote "server" errors!) */}
      <div className="flex items-start gap-2 border-b border-border/60 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
        {activeTab === "python" ? (
          <span>
            <strong>No Python installation or remote server needed:</strong> Click <em>Run in Browser</em> to execute this script locally inside your browser via WebAssembly (supports <code className="font-mono">numpy</code>, <code className="font-mono">scipy</code>, and <code className="font-mono">matplotlib</code> plots), or edit the code directly below.
          </span>
        ) : activeTab === "matlab" ? (
          <span>
            <strong>MATLAB / GNU Octave version:</strong> Copy or download <code className="font-mono">.m</code> to run in MATLAB or free GNU Octave.{" "}
            {!aiTranslations.matlab && "Currently showing an instant auto-conversion; click Refine with AI (optional) for full idiomatic polish."}
          </span>
        ) : (
          <span>
            <strong>Wolfram Mathematica version:</strong> Copy or download <code className="font-mono">.wl</code> to paste into a Mathematica notebook or Wolfram Engine.{" "}
            {!aiTranslations.mathematica && "Currently showing an instant auto-conversion; click Refine with AI (optional) for full symbolic/plotting polish."}
          </span>
        )}
      </div>

      {/* Code Area */}
      {activeTab === "python" && isScientific ? (
        <textarea
          ref={textareaRef}
          value={editablePython}
          onChange={(e) => setEditablePython(e.target.value)}
          spellCheck={false}
          rows={Math.min(24, Math.max(8, editablePython.split("\n").length + 1))}
          className="w-full resize-y bg-zinc-950 text-zinc-100 font-mono text-xs leading-relaxed p-4 focus:outline-none"
          data-testid="textarea-python-editor"
        />
      ) : (
        <pre className="w-full overflow-x-auto bg-zinc-950 text-zinc-100 font-mono text-xs leading-relaxed p-4 max-h-[440px]">
          <code>{activeCode}</code>
        </pre>
      )}

      {/* Pyodide Output Console & Plots */}
      {(pyStatus || pyStdout || pyError || pyPlots.length > 0) && activeTab === "python" && (
        <div className="border-t border-border bg-background/95 p-3 space-y-2.5" data-testid="pyodide-output-panel">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Terminal className="h-3.5 w-3.5 text-emerald-500" />
            <span>In-Browser Python Output</span>
          </div>
          {pyStatus && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {pyStatus}
            </p>
          )}
          {pyStdout && (
            <pre className="rounded-md bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto whitespace-pre-wrap">
              {pyStdout}
            </pre>
          )}
          {pyError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-400 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Python Execution Note</span>
              </div>
              <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">{pyError}</pre>
            </div>
          )}
          {pyPlots.length > 0 && (
            <div className="space-y-2">
              {pyPlots.map((b64, idx) => (
                <img
                  key={idx}
                  src={`data:image/png;base64,${b64}`}
                  alt={`Python Matplotlib Output ${idx + 1}`}
                  className="max-w-full rounded-md border border-border bg-white p-1"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
