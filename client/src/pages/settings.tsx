import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Brain, Calculator, Code, Beaker, Check, X, User, GraduationCap, Sparkles, Key, Server, Zap, RotateCcw, Loader2, Rss, Plus, Trash2, Star, Edit2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AppLayout } from "@/components/app-layout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface CategoryPreference {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  enabled: boolean;
}

interface UserProfile {
  userId?: string;
  ageRange?: string;
  technicalLevel?: string;
  priorExperience?: string[];
  allowTestOut?: boolean;
  huggingFaceToken?: string;
  ollamaUrl?: string;
  openRouterKey?: string;
  preferredAiProvider?: string;
  preferredModel?: string;
}

interface CustomFeed {
  id: number;
  userId: string;
  name: string;
  topicIds: number[];
  isDefault: boolean;
  createdAt: string;
}

interface Topic {
  id: number;
  title: string;
  description: string;
  categoryId: number | null;
  difficulty: string;
}

const iconMap: Record<string, typeof Brain> = {
  Brain: Brain,
  Calculator: Calculator,
  Code: Code,
  Beaker: Beaker,
};

const colorMap: Record<string, string> = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
};

const ageRanges = [
  { value: "under18", label: "Under 18" },
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55+", label: "55+" },
];

const technicalLevels = [
  { value: "beginner", label: "Beginner", description: "New to technical topics" },
  { value: "intermediate", label: "Intermediate", description: "Some technical background" },
  { value: "advanced", label: "Advanced", description: "Strong technical foundation" },
  { value: "expert", label: "Expert", description: "Deep expertise in technical fields" },
];

const experienceAreas = [
  "Software Development",
  "Data Science",
  "Physics",
  "Mathematics",
  "Engineering",
  "Biology",
  "Chemistry",
  "Music",
  "Art & Design",
  "Business",
  "Finance",
  "Healthcare",
  "Education",
  "Other Sciences",
];

