import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { NebulaFeed } from "@/components/nebula-feed";
import { RabbitHole } from "@/components/rabbit-hole";
import { AppLayout } from "@/components/app-layout";
import { MyCoursesStrip } from "@/components/my-courses-strip";
import { CourseCreator } from "@/components/course-creator";
import { HomeSearch } from "@/components/home-search";
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
          <div key="feed" className="h-screen flex flex-col min-h-0 pt-16 md:pt-0">
            {/* Visible search box on the home feed (guest + signed-in). pt-16
                clears the fixed mobile header; md:pt-0 for the desktop rail. */}
            <div className="shrink-0 z-30 px-4 pt-3 pb-2 bg-background/90 backdrop-blur border-b border-border/40">
              <HomeSearch onDive={handleDive} />
            </div>
            {user && (
              <div className="shrink-0 z-30 bg-background/90 backdrop-blur border-b border-border/40 pr-16 md:pr-24">
                {/* pr-16/md:pr-24 clears the fixed profile menu (top-right) so the
                    "View all" link and header controls never overlap it. */}
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
