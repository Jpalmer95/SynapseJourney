import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { NebulaFeed } from "@/components/nebula-feed";
import { RabbitHole } from "@/components/rabbit-hole";
import { AppLayout } from "@/components/app-layout";
import type { Topic, Category } from "@shared/schema";

export function HomePage() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();

  const handleDive = (topic: Topic, category?: Category) => {
    setSelectedTopic(topic);
    setSelectedCategory(category);
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setSelectedCategory(undefined);
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
          />
        ) : (
          <NebulaFeed key="feed" onDive={handleDive} />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
