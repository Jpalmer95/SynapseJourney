import { KnowledgeGraph3D } from "@/components/knowledge-graph-3d";
import { AppLayout } from "@/components/app-layout";

export function MapPage() {
  return (
    <AppLayout mobileTitle="Knowledge Map">
      <KnowledgeGraph3D />
    </AppLayout>
  );
}
