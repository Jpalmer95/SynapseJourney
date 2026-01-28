import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Image, Award, ChevronRight, Download, Sparkles, Box, Lock, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { BottomNav, SideNav } from "@/components/navigation";
import { useState } from "react";

interface Infographic {
  id: number;
  userId: string;
  topicId: number;
  topicTitle: string;
  imageUrl: string;
  thumbnailUrl?: string;
  prompt?: string;
  generatedAt: string;
}

interface Reward3D {
  id: number;
  userId: string;
  topicIds: number[];
  artDescription: string;
  modelUrl?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

interface RewardProgress {
  infographicsCollected: number;
  rewardsEarned: number;
  nextMilestone: number;
  progressToNext: number;
  percentToNext: number;
}

export default function CollectionPage() {
  const [selectedInfographic, setSelectedInfographic] = useState<Infographic | null>(null);

  const { data: infographics, isLoading: infographicsLoading } = useQuery<Infographic[]>({
    queryKey: ["/api/user/infographics"],
  });

  const { data: rewards, isLoading: rewardsLoading } = useQuery<Reward3D[]>({
    queryKey: ["/api/user/3d-rewards"],
  });

  const { data: progress, isLoading: progressLoading } = useQuery<RewardProgress>({
    queryKey: ["/api/user/3d-rewards/progress"],
  });

  const handleDownload = (infographic: Infographic) => {
    const link = document.createElement("a");
    link.href = infographic.imageUrl;
    link.download = `synapse-${infographic.topicTitle.toLowerCase().replace(/\s+/g, "-")}-recap.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <BottomNav />
      <SideNav />

      <main className="pb-20 md:pb-8 md:pl-20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500">
                <Image className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">My Collection</h1>
            </div>
            <p className="text-muted-foreground">
              Your earned recap infographics and 3D milestone rewards
            </p>
          </motion.div>

          {/* 3D Reward Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Card className="overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 pointer-events-none" />
              <CardHeader className="relative">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
                      <Box className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle>3D Milestone Rewards</CardTitle>
                      <CardDescription>
                        Collect 10 infographics to unlock a custom 3D model
                      </CardDescription>
                    </div>
                  </div>
                  {!progressLoading && progress && (
                    <Badge variant="secondary" className="text-sm" data-testid="badge-progress">
                      {progress.infographicsCollected} / {progress.nextMilestone} to next reward
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative">
                {progressLoading ? (
                  <Skeleton className="h-4 w-full" />
                ) : progress ? (
                  <div className="space-y-2">
                    <Progress value={progress.percentToNext} className="h-3" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{progress.progressToNext} of 10 infographics</span>
                      <span>{progress.rewardsEarned} rewards earned</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Complete topics to start collecting infographics!
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* 3D Rewards Gallery */}
          {!rewardsLoading && rewards && rewards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-8"
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                3D Model Rewards
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rewards.map((reward, index) => (
                  <motion.div
                    key={reward.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="overflow-hidden hover-elevate">
                      <div className="aspect-square bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex items-center justify-center relative">
                        {reward.status === "ready" && reward.modelUrl ? (
                          <div className="text-center p-4">
                            <Check className="h-12 w-12 text-green-500 mx-auto mb-2" />
                            <p className="text-sm font-medium">3D Model Ready!</p>
                            <Button size="sm" className="mt-2" data-testid={`btn-view-3d-${reward.id}`}>
                              View Model
                            </Button>
                          </div>
                        ) : reward.status === "generating" ? (
                          <div className="text-center p-4">
                            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Generating your 3D model...</p>
                          </div>
                        ) : (
                          <div className="text-center p-4">
                            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Pending generation</p>
                            <p className="text-xs text-muted-foreground mt-1">Coming soon!</p>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {reward.artDescription.substring(0, 100)}...
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Earned: {new Date(reward.createdAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Infographics Gallery */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Image className="h-5 w-5 text-blue-500" />
              Recap Cheat Sheets
              {infographics && (
                <Badge variant="secondary">{infographics.length}</Badge>
              )}
            </h2>

            {infographicsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="aspect-[3/4]" />
                    <CardContent className="p-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : infographics && infographics.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <AnimatePresence>
                  {infographics.map((infographic, index) => (
                    <motion.div
                      key={infographic.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.03 }}
                      layout
                    >
                      <Dialog>
                        <DialogTrigger asChild>
                          <Card 
                            className="overflow-hidden cursor-pointer hover-elevate group"
                            onClick={() => setSelectedInfographic(infographic)}
                            data-testid={`card-infographic-${infographic.id}`}
                          >
                            <div className="aspect-[3/4] relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-blue-900/30">
                              <img
                                src={infographic.imageUrl}
                                alt={`${infographic.topicTitle} Recap`}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                                <span className="text-white text-sm font-medium px-3 py-1 bg-black/40 rounded-full backdrop-blur-sm">
                                  View Full
                                </span>
                              </div>
                            </div>
                            <CardContent className="p-3">
                              <p className="font-medium text-sm line-clamp-1">{infographic.topicTitle}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(infographic.generatedAt).toLocaleDateString()}
                              </p>
                            </CardContent>
                          </Card>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto p-0">
                          <div className="relative">
                            <img
                              src={infographic.imageUrl}
                              alt={`${infographic.topicTitle} Recap`}
                              className="w-full"
                            />
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                              <h3 className="text-white text-lg font-semibold">{infographic.topicTitle}</h3>
                              <p className="text-white/70 text-sm">
                                Earned: {new Date(infographic.generatedAt).toLocaleDateString()}
                              </p>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="mt-2"
                                onClick={() => handleDownload(infographic)}
                                data-testid="btn-download-infographic"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Infographics Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Complete lessons in the Rabbit Hole to earn recap cheat sheets for each topic you master!
                  </p>
                  <Button className="mt-4" asChild>
                    <a href="/knowledge-map">
                      Start Learning
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
