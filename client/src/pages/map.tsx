import { KnowledgeGraph3D } from "@/components/knowledge-graph-3d";
import { BottomNav, SideNav } from "@/components/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export function MapPage() {
  return (
    <div className="min-h-screen bg-background">
      <SideNav />
      
      <div className="md:pl-16">
        <div className="hidden md:flex fixed top-4 right-4 z-40">
          <ThemeToggle />
        </div>
        
        <main>
          <KnowledgeGraph3D />
        </main>
        
        <BottomNav />
      </div>
    </div>
  );
}