export default function SettingsPage() {
  const { toast } = useToast();
  
  const { data: preferences, isLoading: prefsLoading } = useQuery<CategoryPreference[]>({
    queryKey: ["/api/user/preferences"],
  });

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

  const { data: customFeeds, isLoading: feedsLoading } = useQuery<CustomFeed[]>({
    queryKey: ["/api/custom-feeds"],
  });

  const { data: allTopics } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const [localProfile, setLocalProfile] = useState<UserProfile>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  const [showFeedDialog, setShowFeedDialog] = useState(false);
  const [editingFeed, setEditingFeed] = useState<CustomFeed | null>(null);
  const [feedName, setFeedName] = useState("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);

  useEffect(() => {
    if (profile) {
      setLocalProfile(profile);
      setHasChanges(false);
    }
  }, [profile]);

  const toggleMutation = useMutation({
    mutationFn: async ({ categoryId, enabled }: { categoryId: number; enabled: boolean }) => {
      return apiRequest("POST", "/api/user/preferences", { categoryId, enabled });
    },
    onMutate: async ({ categoryId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/user/preferences"] });
      const previous = queryClient.getQueryData<CategoryPreference[]>(["/api/user/preferences"]);
      
      queryClient.setQueryData<CategoryPreference[]>(["/api/user/preferences"], (old) =>
        old?.map((p) => (p.categoryId === categoryId ? { ...p, enabled } : p))
      );
      
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/user/preferences"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed/personalized"] });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      return apiRequest("POST", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      setHasChanges(false);
      toast({
        title: "Profile Updated",
        description: "Your learning profile has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateLocalProfile = (updates: Partial<UserProfile>) => {
    setLocalProfile(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const toggleExperience = (area: string) => {
    const current = localProfile.priorExperience || [];
    const updated = current.includes(area)
      ? current.filter(a => a !== area)
      : [...current, area];
    updateLocalProfile({ priorExperience: updated });
  };

  const saveProfile = () => {
    profileMutation.mutate(localProfile);
  };

  const enabledCount = preferences?.filter((p) => p.enabled).length || 0;

  const resetDefaultsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/reset-defaults");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed/personalized"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/pathways"] });
      toast({
        title: "Settings Reset",
        description: `All ${data.enabledCategories} categories have been enabled and you've been enrolled in ${data.enrolledPathways} pathways.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createFeedMutation = useMutation({
    mutationFn: async (data: { name: string; topicIds: number[]; isDefault?: boolean }) => {
      const res = await apiRequest("POST", "/api/custom-feeds", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-feeds"] });
      setShowFeedDialog(false);
      resetFeedForm();
      toast({
        title: "Feed Created",
        description: "Your custom feed has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create feed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateFeedMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; topicIds?: number[]; isDefault?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/custom-feeds/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-feeds"] });
      setShowFeedDialog(false);
      resetFeedForm();
      toast({
        title: "Feed Updated",
        description: "Your custom feed has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update feed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteFeedMutation = useMutation({
    mutationFn: async (feedId: number) => {
      const res = await apiRequest("DELETE", `/api/custom-feeds/${feedId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-feeds"] });
      toast({
        title: "Feed Deleted",
        description: "Your custom feed has been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete feed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setDefaultFeedMutation = useMutation({
    mutationFn: async (feedId: number | null) => {
      if (feedId === null) {
        const res = await apiRequest("POST", "/api/custom-feeds/clear-default");
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/custom-feeds/${feedId}/set-default`);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed/personalized"] });
      toast({
        title: "Default Feed Updated",
        description: "Your home feed has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update default feed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetFeedForm = () => {
    setEditingFeed(null);
    setFeedName("");
    setSelectedTopicIds([]);
  };

  const openCreateDialog = () => {
    resetFeedForm();
    setShowFeedDialog(true);
  };

  const openEditDialog = (feed: CustomFeed) => {
    setEditingFeed(feed);
    setFeedName(feed.name);
    setSelectedTopicIds(feed.topicIds);
    setShowFeedDialog(true);
  };

  const handleSaveFeed = () => {
    if (!feedName.trim() || selectedTopicIds.length === 0) return;
    
    if (editingFeed) {
      updateFeedMutation.mutate({
        id: editingFeed.id,
        name: feedName,
        topicIds: selectedTopicIds,
      });
    } else {
      createFeedMutation.mutate({
        name: feedName,
        topicIds: selectedTopicIds,
      });
    }
  };

  const toggleTopicSelection = (topicId: number) => {
    setSelectedTopicIds(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    );
  };

  return (
    <AppLayout mobileTitle="Settings">
      <div className="max-w-2xl mx-auto px-4 py-8 pt-16 md:pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-md bg-primary/10">
                <SettingsIcon className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
            </div>
            <p className="text-muted-foreground">
              Customize your learning experience and personalize lesson content.
            </p>
          </motion.div>

          {/* User Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle>Your Learning Profile</CardTitle>
                </div>
                <CardDescription>
                  Help us personalize lesson content to your background and experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {profileLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <>
                    {/* Age Range */}
                    <div className="space-y-2">
                      <Label htmlFor="age-range">Age Range</Label>
                      <Select
                        value={localProfile.ageRange || ""}
                        onValueChange={(value) => updateLocalProfile({ ageRange: value })}
                      >
                        <SelectTrigger id="age-range" data-testid="select-age-range">
                          <SelectValue placeholder="Select your age range" />
                        </SelectTrigger>
                        <SelectContent>
                          {ageRanges.map((range) => (
                            <SelectItem key={range.value} value={range.value}>
                              {range.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Technical Level */}
                    <div className="space-y-2">
                      <Label>Technical Level</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {technicalLevels.map((level) => (
                          <Button
                            key={level.value}
                            variant={localProfile.technicalLevel === level.value ? "default" : "outline"}
                            className="h-auto py-3 px-4 flex-col items-start text-left whitespace-normal break-words"
                            onClick={() => updateLocalProfile({ technicalLevel: level.value })}
                            data-testid={`btn-level-${level.value}`}
                          >
                            <span className="font-medium">{level.label}</span>
                            <span className="text-xs opacity-70 leading-tight">{level.description}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Prior Experience */}
                    <div className="space-y-2">
                      <Label>Prior Experience (select all that apply)</Label>
                      <div className="flex flex-wrap gap-2">
                        {experienceAreas.map((area) => (
                          <Badge
                            key={area}
                            variant={localProfile.priorExperience?.includes(area) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleExperience(area)}
                            data-testid={`badge-exp-${area.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {area}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {hasChanges && (
                      <Button 
                        onClick={saveProfile} 
                        disabled={profileMutation.isPending}
                        className="w-full"
                        data-testid="btn-save-profile"
                      >
                        {profileMutation.isPending ? "Saving..." : "Save Profile"}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Learning Preferences Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>Synaptodendrogenesis</CardTitle>
                </div>
                <CardDescription>
                  The essence of your journey in Synapse.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground italic">
                  "The simultaneous proliferation of neural branches (dendrites) and the formation of new connection points (synapses), resulting in a denser and more complex neural network."
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <CardTitle>Learning Preferences</CardTitle>
                </div>
                <CardDescription>
                  Customize how you progress through courses
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Test Out Option */}
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <p className="font-medium">Allow Test Out</p>
                    <p className="text-sm text-muted-foreground">
                      Skip basic/intermediate courses by passing all quizzes
                    </p>
                  </div>
                  <Switch
                    checked={localProfile.allowTestOut || false}
                    onCheckedChange={(checked) => {
                      updateLocalProfile({ allowTestOut: checked });
                      profileMutation.mutate({ ...localProfile, allowTestOut: checked });
                    }}
                    data-testid="switch-test-out"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Provider Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>AI Chat Provider</CardTitle>
                </div>
                <CardDescription>
                  Configure your AI provider for personal chat and Q&A sessions. You'll need to provide your own API credentials. Course content (lessons, roadmaps, practice tests) is always free and powered by Gemini 3 Pro.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Info Banner */}
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm">
                    <strong>Why do I need my own credentials?</strong> Chat uses your compute so you can have unlimited conversations without limits. Many providers offer free tiers!
                  </p>
                </div>

                {/* AI Provider Selection */}
                <div className="space-y-2">
                  <Label>Select Your Chat Provider</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={localProfile.preferredAiProvider === "huggingface" ? "default" : "outline"}
                      className="h-auto py-3 flex-col"
                      onClick={() => {
                        updateLocalProfile({ preferredAiProvider: "huggingface" });
                        profileMutation.mutate({ ...localProfile, preferredAiProvider: "huggingface" });
                      }}
                      data-testid="btn-provider-huggingface"
                    >
                      <Zap className="h-4 w-4 mb-1" />
                      <span className="font-medium">Hugging Face</span>
                      <span className="text-xs opacity-70">Free Tier</span>
                    </Button>
                    <Button
                      variant={localProfile.preferredAiProvider === "ollama" ? "default" : "outline"}
                      className="h-auto py-3 flex-col"
                      onClick={() => {
                        updateLocalProfile({ preferredAiProvider: "ollama" });
                        profileMutation.mutate({ ...localProfile, preferredAiProvider: "ollama" });
                      }}
                      data-testid="btn-provider-ollama"
                    >
                      <Server className="h-4 w-4 mb-1" />
                      <span className="font-medium">Ollama</span>
                      <span className="text-xs opacity-70">Local/Free</span>
                    </Button>
                    <Button
                      variant={localProfile.preferredAiProvider === "openrouter" ? "default" : "outline"}
                      className="h-auto py-3 flex-col"
                      onClick={() => {
                        updateLocalProfile({ preferredAiProvider: "openrouter" });
                        profileMutation.mutate({ ...localProfile, preferredAiProvider: "openrouter" });
                      }}
                      data-testid="btn-provider-openrouter"
                    >
                      <Zap className="h-4 w-4 mb-1" />
                      <span className="font-medium">OpenRouter</span>
                      <span className="text-xs opacity-70">Many Models</span>
                    </Button>
                  </div>
                </div>

                {/* Hugging Face Token */}
                {localProfile.preferredAiProvider === "huggingface" && (
                  <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
                    <Label htmlFor="hf-token" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Hugging Face Access Token
                    </Label>
                    <Input
                      id="hf-token"
                      type="password"
                      placeholder="hf_..."
                      value={localProfile.huggingFaceToken || ""}
                      onChange={(e) => updateLocalProfile({ huggingFaceToken: e.target.value })}
                      data-testid="input-hf-token"
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your free token at{" "}
                      <a 
                        href="https://huggingface.co/settings/tokens" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        huggingface.co/settings/tokens
                      </a>
                    </p>
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="hf-model">Model (optional)</Label>
                      <Input
                        id="hf-model"
                        placeholder="meta-llama/Llama-3.3-70B-Instruct"
                        value={localProfile.preferredModel || ""}
                        onChange={(e) => updateLocalProfile({ preferredModel: e.target.value })}
                        data-testid="input-hf-model"
                      />
                    </div>
                    {hasChanges && (
                      <Button 
                        onClick={saveProfile} 
                        disabled={profileMutation.isPending}
                        size="sm"
                        className="mt-2"
                        data-testid="btn-save-hf-token"
                      >
                        Save Settings
                      </Button>
                    )}
                  </div>
                )}

                {/* Ollama Configuration */}
                {localProfile.preferredAiProvider === "ollama" && (
                  <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
                    <Label htmlFor="ollama-url" className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Ollama Server URL
                    </Label>
                    <Input
                      id="ollama-url"
                      placeholder="http://localhost:11434"
                      value={localProfile.ollamaUrl || ""}
                      onChange={(e) => updateLocalProfile({ ollamaUrl: e.target.value })}
                      data-testid="input-ollama-url"
                    />
                    <p className="text-xs text-muted-foreground">
                      Run Ollama locally and enter your server URL
                    </p>
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="ollama-model">Model Name</Label>
                      <Input
                        id="ollama-model"
                        placeholder="llama3.2"
                        value={localProfile.preferredModel || ""}
                        onChange={(e) => updateLocalProfile({ preferredModel: e.target.value })}
                        data-testid="input-ollama-model"
                      />
                    </div>
                    {hasChanges && (
                      <Button 
                        onClick={saveProfile} 
                        disabled={profileMutation.isPending}
                        size="sm"
                        className="mt-2"
                        data-testid="btn-save-ollama"
                      >
                        Save Settings
                      </Button>
                    )}
                  </div>
                )}

                {/* OpenRouter Configuration */}
                {localProfile.preferredAiProvider === "openrouter" && (
                  <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
                    <Label htmlFor="openrouter-key" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      OpenRouter API Key
                    </Label>
                    <Input
                      id="openrouter-key"
                      type="password"
                      placeholder="sk-or-..."
                      value={localProfile.openRouterKey || ""}
                      onChange={(e) => updateLocalProfile({ openRouterKey: e.target.value })}
                      data-testid="input-openrouter-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key at{" "}
                      <a 
                        href="https://openrouter.ai/keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        openrouter.ai/keys
                      </a>
                    </p>
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="openrouter-model">Model (optional)</Label>
                      <Input
                        id="openrouter-model"
                        placeholder="anthropic/claude-3.5-sonnet"
                        value={localProfile.preferredModel || ""}
                        onChange={(e) => updateLocalProfile({ preferredModel: e.target.value })}
                        data-testid="input-openrouter-model"
                      />
                      <p className="text-xs text-muted-foreground">
                        Browse models at{" "}
                        <a 
                          href="https://openrouter.ai/models" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          openrouter.ai/models
                        </a>
                      </p>
                    </div>
                    {hasChanges && (
                      <Button 
                        onClick={saveProfile} 
                        disabled={profileMutation.isPending}
                        size="sm"
                        className="mt-2"
                        data-testid="btn-save-openrouter"
                      >
                        Save Settings
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Category Preferences Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Learning Categories</CardTitle>
                    <CardDescription>
                      Toggle categories on/off to customize your feed
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" data-testid="badge-enabled-count">
                    {enabledCount} enabled
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {prefsLoading ? (
                  <>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-md" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="h-6 w-10" />
                      </div>
                    ))}
                  </>
                ) : (
                  preferences?.map((pref, index) => {
                    const Icon = iconMap[pref.categoryIcon] || Brain;
                    const bgColor = colorMap[pref.categoryColor] || "bg-gray-500";

                    return (
                      <motion.div
                        key={pref.categoryId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          pref.enabled
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-muted/30"
                        }`}
                        data-testid={`category-preference-${pref.categoryId}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${bgColor}`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">{pref.categoryName}</p>
                            <p className="text-sm text-muted-foreground">
                              {pref.enabled ? (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <Check className="h-3 w-3" /> Showing in feed
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <X className="h-3 w-3" /> Hidden from feed
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={pref.enabled}
                          onCheckedChange={(enabled) => {
                            toggleMutation.mutate({ categoryId: pref.categoryId, enabled });
                          }}
                          disabled={toggleMutation.isPending}
                          data-testid={`switch-category-${pref.categoryId}`}
                        />
                      </motion.div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Custom Feeds Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Rss className="h-5 w-5 text-primary" />
                      <CardTitle>Custom Feeds</CardTitle>
                    </div>
                    <CardDescription>
                      Create topic-filtered feeds for focused learning sessions
                    </CardDescription>
                  </div>
                  <Dialog open={showFeedDialog} onOpenChange={(open) => {
                    setShowFeedDialog(open);
                    if (!open) resetFeedForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={openCreateDialog} data-testid="btn-create-feed">
                        <Plus className="h-4 w-4 mr-1" />
                        New Feed
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingFeed ? "Edit Feed" : "Create Custom Feed"}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="feed-name">Feed Name</Label>
                          <Input
                            id="feed-name"
                            placeholder="e.g., Physics & Math, Open Source Focus"
                            value={feedName}
                            onChange={(e) => setFeedName(e.target.value)}
                            data-testid="input-feed-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Select Topics ({selectedTopicIds.length} selected)</Label>
                          <div className="max-h-60 overflow-y-auto border rounded-md p-3 space-y-2">
                            {allTopics?.map((topic) => (
                              <div
                                key={topic.id}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  id={`topic-${topic.id}`}
                                  checked={selectedTopicIds.includes(topic.id)}
                                  onCheckedChange={() => toggleTopicSelection(topic.id)}
                                  data-testid={`checkbox-topic-${topic.id}`}
                                />
                                <label
                                  htmlFor={`topic-${topic.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {topic.title}
                                  <span className="text-xs text-muted-foreground ml-2 capitalize">
                                    ({topic.difficulty})
                                  </span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" data-testid="btn-cancel-feed">Cancel</Button>
                        </DialogClose>
                        <Button
                          onClick={handleSaveFeed}
                          disabled={!feedName.trim() || selectedTopicIds.length === 0 || createFeedMutation.isPending || updateFeedMutation.isPending}
                          data-testid="btn-save-feed"
                        >
                          {createFeedMutation.isPending || updateFeedMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          {editingFeed ? "Update Feed" : "Create Feed"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {feedsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : customFeeds && customFeeds.length > 0 ? (
                  <div className="space-y-3">
                    {/* All Topics option */}
                    <div
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        !customFeeds.some(f => f.isDefault)
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-muted">
                          <Rss className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">All Topics</p>
                          <p className="text-sm text-muted-foreground">Default feed with all enabled categories</p>
                        </div>
                      </div>
                      <Button
                        variant={!customFeeds.some(f => f.isDefault) ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDefaultFeedMutation.mutate(null)}
                        disabled={setDefaultFeedMutation.isPending}
                        data-testid="btn-set-default-all"
                      >
                        {!customFeeds.some(f => f.isDefault) ? (
                          <>
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Active
                          </>
                        ) : (
                          "Use"
                        )}
                      </Button>
                    </div>

                    {/* Custom feeds */}
                    {customFeeds.map((feed) => (
                      <div
                        key={feed.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          feed.isDefault
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-muted/30"
                        }`}
                        data-testid={`feed-item-${feed.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 rounded-md bg-muted shrink-0">
                            <Rss className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{feed.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {feed.topicIds.length} topic{feed.topicIds.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(feed)}
                            data-testid={`btn-edit-feed-${feed.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteFeedMutation.mutate(feed.id)}
                            disabled={deleteFeedMutation.isPending}
                            data-testid={`btn-delete-feed-${feed.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={feed.isDefault ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDefaultFeedMutation.mutate(feed.id)}
                            disabled={setDefaultFeedMutation.isPending}
                            data-testid={`btn-set-default-${feed.id}`}
                          >
                            {feed.isDefault ? (
                              <>
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                Active
                              </>
                            ) : (
                              "Use"
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Rss className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p>No custom feeds yet</p>
                    <p className="text-sm">Create a feed to focus on specific topics</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>About Your Feed</CardTitle>
                <CardDescription>
                  How category preferences work
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  When you disable a category, cards from that category won&apos;t appear in your personalized feed.
                </p>
                <p>
                  You can still access all topics through the Knowledge Map, even if their category is disabled.
                </p>
                <p>
                  As we expand to more subjects and industries, you&apos;ll have finer control over what appears in your learning journey.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <CardTitle>Reset to Defaults</CardTitle>
                </div>
                <CardDescription>
                  Having trouble seeing content? Reset your settings to enable all categories and enroll in all pathways.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => resetDefaultsMutation.mutate()}
                  disabled={resetDefaultsMutation.isPending}
                  variant="outline"
                  className="w-full border-amber-500/50 hover:bg-amber-500/10"
                  data-testid="btn-reset-defaults"
                >
                  {resetDefaultsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset All Settings to Default
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
      </div>
    </AppLayout>
  );
}
