import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Lock, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Topic } from "@shared/schema";
import { useSFX } from "@/hooks/use-sfx";

interface PathwayTopic {
  topic: Topic;
  order: number;
  prerequisiteTopicIds?: number[] | null;
}

interface SkillTreeProps {
  topics: PathwayTopic[];
  masteredTopicIds: Set<number>;
  onTopicClick: (topicId: number) => void;
}

interface NodeLayout {
  id: number;
  topic: Topic;
  x: number;
  y: number;
  level: number;
  status: "locked" | "available" | "mastered";
  prerequisites: number[];
}

export function SkillTree({ topics, masteredTopicIds, onTopicClick }: SkillTreeProps) {
  const { playClick } = useSFX();

  // Compute Layout Heights & SVG Canvas size
  const NODE_WIDTH = 260;
  const NODE_HEIGHT = 90;
  const LEVEL_SPACING_Y = 160;
  const SIBLING_SPACING_X = 300;

  const { nodes, edges, maxLevel, width, height } = useMemo(() => {
    // 1. Build a map of node id -> prerequisites
    const prereqMap = new Map<number, number[]>();
    topics.forEach((pt) => {
      prereqMap.set(pt.topic.id, pt.prerequisiteTopicIds || []);
    });

    // 2. Compute Level for each node via topological sort / BFS constraint
    const levelMap = new Map<number, number>();
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 100) {
      changed = false;
      iterations++;
      for (const pt of topics) {
        const id = pt.topic.id;
        const prereqs = prereqMap.get(id) || [];
        
        if (prereqs.length === 0) {
          if (levelMap.get(id) !== 0) {
            levelMap.set(id, 0);
            changed = true;
          }
        } else {
          // Level is max(prereqs.level) + 1
          let missingPrereq = false;
          let maxPrereqLevel = -1;
          for (const pid of prereqs) {
            const pLevel = levelMap.get(pid);
            if (pLevel === undefined) {
              missingPrereq = true;
              break;
            }
            maxPrereqLevel = Math.max(maxPrereqLevel, pLevel);
          }
          
          if (!missingPrereq) {
            const newLevel = maxPrereqLevel + 1;
            if (levelMap.get(id) !== newLevel) {
              levelMap.set(id, newLevel);
              changed = true;
            }
          }
        }
      }
    }

    // 3. Fallback: if cyclical or missing prereq, just place at bottom level 
    // or by fallback order mapping.
    let maxLvl = 0;
    topics.forEach(pt => {
      if (!levelMap.has(pt.topic.id)) {
        levelMap.set(pt.topic.id, maxLvl + 1);
      }
      maxLvl = Math.max(maxLvl, levelMap.get(pt.topic.id)!);
    });

    // 4. Group by level to calculate X coordinates
    const levelGroups = new Map<number, PathwayTopic[]>();
    topics.forEach(pt => {
      const lvl = levelMap.get(pt.topic.id)!;
      if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
      levelGroups.get(lvl)!.push(pt);
    });

    // 5. Generate Node Layouts
    const computedNodes: NodeLayout[] = [];
    const computedEdges: { from: NodeLayout; to: NodeLayout; status: string }[] = [];
    let maxX = 0;
    let minX = 0;

    levelGroups.forEach((levelTopics, lvl) => {
      const count = levelTopics.length;
      // Center them horizontally
      const startX = -((count - 1) * SIBLING_SPACING_X) / 2;
      
      levelTopics.forEach((pt, index) => {
        const x = startX + (index * SIBLING_SPACING_X);
        const y = lvl * LEVEL_SPACING_Y;
        
        maxX = Math.max(maxX, x);
        minX = Math.min(minX, x);

        const isMastered = masteredTopicIds.has(pt.topic.id);
        const prereqs = prereqMap.get(pt.topic.id) || [];
        const isAvailable = prereqs.length === 0 || prereqs.every(pid => masteredTopicIds.has(pid));
        
        computedNodes.push({
          id: pt.topic.id,
          topic: pt.topic,
          x,
          y,
          level: lvl,
          status: isMastered ? "mastered" : isAvailable ? "available" : "locked",
          prerequisites: prereqs
        });
      });
    });

    // Shift everything to positive X space so standard Canvas/Div padding works natively
    const shiftX = Math.abs(minX) + (NODE_WIDTH / 2) + 20;
    computedNodes.forEach(node => { node.x += shiftX; });
    const computedWidth = maxX - minX + NODE_WIDTH + 40;
    const computedHeight = (maxLvl * LEVEL_SPACING_Y) + NODE_HEIGHT + 40;

    // 6. Generate Edges mapping
    computedNodes.forEach(node => {
      if (node.prerequisites.length > 0) {
        node.prerequisites.forEach(pid => {
          const parentNode = computedNodes.find(n => n.id === pid);
          if (parentNode) {
            computedEdges.push({
              from: parentNode,
              to: node,
              status: node.status === 'locked' ? 'locked' : node.status === 'mastered' ? 'mastered' : 'active'
            });
          }
        });
      }
    });

    // If there were NO explicit prereqs mapped, fall back to linear S-Curve DAG drawing based on 'order' constraints!
    if (computedEdges.length === 0 && computedNodes.length > 1) {
       // Sort nodes by original order fallback
       const sorted = [...computedNodes].sort((a,b) => {
         const oA = topics.find(t => t.topic.id === a.id)?.order || 0;
         const oB = topics.find(t => t.topic.id === b.id)?.order || 0;
         return oA - oB;
       });
       // Redraw them in a serpentine grid
       let currX = shiftX;
       let currY = 0;
       let dir = 1; // 1 = right, -1 = left
       sorted.forEach((n, i) => {
         n.x = currX;
         n.y = currY;
         n.level = i;
         
         if (i > 0) {
           const prev = sorted[i-1];
           computedEdges.push({
             from: prev,
             to: n,
             status: n.status === 'locked' ? 'locked' : n.status === 'mastered' ? 'mastered' : 'active'
           });
         }
         
         // Zig Zag Logic
         currX += (SIBLING_SPACING_X * dir);
         if (currX > shiftX + SIBLING_SPACING_X || currX < shiftX - SIBLING_SPACING_X) {
           currY += LEVEL_SPACING_Y;
           dir *= -1; // Flip horizontal direction
         }
       });
    }

    return { nodes: computedNodes, edges: computedEdges, maxLevel: maxLvl, width: computedWidth, height: computedHeight };
  }, [topics, masteredTopicIds]);

  return (
    <div 
      className="relative w-full overflow-x-auto overflow-y-hidden pb-12 flex justify-center custom-scrollbar" 
      style={{ minHeight: `${height + 100}px` }}
    >
      <div 
        className="relative" 
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {/* SVG Edges Layer */}
        <svg className="absolute inset-0 z-0 pointer-events-none" width={width} height={height}>
          {edges.map((edge, i) => {
            const startX = edge.from.x;
            const startY = edge.from.y + (NODE_HEIGHT / 2);
            const endX = edge.to.x;
            const endY = edge.to.y - (NODE_HEIGHT / 2);
            
            // Draw smooth bezier S-curve routing depending on horizontal shift
            const cp1x = startX;
            const cp1y = startY + ((endY - startY) / 2);
            const cp2x = endX;
            const cp2y = startY + ((endY - startY) / 2);
            const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

            const colorClass = 
              edge.status === 'mastered' ? "stroke-amber-400 dark:stroke-amber-500" :
              edge.status === 'active' ? "stroke-primary" : 
              "stroke-muted";

            return (
              <motion.path
                key={`edge-${i}`}
                d={d}
                fill="none"
                strokeWidth={3}
                className={cn("transition-colors duration-500 delay-150", colorClass)}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: edge.status === 'locked' ? 0.3 : 1 }}
                transition={{ duration: 1, delay: i * 0.1 }}
                style={{
                  filter: edge.status !== 'locked' ? `drop-shadow(0 0 8px var(--primary))` : 'none'
                }}
              />
            );
          })}
        </svg>

        {/* HTML Nodes Layer */}
        {nodes.map((node, i) => {
          return (
            <motion.div
              key={node.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 + (node.level * 0.1), type: "spring", stiffness: 200 }}
              className="absolute"
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                transform: `translate(-50%, 0)`, // Center horizontally on X coordinate
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
              }}
            >
              <div 
                onClick={() => {
                  if (node.status === 'locked') {
                    // Play error bump / dull click maybe
                    playClick("light");
                  } else {
                    playClick("deep");
                    onTopicClick(node.id);
                  }
                }}
                className={cn(
                  "h-full w-full rounded-lg border-2 p-3 flex items-center gap-3 transition-all cursor-pointer relative group",
                  node.status === "mastered" 
                    ? "bg-amber-500/10 border-amber-500 hover:bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                    : node.status === "available"
                    ? "bg-primary/10 border-primary hover:bg-primary/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                    : "bg-card/50 border-muted opacity-60 grayscale hover:grayscale-0 hover:bg-card hover:border-muted-foreground"
                )}
              >
                {/* Node Status Icon Bubble */}
                <div className={cn(
                  "h-10 w-10 shrink-0 rounded-full flex items-center justify-center border-2 bg-background z-10",
                  node.status === "mastered" ? "border-amber-500 text-amber-500" :
                  node.status === "available" ? "border-primary text-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" :
                  "border-muted text-muted-foreground"
                )}>
                  {node.status === "mastered" ? <Check className="h-5 w-5" /> :
                   node.status === "locked" ? <Lock className="h-4 w-4" /> :
                   <Sparkles className="h-5 w-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm leading-none line-clamp-2 text-foreground mb-1 group-hover:text-primary transition-colors">
                    {node.topic.name}
                  </h4>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {node.status}
                  </span>
                </div>
                
                {node.status !== 'locked' && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-2" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
