import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const MermaidDiagram = ({ chart }: { chart: string }) => {
  const { theme } = useTheme();
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.15);
  const [fullscreenOpen, setFullscreenOpen] = useState<boolean>(false);
  const [fullscreenZoom, setFullscreenZoom] = useState<number>(1.35);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const isLight = theme === "light";

    mermaid.initialize({
      startOnLoad: false,
      theme: isLight ? "default" : "dark",
      securityLevel: "loose",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 15,
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        padding: 18,
        nodeSpacing: 45,
        rankSpacing: 55,
      },
      sequence: {
        useMaxWidth: false,
      },
      themeVariables: {
        fontSize: "15px",
        fontFamily: "Inter, system-ui, sans-serif",
      },
    });

    const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
    mermaid
      .render(id, chart)
      .then((res) => {
        if (cancelled) return;
        setError(null);
        // Ensure the SVG renders at crisp readable size instead of squishing to tiny text
        const cleaned = res.svg.replace(
          /<svg([^>]*)style="[^"]*max-width:[^"]*"([^>]*)>/i,
          '<svg$1$2>',
        );
        setSvgHtml(cleaned);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Mermaid error:", err);
        setError("Failed to render diagram");
        setSvgHtml("");
      });

    return () => {
      cancelled = true;
    };
  }, [chart, theme]);

  const adjustZoom = (delta: number) => {
    setZoom((z) => Math.max(0.6, Math.min(2.5, Number((z + delta).toFixed(2)))));
  };

  const adjustFullscreenZoom = (delta: number) => {
    setFullscreenZoom((z) => Math.max(0.6, Math.min(3.0, Number((z + delta).toFixed(2)))));
  };

  if (error) {
    return (
      <div className="text-red-500 text-sm p-4 border border-red-500/20 rounded bg-red-500/5">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {/* Zoom & Fullscreen Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="text-[11px]">
          Scroll to pan · Use zoom or fullscreen for larger text
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => adjustZoom(-0.2)}
            className="h-7 w-7 p-0"
            title="Zoom out"
            data-testid="button-mermaid-zoom-out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom(1.15)}
            className="h-7 px-2 text-[11px] font-mono"
            title="Reset zoom"
            data-testid="button-mermaid-zoom-reset"
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => adjustZoom(0.2)}
            className="h-7 w-7 p-0"
            title="Zoom in"
            data-testid="button-mermaid-zoom-in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFullscreenOpen(true)}
            className="h-7 px-2 gap-1 text-[11px]"
            title="Open visual map in fullscreen"
            data-testid="button-mermaid-fullscreen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Expand</span>
          </Button>
        </div>
      </div>

      {/* Scrollable Diagram Viewport */}
      <div
        ref={containerRef}
        className="w-full overflow-auto rounded-lg border border-border/60 bg-background/70 p-4 max-h-[540px] mermaid-container"
      >
        <div
          className="inline-block min-w-full origin-top-left transition-transform duration-150"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>

      {/* Fullscreen Lightbox Dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[88vh] flex flex-col p-4">
          <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2 border-b">
            <DialogTitle className="text-base">Visual Map (Expanded View)</DialogTitle>
            <div className="flex items-center gap-1 pr-8">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => adjustFullscreenZoom(-0.2)}
                className="h-7 w-7 p-0"
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFullscreenZoom(1.35)}
                className="h-7 px-2 text-xs font-mono gap-1"
                title="Reset zoom"
              >
                <RotateCcw className="h-3 w-3" />
                {Math.round(fullscreenZoom * 100)}%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => adjustFullscreenZoom(0.2)}
                className="h-7 w-7 p-0"
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg border border-border/60 bg-background/80 p-6">
            <div
              className="inline-block min-w-full transition-transform duration-150"
              style={{
                transform: `scale(${fullscreenZoom})`,
                transformOrigin: "top left",
              }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
