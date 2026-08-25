import { useRef, useMemo, useState, useEffect, useCallback, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, Info, Search, X, Focus, Expand, Flame } from "lucide-react";
import { Link } from "wouter";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { AiChat } from "@/components/ai-chat";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface GraphNode {
  id: number;
  title: string;
  category?: string;
  color: string;
  x: number;
  y: number;
  z: number;
  mastery: number;
  status: "mastered" | "learning" | "discovered" | "unexplored";
}

interface GraphEdge {
  from: number;
  to: number;
  strength: number;
}

// Metadata for the three semantic axes. Colors match the legend; each pole also
// uses a DISTINCT shape (cube / cone / octahedron) so colorblind users can tell
// the axes apart without relying on color alone.
const AXIS_META: Record<
  "x" | "y" | "z",
  { color: number; hex: string; label: string; desc: string }
> = {
  x: {
    color: 0x22d3ee,
    hex: "#22d3ee",
    label: "Applied ↔ Theoretical",
    desc: "How you engage the topic: hands-on building and application vs. understanding underlying principles and theory.",
  },
  y: {
    color: 0x34d399,
    hex: "#34d399",
    label: "Natural ↔ Synthetic",
    desc: "What the topic is about: the natural/physical world vs. human-made and synthetic systems (software, tools, language).",
  },
  z: {
    color: 0xfbbf24,
    hex: "#fbbf24",
    label: "Micro ↔ Macro",
    desc: "The scale of the topic: subatomic and microscopic vs. planetary, cosmic, and systemic.",
  },
};

interface AxisInfo {
  key: "x" | "y" | "z";
  label: string;
  desc: string;
  hex: string;
  end?: "positive" | "negative";
  poleLabel?: string;
}

