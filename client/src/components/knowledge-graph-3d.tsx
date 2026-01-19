import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, Info, Minus, Plus, Search, X, Focus, Expand } from "lucide-react";
import { Link } from "wouter";

interface GraphNode {
  id: number;
  title: string;
  category?: string;
  color: string;
  x: number;
  y: number;
  mastery: number;
  status: "mastered" | "learning" | "discovered" | "unexplored";
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
  const [centeredNode, setCenteredNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [timeRange, setTimeRange] = useState([100]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

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
    
    return [
      { id: 1, title: "Machine Learning", category: "AI", color: "#8b5cf6", x: centerX, y: centerY, mastery: 75, status: "learning" as const },
      { id: 2, title: "Neural Networks", category: "AI", color: "#8b5cf6", x: centerX + 120, y: centerY - 80, mastery: 60, status: "learning" as const },
      { id: 3, title: "Linear Algebra", category: "Math", color: "#3b82f6", x: centerX - 100, y: centerY - 120, mastery: 85, status: "mastered" as const },
      { id: 4, title: "Calculus", category: "Math", color: "#3b82f6", x: centerX - 150, y: centerY + 50, mastery: 90, status: "mastered" as const },
      { id: 5, title: "Python", category: "Programming", color: "#22c55e", x: centerX + 80, y: centerY + 130, mastery: 95, status: "mastered" as const },
      { id: 6, title: "Data Structures", category: "CS", color: "#f59e0b", x: centerX + 180, y: centerY + 40, mastery: 70, status: "learning" as const },
      { id: 7, title: "Computer Vision", category: "AI", color: "#8b5cf6", x: centerX + 50, y: centerY - 170, mastery: 40, status: "discovered" as const },
      { id: 8, title: "Statistics", category: "Math", color: "#3b82f6", x: centerX - 60, y: centerY + 150, mastery: 55, status: "learning" as const },
      { id: 9, title: "Deep Learning", category: "AI", color: "#8b5cf6", x: centerX + 160, y: centerY - 140, mastery: 30, status: "discovered" as const },
      { id: 10, title: "Graph Theory", category: "Math", color: "#3b82f6", x: centerX - 180, y: centerY - 40, mastery: 45, status: "discovered" as const },
      { id: 11, title: "Quantum Computing", category: "Physics", color: "#a855f7", x: centerX - 200, y: centerY - 150, mastery: 0, status: "unexplored" as const },
      { id: 12, title: "Cryptography", category: "Security", color: "#6366f1", x: centerX + 220, y: centerY - 60, mastery: 0, status: "unexplored" as const },
      { id: 13, title: "Robotics", category: "Engineering", color: "#ec4899", x: centerX - 120, y: centerY + 180, mastery: 0, status: "unexplored" as const },
      { id: 14, title: "Electromagnetism", category: "Physics", color: "#eab308", x: centerX + 100, y: centerY + 200, mastery: 0, status: "unexplored" as const },
      { id: 15, title: "Neuroscience", category: "Biology", color: "#f97316", x: centerX - 220, y: centerY + 100, mastery: 0, status: "unexplored" as const },
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
    { from: 10, to: 11, strength: 5 },
    { from: 6, to: 12, strength: 6 },
    { from: 2, to: 13, strength: 4 },
    { from: 4, to: 14, strength: 5 },
    { from: 2, to: 15, strength: 6 },
    { from: 11, to: 12, strength: 7 },
  ], []);

  const allNodes = graphData?.nodes || sampleNodes;
  const allEdges = graphData?.edges || sampleEdges;
  const stats = graphData?.stats || { total: 15, mastered: 3, learning: 4 };

  const getConnectedNodeIds = useCallback((nodeId: number, degrees: number = 2): Set<number> => {
    const connected = new Set<number>([nodeId]);
    let frontier = new Set<number>([nodeId]);
    
    for (let i = 0; i < degrees; i++) {
      const newFrontier = new Set<number>();
      allEdges.forEach(edge => {
        if (frontier.has(edge.from)) {
          newFrontier.add(edge.to);
          connected.add(edge.to);
        }
        if (frontier.has(edge.to)) {
          newFrontier.add(edge.from);
          connected.add(edge.from);
        }
      });
      frontier = newFrontier;
    }
    return connected;
  }, [allEdges]);

  const { nodes, edges } = useMemo(() => {
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
      const connectedIds = getConnectedNodeIds(centeredNode.id, 2);
      filteredNodes = allNodes.filter(n => connectedIds.has(n.id));
      filteredEdges = allEdges.filter(e => connectedIds.has(e.from) && connectedIds.has(e.to));
    }

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [allNodes, allEdges, searchQuery, centeredNode, getConnectedNodeIds]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allNodes.filter(n => 
      n.title.toLowerCase().includes(query) || 
      n.category?.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [allNodes, searchQuery]);

  useEffect(() => {
    if (!isAutoRotating) return;
    const interval = setInterval(() => {
      setRotation((r) => r + 0.001);
    }, 16);
    return () => clearInterval(interval);
  }, [isAutoRotating]);

  const getRotatedPosition = useCallback((node: GraphNode) => {
    const centerX = 400;
    const centerY = 300;
    let dx = node.x - centerX;
    let dy = node.y - centerY;

    if (centeredNode) {
      const cdx = centeredNode.x - centerX;
      const cdy = centeredNode.y - centerY;
      dx = (node.x - centeredNode.x) * 0.8;
      dy = (node.y - centeredNode.y) * 0.8;
      if (node.id === centeredNode.id) {
        dx = 0;
        dy = 0;
      }
    }

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos,
    };
  }, [rotation, centeredNode]);

  const getNodeColor = (status: string) => {
    if (status === "mastered") return "#fbbf24";
    if (status === "learning") return "#8b5cf6";
    if (status === "discovered") return "#f59e0b";
    return "#6b7280";
  };

  const getNodeSize = (mastery: number, status: string) => {
    const baseSize = status === "unexplored" ? 15 : 20;
    return baseSize + (mastery / 100) * 20;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !e.defaultPrevented) {
      setIsDragging(true);
      setIsAutoRotating(false);
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

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setCenteredNode(null);
    setSearchQuery("");
    setIsAutoRotating(true);
  };

  const handleNodeClick = (node: GraphNode) => {
    setCenteredNode(node);
    setSelectedNode(node);
    setIsAutoRotating(false);
    setSearchQuery("");
    setShowSearch(false);
  };

  const handleSearchSelect = (node: GraphNode) => {
    handleNodeClick(node);
  };

  const handleExitCenterMode = () => {
    setCenteredNode(null);
    setIsAutoRotating(true);
  };

  return (
    <div className="h-screen w-full relative bg-background overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      
      <div className="absolute top-4 left-4 md:left-20 z-10 flex flex-col gap-4 max-w-xs">
        <Card className="p-4 bg-background/80 backdrop-blur-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Knowledge Map</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowSearch(!showSearch)}
              data-testid="button-toggle-search"
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
                    data-testid="input-search-map"
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setSearchQuery("")}
                      data-testid="button-clear-search"
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
                        onClick={() => handleSearchSelect(node)}
                        className="w-full text-left px-3 py-2 rounded-md hover-elevate flex items-center gap-2"
                        data-testid={`search-result-${node.id}`}
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: getNodeColor(node.status) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{node.title}</p>
                          <p className="text-xs text-muted-foreground">{node.category}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Topics</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">{stats.mastered}</p>
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
              <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <span className="text-muted-foreground">Mastered (Gold)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-muted-foreground">Learning (Pulse)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Discovered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500 opacity-50" />
              <span className="text-muted-foreground">Unexplored</span>
            </div>
          </div>
        </Card>

        {centeredNode && (
          <Card className="p-3 bg-background/80 backdrop-blur-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Focus className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Focused: {centeredNode.title}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExitCenterMode}
                data-testid="button-exit-focus"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Showing 2 degrees of connection
            </p>
          </Card>
        )}
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
            <filter id="glow-gold">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feFlood floodColor="#fbbf24" floodOpacity="0.5" />
              <feComposite in2="coloredBlur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-learning">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feFlood floodColor="#8b5cf6" floodOpacity="0.6" />
              <feComposite in2="coloredBlur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-hover">
              <feGaussianBlur stdDeviation="5" result="coloredBlur" />
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
            
            const isConnectedToSelected = selectedNode && 
              (edge.from === selectedNode.id || edge.to === selectedNode.id);
            
            return (
              <line
                key={i}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke={isConnectedToSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                strokeWidth={isConnectedToSelected ? 2 : 1 + edge.strength / 6}
                strokeOpacity={isConnectedToSelected ? 0.8 : 0.15 + edge.strength * 0.02}
                className="transition-all duration-500"
              />
            );
          })}

          {nodes.map((node) => {
            const pos = getRotatedPosition(node);
            const size = getNodeSize(node.mastery, node.status);
            const color = getNodeColor(node.status);
            const isHovered = hoveredNode?.id === node.id;
            const isSelected = selectedNode?.id === node.id;
            const isCentered = centeredNode?.id === node.id;
            const isLearning = node.status === "learning";
            const isMastered = node.status === "mastered";
            const isUnexplored = node.status === "unexplored";

            let filter = undefined;
            if (isMastered) filter = "url(#glow-gold)";
            else if (isHovered || isSelected) filter = "url(#glow-hover)";

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={(e) => {
                  e.preventDefault();
                  handleNodeClick(node);
                }}
                data-testid={`node-${node.id}`}
              >
                {isLearning && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size * 1.8}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeOpacity={0.3}
                    className="animate-ping"
                  />
                )}

                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={size * 1.4}
                  fill={color}
                  opacity={isUnexplored ? 0.05 : 0.15}
                  className="transition-all duration-300"
                />
                
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={size}
                  fill={color}
                  opacity={isUnexplored ? 0.4 : 1}
                  filter={filter}
                  className="transition-all duration-300"
                  style={{
                    transform: `scale(${isHovered || isSelected || isCentered ? 1.2 : 1})`,
                    transformOrigin: `${pos.x}px ${pos.y}px`,
                  }}
                />
                
                {isMastered && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size * 0.5}
                    fill="#ffffff"
                    opacity={0.4}
                    className="transition-all duration-300"
                  />
                )}
                
                {!isUnexplored && (isHovered || isSelected || isCentered) && (
                  <text
                    x={pos.x}
                    y={pos.y + size + 16}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-xs font-medium pointer-events-none"
                    style={{ fontSize: 11 }}
                  >
                    {node.title}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <AnimatePresence>
        {hoveredNode && !selectedNode && (
          <motion.div
            className="absolute pointer-events-none z-20"
            style={{
              left: getRotatedPosition(hoveredNode).x * zoom + pan.x + window.innerWidth / 2 - 400 * zoom,
              top: getRotatedPosition(hoveredNode).y * zoom + pan.y + window.innerHeight / 2 - 300 * zoom - 80,
              transform: "translateX(-50%)",
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Card className="p-3 bg-popover/95 backdrop-blur-md shadow-lg">
              <p className="font-semibold text-sm">{hoveredNode.title}</p>
              {hoveredNode.category && (
                <p className="text-xs text-muted-foreground">{hoveredNode.category}</p>
              )}
              {hoveredNode.status !== "unexplored" && (
                <p className="text-xs mt-1">Mastery: {hoveredNode.mastery}%</p>
              )}
              <p className="text-xs text-primary mt-1">Click to focus</p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedNode && (
        <motion.div
          className="absolute bottom-24 md:bottom-28 right-4 md:right-20 z-20"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
        >
          <Card className="p-4 w-72 bg-background/95 backdrop-blur-lg">
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{selectedNode.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary">
                    {selectedNode.category}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={
                      selectedNode.status === "mastered" ? "text-yellow-600 border-yellow-600" :
                      selectedNode.status === "learning" ? "text-violet-600 border-violet-600" :
                      selectedNode.status === "discovered" ? "text-amber-600 border-amber-600" :
                      "text-gray-600 border-gray-600"
                    }
                  >
                    {selectedNode.status}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedNode(null)}
                data-testid="button-close-node-panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {selectedNode.status !== "unexplored" && (
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Mastery</span>
                  <span className="font-medium">{selectedNode.mastery}%</span>
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
                <Button size="sm" className="w-full" data-testid="button-explore-topic">
                  Explore Topic
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
