import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";

export const MermaidDiagram = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "light" ? "default" : "dark",
      securityLevel: "loose",
      fontFamily: "Inter, sans-serif",
    });

    if (ref.current) {
      ref.current.removeAttribute('data-processed');
      mermaid.render(`mermaid-${Math.random().toString(36).substring(7)}`, chart).then((res) => {
        if (ref.current) {
          ref.current.innerHTML = res.svg;
        }
      }).catch(err => {
        console.error("Mermaid error:", err);
        if (ref.current) ref.current.innerHTML = `<div class="text-red-500 text-sm p-4 border border-red-500/20 rounded bg-red-500/5">Failed to render diagram</div>`;
      });
    }
  }, [chart, theme]);

  return <div ref={ref} className="w-full flex justify-center overflow-x-auto py-4 mermaid-container" />;
};
