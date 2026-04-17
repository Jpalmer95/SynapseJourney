import { useRef, useMemo, useState, useEffect, useCallback } from "react";
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

interface GraphNode {
  id: number;
  title: string;
  category?: string;
  color: string;
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
  const graphRef = useRef<any>();
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [centeredNode, setCenteredNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [timeRange, setTimeRange] = useState([100]);
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [synthesisTopicsStr, setSynthesisTopicsStr] = useState("");

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
  }>({
    queryKey: ["/api/knowledge-graph"],
  });

  const sampleNodes: GraphNode[] = useMemo(() => [
    { id: 1, title: "Machine Learning", category: "AI", color: "#8b5cf6", mastery: 75, status: "learning" as const },
    { id: 2, title: "Neural Networks", category: "AI", color: "#8b5cf6", mastery: 60, status: "learning" as const },
    { id: 9, title: "Deep Learning", category: "AI", color: "#8b5cf6", mastery: 30, status: "discovered" as const },
    { id: 7, title: "Computer Vision", category: "AI", color: "#8b5cf6", mastery: 40, status: "discovered" as const },
    { id: 3, title: "Linear Algebra", category: "Math", color: "#3b82f6", mastery: 85, status: "mastered" as const },
    { id: 4, title: "Calculus", category: "Math", color: "#3b82f6", mastery: 90, status: "mastered" as const },
    { id: 5, title: "Python", category: "CS", color: "#22c55e", mastery: 95, status: "mastered" as const },
    { id: 6, title: "Data Structures", category: "CS", color: "#22c55e", mastery: 70, status: "learning" as const },
    { id: 11, title: "Quantum Mechanics", category: "Physics", color: "#eab308", mastery: 0, status: "unexplored" as const },
    { id: 24, title: "General Chemistry", category: "Chemistry", color: "#14b8a6", mastery: 35, status: "learning" as const },
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

    // Map to ForceGraph3D exact format
    const nodes = filteredNodes.map(n => ({...n, val: 1})); // Use val for sizing manually via three
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

      <div ref={containerRef} className="absolute inset-0 z-0">
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
