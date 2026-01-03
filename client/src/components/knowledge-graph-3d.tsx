import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, ZoomIn, ZoomOut, Info, Maximize2, Minus, Plus } from "lucide-react";
import type { Topic, TopicConnection, UserProgress, Category } from "@shared/schema";

interface GraphNode {
  id: number;
  title: string;
  category?: string;
  color: string;
  x: number;
  y: number;
  mastery: number;
  status: string;
}

interface GraphEdge {
  from: number;
  to: number;
  strength: number;
}

export function KnowledgeGraph3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [timeRange, setTimeRange] = useState([100]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  const { data: graphData } = useQuery<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats: { total: number; mastered: number; learning: number };
  }>({
    queryKey: ["/api/knowledge-graph"],
  });

  const sampleNodes: GraphNode[] = useMemo(() => {
    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    
    return [
      { id: 1, title: "Machine Learning", category: "AI", color: "#8b5cf6", x: centerX, y: centerY, mastery: 75, status: "learning" },
      { id: 2, title: "Neural Networks", category: "AI", color: "#8b5cf6", x: centerX + 120, y: centerY - 80, mastery: 60, status: "learning" },
      { id: 3, title: "Linear Algebra", category: "Math", color: "#3b82f6", x: centerX - 100, y: centerY - 120, mastery: 85, status: "mastered" },
      { id: 4, title: "Calculus", category: "Math", color: "#3b82f6", x: centerX - 150, y: centerY + 50, mastery: 90, status: "mastered" },
      { id: 5, title: "Python", category: "Programming", color: "#22c55e", x: centerX + 80, y: centerY + 130, mastery: 95, status: "mastered" },
      { id: 6, title: "Data Structures", category: "CS", color: "#f59e0b", x: centerX + 180, y: centerY + 40, mastery: 70, status: "learning" },
      { id: 7, title: "Computer Vision", category: "AI", color: "#8b5cf6", x: centerX + 50, y: centerY - 170, mastery: 40, status: "discovered" },
      { id: 8, title: "Statistics", category: "Math", color: "#3b82f6", x: centerX - 60, y: centerY + 150, mastery: 55, status: "learning" },
      { id: 9, title: "Deep Learning", category: "AI", color: "#8b5cf6", x: centerX + 160, y: centerY - 140, mastery: 30, status: "discovered" },
      { id: 10, title: "Graph Theory", category: "Math", color: "#3b82f6", x: centerX - 180, y: centerY - 40, mastery: 45, status: "discovered" },
    ];
  }, []);

  const sampleEdges: GraphEdge[] = useMemo(() => [
    { from: 1, to: 2, strength: 8 },
    { from: 1, to: 3, strength: 6 },
    { from: 2, to: 7, strength: 7 },
    { from: 2, to: 9, strength: 9 },
    { from: 3, to: 4, strength: 8 },
    { from: 3, to: 8, strength: 5 },
    { from: 5, to: 1, strength: 6 },
    { from: 5, to: 6, strength: 7 },
    { from: 6, to: 10, strength: 4 },
    { from: 8, to: 1, strength: 6 },
    { from: 4, to: 1, strength: 5 },
  ], []);

  const nodes = graphData?.nodes || sampleNodes;
  const edges = graphData?.edges || sampleEdges;
  const stats = graphData?.stats || { total: 10, mastered: 3, learning: 4 };

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((r) => r + 0.002);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const getRotatedPosition = useCallback((node: GraphNode) => {
    const centerX = 400;
    const centerY = 300;
    const dx = node.x - centerX;
    const dy = node.y - centerY;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos,
    };
  }, [rotation]);

  const getNodeColor = (status: string) => {
    if (status === "mastered") return "#22c55e";
    if (status === "learning") return "#8b5cf6";
    if (status === "discovered") return "#f59e0b";
    return "#6b7280";
  };

  const getNodeSize = (mastery: number) => {
    return 20 + (mastery / 100) * 20;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  return (
    <div className="h-screen w-full relative bg-background overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      
      <div className="absolute top-4 left-4 md:left-20 z-10 flex flex-col gap-4">
        <Card className="p-4 bg-background/80 backdrop-blur-lg">
          <h2 className="text-lg font-semibold mb-3">Your Knowledge Space</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Topics</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{stats.mastered}</p>
              <p className="text-xs text-muted-foreground">Mastered</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-violet-500">{stats.learning}</p>
              <p className="text-xs text-muted-foreground">Learning</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-background/80 backdrop-blur-lg">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Legend</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Mastered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500" />
              <span className="text-muted-foreground">Learning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Discovered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-muted-foreground">Unexplored</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomIn} data-testid="button-zoom-in">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut} data-testid="button-zoom-out">
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleReset} data-testid="button-reset-view">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="absolute bottom-24 md:bottom-8 left-4 right-4 md:left-20 md:right-20 z-10">
        <Card className="p-4 bg-background/80 backdrop-blur-lg max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Timeline</span>
            <span className="text-sm font-medium">Last {timeRange[0]} days</span>
          </div>
          <Slider
            value={timeRange}
            onValueChange={setTimeRange}
            min={7}
            max={365}
            step={1}
            className="w-full"
            data-testid="slider-timeline"
          />
        </Card>
      </div>

      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map((edge, i) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            const fromPos = getRotatedPosition(fromNode);
            const toPos = getRotatedPosition(toNode);
            return (
              <line
                key={i}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="hsl(var(--primary))"
                strokeWidth={1 + edge.strength / 5}
                strokeOpacity={0.15 + edge.strength * 0.03}
                className="transition-all duration-300"
              />
            );
          })}

          {nodes.map((node) => {
            const pos = getRotatedPosition(node);
            const size = getNodeSize(node.mastery);
            const color = getNodeColor(node.status);
            const isHovered = hoveredNode?.id === node.id;
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer transition-transform duration-300"
                style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${isHovered || isSelected ? 1.2 : 1})` }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(node)}
              >
                <circle
                  r={size * 1.3}
                  fill={color}
                  opacity={0.1}
                  className="transition-all duration-300"
                />
                <circle
                  r={size}
                  fill={color}
                  filter={isHovered || isSelected ? "url(#glow)" : undefined}
                  className="transition-all duration-300"
                />
                <circle
                  r={size * 0.6}
                  fill={color}
                  opacity={0.6}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <AnimatePresence>
        {(hoveredNode || selectedNode) && (
          <motion.div
            className="absolute pointer-events-none z-20"
            style={{
              left: getRotatedPosition(hoveredNode || selectedNode!).x * zoom + pan.x,
              top: getRotatedPosition(hoveredNode || selectedNode!).y * zoom + pan.y - 80,
              transform: "translateX(-50%)",
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Card className="p-3 bg-popover/95 backdrop-blur-md shadow-lg pointer-events-auto">
              <p className="font-semibold text-sm">{(hoveredNode || selectedNode)!.title}</p>
              {(hoveredNode || selectedNode)!.category && (
                <p className="text-xs text-muted-foreground">{(hoveredNode || selectedNode)!.category}</p>
              )}
              <p className="text-xs mt-1">Mastery: {(hoveredNode || selectedNode)!.mastery}%</p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedNode && (
        <motion.div
          className="absolute bottom-24 md:bottom-28 right-4 md:right-20 z-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <Card className="p-4 w-64 bg-background/95 backdrop-blur-lg">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold">{selectedNode.title}</h3>
                <Badge variant="secondary" className="mt-1">
                  {selectedNode.category}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedNode(null)}
                className="h-6 w-6"
              >
                ×
              </Button>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Mastery</span>
                <span className="font-medium">{selectedNode.mastery}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${selectedNode.mastery}%` }}
                />
              </div>
            </div>
            <Button className="w-full mt-4" size="sm" data-testid="button-explore-topic">
              Explore Topic
            </Button>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
