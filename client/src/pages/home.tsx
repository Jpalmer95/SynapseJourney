import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { NebulaFeed } from "@/components/nebula-feed";
import { RabbitHole } from "@/components/rabbit-hole";
import { AppLayout } from "@/components/app-layout";
import { MyCoursesStrip } from "@/components/my-courses-strip";
import { CourseCreator } from "@/components/course-creator";
import { useAuth } from "@/hooks/use-auth";
import type { Topic, Category } from "@shared/schema";

export function HomePage() {
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [resumeUnitId, setResumeUnitId] = useState<number | undefined>();

  const handleDive = (topic: Topic, category?: Category, unitId?: number) => {
    setSelectedTopic(topic);
    setSelectedCategory(category);
    setResumeUnitId(unitId);
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setSelectedCategory(undefined);
    setResumeUnitId(undefined);
  };

  return (
    <AppLayout>
      <AnimatePresence mode="wait">
        {selectedTopic ? (
          <RabbitHole
            key="rabbit-hole"
            topic={selectedTopic}
            category={selectedCategory}
            onBack={handleBack}
            resumeUnitId={resumeUnitId}
          />
        ) : (
          <div key="feed" className="flex flex-col h-full min-h-0">
            {user && (
              <div className="shrink-0 z-30 bg-background/90 backdrop-blur border-b border-border/40">
                {/* Single unified strip: goals, in-progress, and owned courses with
                    continue buttons (previously two stacked sections). */}
                <MyCoursesStrip onOpen={(topic, category) => handleDive(topic, category)} />
                {/* Collapsible tri-mode creator: Goal / Custom / Explore. */}
                <CourseCreator onStart={(topic, category) => handleDive(topic, category)} />
              </div>
            )}
            <div className="flex-1 min-h-0 relative">
              <NebulaFeed onDive={handleDive} />
            </div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