export function KnowledgeGraph3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>();
  const axisGroupRef = useRef<THREE.Group | null>(null);
  const axisHitRef = useRef<THREE.Mesh[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [centeredNode, setCenteredNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [timeRange, setTimeRange] = useState([100]);
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [synthesisTopicsStr, setSynthesisTopicsStr] = useState("");
  const [selectedAxis, setSelectedAxis] = useState<AxisInfo | null>(null);

  // Narrow-viewport fallback: react-force-graph-3d is WebGL + pointer-event
  // driven and is unusable on touch. Below 768px we render a touch-friendly
  // 2D scrollable list instead (roadmap B).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  const { data: graphData } = useQuery<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats: { total: number; mastered: number; learning: number };
    axes?: { x: string; y: string; z: string };
  }>({
    queryKey: ["/api/knowledge-graph"],
  });

  const sampleNodes: GraphNode[] = useMemo(() => [
    { id: 1, title: "Machine Learning", category: "AI", color: "#8b5cf6", x: 60, y: -40, z: 0, mastery: 75, status: "learning" as const },
    { id: 2, title: "Neural Networks", category: "AI", color: "#8b5cf6", x: 50, y: -30, z: 10, mastery: 60, status: "learning" as const },
    { id: 9, title: "Deep Learning", category: "AI", color: "#8b5cf6", x: 55, y: -35, z: -5, mastery: 30, status: "discovered" as const },
    { id: 7, title: "Computer Vision", category: "AI", color: "#8b5cf6", x: 45, y: -45, z: 15, mastery: 40, status: "discovered" as const },
    { id: 3, title: "Linear Algebra", category: "Math", color: "#3b82f6", x: -40, y: 50, z: 20, mastery: 85, status: "mastered" as const },
    { id: 4, title: "Calculus", category: "Math", color: "#3b82f6", x: -50, y: 55, z: 15, mastery: 90, status: "mastered" as const },
    { id: 5, title: "Python", category: "CS", color: "#22c55e", x: 30, y: -50, z: -10, mastery: 95, status: "mastered" as const },
    { id: 6, title: "Data Structures", category: "CS", color: "#22c55e", x: 25, y: -55, z: -15, mastery: 70, status: "learning" as const },
    { id: 11, title: "Quantum Mechanics", category: "Physics", color: "#eab308", x: -60, y: -20, z: -30, mastery: 0, status: "unexplored" as const },
    { id: 24, title: "General Chemistry", category: "Chemistry", color: "#14b8a6", x: -55, y: -25, z: -35, mastery: 35, status: "learning" as const },
  ], []);

  const sampleEdges: GraphEdge[] = useMemo(() => [
    { from: 1, to: 2, strength: 8 },
    { from: 1, to: 3, strength: 6 },
    { from: 3, to: 4, strength: 8 },
    { from: 5, to: 1, strength: 6 },
    { from: 5, to: 6, strength: 7 },
  ], []);

  const allNodes = graphData?.nodes || sampleNodes;
  const allEdges = graphData?.edges || sampleEdges;
  const stats = graphData?.stats || { total: 10, mastered: 2, learning: 4 };

  const { forceNodes, forceEdges } = useMemo(() => {
    let filteredNodes = allNodes;
    let filteredEdges = allEdges;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredNodes = allNodes.filter(n => 
        n.title.toLowerCase().includes(query) || 
        n.category?.toLowerCase().includes(query)
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = allEdges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
    }

    if (centeredNode) {
      // Show 2 degrees of connections
      const connected = new Set<number>([centeredNode.id]);
      let frontier = new Set<number>([centeredNode.id]);
      
      for (let i = 0; i < 2; i++) {
        const newFrontier = new Set<number>();
        allEdges.forEach(edge => {
          if (frontier.has(edge.from)) { newFrontier.add(edge.to); connected.add(edge.to); }
          if (frontier.has(edge.to)) { newFrontier.add(edge.from); connected.add(edge.from); }
        });
        frontier = newFrontier;
      }
      filteredNodes = allNodes.filter(n => connected.has(n.id));
      filteredEdges = allEdges.filter(e => connected.has(e.from) && connected.has(e.to));
    }

    // Map to ForceGraph3D exact format. Pin nodes to their PCA coordinates via
    // fx/fy/fz so the layout stays relationally indexed (not force-scattered).
    const nodes = filteredNodes.map(n => ({ ...n, val: 1, fx: n.x, fy: n.y, fz: n.z }));
    const links = filteredEdges.map(e => ({ source: e.from, target: e.to, strength: e.strength }));

    return { forceNodes: nodes, forceEdges: links };
  }, [allNodes, allEdges, searchQuery, centeredNode]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allNodes.filter(n => 
      n.title.toLowerCase().includes(query) || 
      n.category?.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [allNodes, searchQuery]);

  // Set camera to orbit
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge').strength(-150);
    }
  }, [forceNodes]);

  // Draw the three semantic-axis reference lines directly in the three.js scene
  // so the relational frame described by the legend is actually visible. Nodes
  // are pinned to these same axes (fx/fy/fz), so the lines cross at the cloud's
  // origin. Each axis carries its distinct shape (cube / cone / octahedron) at
  // BOTH ends — a smaller marker on the left-term end (e.g. "Applied") and a
  // larger one on the right-term end (e.g. "Theoretical") — and each end has an
  // invisible hit-area that opens the axis definition on click.
  useEffect(() => {
    if (isMobile) return;
    const fg = graphRef.current;
    if (!fg) return;
    const scene = fg.scene();
    if (!scene) return;

    // Remove any previous axis group (and dispose its GPU resources).
    if (axisGroupRef.current) {
      scene.remove(axisGroupRef.current);
      axisGroupRef.current.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      });
      axisGroupRef.current = null;
    }
    axisHitRef.current = [];

    if (!allNodes.length) return;

    // Span the FULL cloud (allNodes), not the filtered subset — the axes define
    // the stable frame, independent of search/centering.
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const n of allNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
      if (n.z < minZ) minZ = n.z;
      if (n.z > maxZ) maxZ = n.z;
    }
    minX = Math.min(minX, 0); maxX = Math.max(maxX, 0);
    minY = Math.min(minY, 0); maxY = Math.max(maxY, 0);
    minZ = Math.min(minZ, 0); maxZ = Math.max(maxZ, 0);
    const padX = (maxX - minX) * 0.1 || 20;
    const padY = (maxY - minY) * 0.1 || 20;
    const padZ = (maxZ - minZ) * 0.1 || 20;

    const group = new THREE.Group();

    const axes: {
      key: "x" | "y" | "z";
      from: [number, number, number];
      to: [number, number, number];
    }[] = [
      { key: "x", from: [minX - padX, 0, 0], to: [maxX + padX, 0, 0] },
      { key: "y", from: [0, minY - padY, 0], to: [0, maxY + padY, 0] },
      { key: "z", from: [0, 0, minZ - padZ], to: [0, 0, maxZ + padZ] },
    ];

    for (const ax of axes) {
      const meta = AXIS_META[ax.key];

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax.from[0], ax.from[1], ax.from[2]),
        new THREE.Vector3(ax.to[0], ax.to[1], ax.to[2]),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: meta.color, transparent: true, opacity: 0.55 });
      group.add(new THREE.Line(lineGeo, lineMat));

      // Distinct pole shape per axis (cube / cone / octahedron) so colorblind
      // users can tell the three axes apart without relying on color. Placed at
      // BOTH ends: smaller on the left-term end ("Applied"), larger on the
      // right-term end ("Theoretical").
      const [leftTerm, rightTerm] = meta.label.split("↔").map((s) => s.trim());
      const makeShape = () =>
        ax.key === "x"
          ? new THREE.BoxGeometry(9, 9, 9)
          : ax.key === "y"
          ? new THREE.ConeGeometry(6, 13, 5)
          : new THREE.OctahedronGeometry(7);
      const label = graphData?.axes?.[ax.key] || meta.label;

      const poles: {
        pos: [number, number, number];
        scale: number;
        end: "positive" | "negative";
        poleLabel: string;
      }[] = [
        { pos: ax.from, scale: 1.0, end: "negative", poleLabel: rightTerm }, // larger (right term)
        { pos: ax.to, scale: 0.6, end: "positive", poleLabel: leftTerm },    // smaller (left term)
      ];

      for (const p of poles) {
        const shapeGeo = makeShape();
        const shapeMat = new THREE.MeshBasicMaterial({ color: meta.color, transparent: true, opacity: 0.9 });
        const marker = new THREE.Mesh(shapeGeo, shapeMat);
        marker.scale.setScalar(p.scale);
        marker.position.set(p.pos[0], p.pos[1], p.pos[2]);
        group.add(marker);

        // Invisible hit-area so either end is easy to click; carries the axis
        // definition + which end was clicked.
        const hitGeo = new THREE.SphereGeometry(16, 12, 12);
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.set(p.pos[0], p.pos[1], p.pos[2]);
        hit.userData = {
          type: "axis",
          key: ax.key,
          label,
          desc: meta.desc,
          hex: meta.hex,
          end: p.end,
          poleLabel: p.poleLabel,
        };
        group.add(hit);
        axisHitRef.current.push(hit);
      }
    }

    // Origin marker — the center where the three axes intersect.
    const originGeo = new THREE.SphereGeometry(4, 16, 16);
    const originMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.6 });
    const origin = new THREE.Mesh(originGeo, originMat);
    group.add(origin);

    scene.add(group);
    axisGroupRef.current = group;
  }, [allNodes, isMobile, graphData?.axes]);

  // Raycast a click against the invisible axis pole hit-areas; if one is hit,
  // open a details card with that axis's definition (colorblind-friendly).
  const handleAxisClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const fg = graphRef.current;
    if (!fg || axisHitRef.current.length === 0) return;
    const scene = fg.scene();
    const camera = fg.camera();
    if (!scene || !camera) return;

    scene.updateMatrixWorld(true);

    const rect = event.currentTarget.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(axisHitRef.current, false);
    if (hits.length > 0) {
      const ud = hits[0].object.userData as {
        type?: string;
        key?: AxisInfo["key"];
        label?: string;
        desc?: string;
        hex?: string;
        end?: AxisInfo["end"];
        poleLabel?: string;
      };
      if (ud?.type === "axis" && ud.key && ud.label && ud.desc && ud.hex) {
        setSelectedNode(null);
        setSelectedAxis({
          key: ud.key,
          label: ud.label,
          desc: ud.desc,
          hex: ud.hex,
          end: ud.end,
          poleLabel: ud.poleLabel,
        });
      }
    }
  }, []);

  const getNodeColor = (status: string) => {
    if (status === "mastered") return "#fbbf24"; // Gold
    if (status === "learning") return "#3b82f6"; // Neon Blue
    if (status === "discovered") return "#f59e0b"; // Amber
    return "#334155"; // Slate
  };

  const getNodeSize = (mastery: number, status: string) => {
    const baseSize = status === "unexplored" ? 4 : 6;
    return baseSize + (mastery / 100) * 8;
  };

  const handleNodeClick = useCallback((node: any) => {
    if (!node) return;
    setCenteredNode(node as GraphNode);
    setSelectedNode(node as GraphNode);
    setSearchQuery("");
    setShowSearch(false);
    
    // Animate camera to node
    const distance = 100;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    
    if (graphRef.current) {
       graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
        node, 
        2000
      );
    }
  }, []);

  const handleReset = () => {
    setCenteredNode(null);
    setSelectedNode(null);
    setSearchQuery("");
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 2000);
    }
  };

  const handleSynthesisQuest = () => {
    const mastered = allNodes.filter(n => n.status === "mastered");
    if (mastered.length >= 2) {
      const shuffled = [...mastered].sort(() => 0.5 - Math.random());
      setSynthesisTopicsStr(`${shuffled[0].title} & ${shuffled[1].title}`);
      setShowSynthesis(true);
    }
  };

  if (isMobile) {
    return <MobileKnowledgeList nodes={allNodes} axes={graphData?.axes} />;
  }

  return (
    <div className="h-screen w-full relative bg-[#0f172a] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="absolute top-4 left-4 md:left-20 z-10 flex flex-col gap-2 md:gap-4 max-w-[200px] md:max-w-xs">
        <Card className="p-3 md:p-4 bg-background/80 backdrop-blur-lg border-border">
          <div className="flex items-center justify-between mb-2 md:mb-3 gap-2">
            <h2 className="text-sm md:text-lg font-semibold text-white">Knowledge Map</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8"
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {searchResults.map(node => (
                      <button
                        key={node.id}
                        onClick={() => handleNodeClick(node)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex items-center gap-2"
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: getNodeColor(node.status) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{node.title}</p>
                          <p className="text-xs text-muted-foreground">{node.category}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {graphData?.axes && (
          <Card className="p-3 bg-background/80 backdrop-blur-lg">
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Knowledge axes
            </h3>
            <div className="space-y-1 text-[11px] leading-tight">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="cursor-help"><span className="text-primary font-medium">X:</span> {graphData.axes.x}</p>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px]">
                  How you engage the topic: hands-on building and application
                  vs. understanding underlying principles and theory.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="cursor-help"><span className="text-emerald-400 font-medium">Y:</span> {graphData.axes.y}</p>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px]">
                  What the topic is about: the natural/physical world vs.
                  human-made and synthetic systems (software, tools, language).
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="cursor-help"><span className="text-amber-400 font-medium">Z:</span> {graphData.axes.z}</p>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px]">
                  The scale of the topic: subatomic and microscopic vs.
                  planetary, cosmic, and systemic.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              The three colored axis lines cross at the map's center — each node sits where its topic lands on all three axes. Hover an axis for its meaning.
            </p>
          </Card>
        )}

        {stats.mastered >= 2 && (
          <motion.div initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}}>
            <Button onClick={handleSynthesisQuest} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold gap-2 relative overflow-hidden group shadow-[0_0_15px_rgba(234,88,12,0.5)] border border-orange-400/50">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <Flame className="w-4 h-4 text-yellow-300" />
              Synthesis Quest
            </Button>
          </motion.div>
        )}

        {centeredNode && (
          <Card className="p-3 bg-background/80 backdrop-blur-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Focus className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-white">Focused: {centeredNode.title}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon" onClick={handleReset} className="bg-background/80 backdrop-blur">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="absolute bottom-24 md:bottom-8 left-4 right-4 md:left-20 md:right-20 z-10">
        <Card className="p-4 bg-background/80 backdrop-blur-lg max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Timeline</span>
            <span className="text-sm font-medium text-white">Last {timeRange[0]} days</span>
          </div>
          <Slider value={timeRange} onValueChange={setTimeRange} min={7} max={365} step={1} className="w-full" />
        </Card>
      </div>

      <div ref={containerRef} className="absolute inset-0 z-0" onClick={handleAxisClick}>
        <ForceGraph3D
          ref={graphRef}
          width={containerSize.width}
          height={containerSize.height}
          graphData={{ nodes: forceNodes, links: forceEdges }}
          nodeLabel="title"
          nodeColor={(node: any) => getNodeColor(node.status)}
          nodeRelSize={6}
          nodeThreeObject={(node: any) => {
            const size = getNodeSize(node.mastery, node.status);
            const color = getNodeColor(node.status);
            
            // WebGL Neon Sphere for nodes
            const material = new THREE.MeshPhongMaterial({
              color: color,
              emissive: color,
              emissiveIntensity: node.status === 'learning' || node.status === 'mastered' ? 0.8 : 0.2,
              transparent: true,
              opacity: node.status === 'unexplored' ? 0.5 : 0.9,
            });
            const geometry = new THREE.SphereGeometry(size, 32, 32);
            return new THREE.Mesh(geometry, material);
          }}
          linkColor={() => "rgba(59, 130, 246, 0.4)"} // Faint Neon Blue links
          linkWidth={(link: any) => 1 + (link.strength || 1) * 0.2}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          backgroundColor="#0f172a"
          onNodeClick={handleNodeClick}
        />
      </div>

      {selectedNode && (
        <motion.div
          className="absolute bottom-24 md:bottom-28 left-4 right-4 md:left-auto md:right-20 z-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <Card className="p-4 w-full md:w-72 max-w-sm mx-auto md:mx-0 bg-background/95 backdrop-blur-lg">
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{selectedNode.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary">{selectedNode.category}</Badge>
                  <Badge 
                    variant="outline"
                    className={
                      selectedNode.status === "mastered" ? "text-yellow-500 border-yellow-500" :
                      selectedNode.status === "learning" ? "text-primary border-primary" :
                      "text-gray-500 border-gray-500"
                    }
                  >
                    {selectedNode.status}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {selectedNode.status !== "unexplored" && (
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Mastery</span>
                  <span className="font-medium text-white">{selectedNode.mastery}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      selectedNode.status === "mastered" ? "bg-yellow-500" : "bg-primary"
                    }`}
                    style={{ width: `${selectedNode.mastery}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-2 mt-4">
              <Link href={`/rabbit-hole?topic=${selectedNode.id}`} className="flex-1">
                <Button size="sm" className="w-full text-white">Explore Topic</Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Axis definition popover (opened by clicking an axis pole). */}
      {selectedAxis && (
        <motion.div
          className="absolute top-16 right-4 z-20 w-72 max-w-[calc(100vw-2rem)]"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <Card className="p-4 bg-background/95 backdrop-blur-lg border border-border">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: selectedAxis.hex }}
                />
                <h3 className="font-semibold text-white uppercase text-sm">
                  {selectedAxis.key}-axis
                </h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAxis(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm font-medium text-white mb-1">{selectedAxis.label}</p>
            {selectedAxis.poleLabel && (
              <p className="text-[11px] text-muted-foreground mb-1">
                You clicked the{" "}
                <span className="text-foreground font-medium">{selectedAxis.poleLabel}</span> end.
              </p>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">{selectedAxis.desc}</p>
          </Card>
        </motion.div>
      )}

      {/* Synthesis Quest AI Modal */}
      <AnimatePresence>
        {showSynthesis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute right-4 bottom-4 md:right-8 md:bottom-8 w-full md:w-[400px] h-[600px] max-h-[80vh] bg-background/95 backdrop-blur-xl border rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            <AiChat 
              synthesisTopics={synthesisTopicsStr} 
              onClose={() => setShowSynthesis(false)} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Touch-friendly 2D fallback for narrow viewports. Lists every topic with a
// search box; tapping a node opens an inline detail panel with mastery + a
// link into the topic. Replaces ForceGraph3D (broken on touch) below 768px.
function MobileKnowledgeList({
  nodes,
  axes,
}: {
  nodes: GraphNode[];
  axes?: { x: string; y: string; z: string };
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const filtered = query.trim()
    ? nodes.filter(
        (n) =>
          n.title.toLowerCase().includes(query.toLowerCase()) ||
          n.category?.toLowerCase().includes(query.toLowerCase())
      )
    : nodes;

  const statusColor: Record<GraphNode["status"], string> = {
    mastered: "#fbbf24",
    learning: "#3b82f6",
    discovered: "#f59e0b",
    unexplored: "#334155",
  };

  return (
    <div className="h-screen w-full bg-[#0f172a] flex flex-col">
      <div className="shrink-0 p-4 pb-2">
        <h2 className="text-base font-semibold text-white mb-1">Knowledge Map</h2>
        {axes && (
          <p className="text-[10px] text-muted-foreground/70 mb-2 leading-tight">
            {axes.x} · {axes.y} · {axes.z}
          </p>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics…"
            className="pl-9 pr-8 h-10"
            data-testid="mobile-graph-search"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <ul className="space-y-1.5">
          {filtered.map((node) => (
            <li key={node.id}>
              <button
                onClick={() => setSelected(node)}
                className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg bg-background/40 border border-border/40 active:bg-background/60"
                data-testid={`mobile-graph-node-${node.id}`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: statusColor[node.status] }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-white truncate">{node.title}</span>
                  <span className="block text-xs text-muted-foreground">{node.category}</span>
                </span>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                  {node.status}
                </Badge>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">No topics match.</li>
          )}
        </ul>
      </div>

      {selected && (
        <div className="shrink-0 border-t border-border bg-background/95 p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold text-white">{selected.title}</h3>
              <p className="text-xs text-muted-foreground capitalize">
                {selected.category} · {selected.status}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-muted-foreground hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {selected.status !== "unexplored" && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Mastery</span>
                <span className="text-white">{selected.mastery}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${selected.mastery}%` }}
                />
              </div>
            </div>
          )}
          <Link href={`/rabbit-hole?topic=${selected.id}`} className="block mt-3">
            <Button size="sm" className="w-full text-white">
              Explore Topic
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
