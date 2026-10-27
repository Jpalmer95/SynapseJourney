import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { Suspense, lazy, useEffect } from "react";
import NotFound from "@/pages/not-found";
import { LandingPage } from "@/pages/landing";
import { AuthPage } from "@/pages/auth-page";
import { ResetPasswordPage } from "@/pages/reset-password";

// Route-level code splitting: the entry bundle used to carry every page (3.4 MB raw /
// ~1 MB gzip), including three.js for the 3D map. Each page now loads on first visit.
const HomePage = lazy(() => import("@/pages/home").then((m) => ({ default: m.HomePage })));
const MapPage = lazy(() => import("@/pages/map").then((m) => ({ default: m.MapPage })));
const SavedPage = lazy(() => import("@/pages/saved").then((m) => ({ default: m.SavedPage })));
const ProfilePage = lazy(() => import("@/pages/profile").then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import("@/pages/settings"));
const PathwaysPage = lazy(() => import("@/pages/pathways"));
const PathwayDetailPage = lazy(() => import("@/pages/pathway-detail"));
const AchievementsPage = lazy(() => import("@/pages/achievements"));
const ExplorePage = lazy(() => import("@/pages/explore"));
const RabbitHolePage = lazy(() => import("@/pages/rabbit-hole").then((m) => ({ default: m.RabbitHolePage })));
const CollectionPage = lazy(() => import("@/pages/collection"));
const PracticeTestPage = lazy(() => import("@/pages/practice-test"));
const PracticeTestResultsPage = lazy(() => import("@/pages/practice-test-results"));
const OpenSciencePage = lazy(() => import("@/pages/open-science").then((m) => ({ default: m.OpenSciencePage })));
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TTSProvider } from "@/hooks/use-tts";
import { TTSMiniPlayer } from "@/components/tts-mini-player";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

function SessionCheckError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">We couldn't verify your session</h1>
        <p className="text-sm text-muted-foreground">
          The server took too long to answer. Your work is safe — this is a connection problem, not a
          logout.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Try again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}

// An authenticated visitor who lands on /signin or /signup belongs on the dashboard.
function RedirectHome() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/", { replace: true });
  }, [setLocation]);
  return null;
}

function AppContent() {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, isError, retry, isRetrying } = useAuth();

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

  // The session probe failed — say so instead of rendering a marketing page as if the
  // learner had been signed out.
  if (isError) {
    return <SessionCheckError onRetry={() => retry()} isRetrying={!!isRetrying} />;
  }

  // Password reset page renders for unauthenticated visitors too (they have no session).
  if (location.startsWith("/reset-password")) {
    return <ResetPasswordPage />;
  }

  if (!isAuthenticated) {
    const nextParam = new URLSearchParams(window.location.search).get("next");

    // Public marketing page — newcomers read before they are asked to sign in.
    if (location === "/") {
      return <LandingPage />;
    }

    // Explicit auth routes.
    if (location.startsWith("/signin") || location.startsWith("/signup")) {
      return (
        <AuthPage
          nextPath={nextParam}
          initialMode={location.startsWith("/signup") ? "register" : "login"}
        />
      );
    }

    // Any other protected deep link: sign in first, then continue where they were headed.
    return <AuthPage nextPath={location} />;
  }

  return (
    <>
      <Helmet>
        <title>SynapseJourney</title>
        <meta name="description" content="Discover interconnected knowledge pathways across infinite topics." />
      </Helmet>
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="min-h-screen"
        >
          <Suspense
            fallback={
              <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }
          >
          <Switch>
            <Route path="/signin" component={RedirectHome} />
            <Route path="/signup" component={RedirectHome} />
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
      <Route path="/open-science" component={OpenSciencePage} />
      <Route path="/practice-test/:id" component={PracticeTestPage} />
      <Route path="/practice-test/:testId/results/:attemptId" component={PracticeTestResultsPage} />
            <Route component={NotFound} />
          </Switch>
          </Suspense>
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
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
              <TTSMiniPlayer />
            </TTSProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;