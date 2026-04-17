import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { LandingPage } from "@/pages/landing";
import { HomePage } from "@/pages/home";
import { MapPage } from "@/pages/map";
import { SavedPage } from "@/pages/saved";
import { ProfilePage } from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import PathwaysPage from "@/pages/pathways";
import PathwayDetailPage from "@/pages/pathway-detail";
import AchievementsPage from "@/pages/achievements";
import ExplorePage from "@/pages/explore";
import RabbitHolePage from "@/pages/rabbit-hole";
import CollectionPage from "@/pages/collection";
import PracticeTestPage from "@/pages/practice-test";
import PracticeTestResultsPage from "@/pages/practice-test-results";
import { Loader2 } from "lucide-react";
import { TTSProvider } from "@/hooks/use-tts";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Synapse...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  const [location] = useLocation();

  return (
    <>
      <Helmet>
        <title>SynapseJourney</title>
        <meta name="description" content="Discover interconnected knowledge pathways across infinite topics." />
      </Helmet>
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.2 }}
          className="min-h-screen"
        >
          <Switch>
            <Route path="/" component={HomePage} />
      <Route path="/map" component={MapPage} />
      <Route path="/saved" component={SavedPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/pathways" component={PathwaysPage} />
      <Route path="/pathway/:id" component={PathwayDetailPage} />
      <Route path="/achievements" component={AchievementsPage} />
      <Route path="/explore" component={ExplorePage} />
      <Route path="/rabbit-hole" component={RabbitHolePage} />
      <Route path="/collection" component={CollectionPage} />
      <Route path="/practice-test/:id" component={PracticeTestPage} />
            <Route path="/practice-test/:testId/results/:attemptId" component={PracticeTestResultsPage} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <TTSProvider>
              <Toaster />
              <AppContent />
            </TTSProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
