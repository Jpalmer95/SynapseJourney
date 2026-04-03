import {
  users, categories, topics, knowledgeCards, topicConnections,
  userProgress, savedCards, learningRoadmaps, aiChatSessions, aiChatMessages,
  userXp, userCategoryPreferences, lessonUnits, lessonProgress, topicMastery,
  userProfiles, pathways, pathwayTopics, userPathways, achievements, userAchievements,
  monthlyChallenges, userChallengeProgress, researchIdeas, userStreaks, customTopics,
  userInfographics, user3DRewards, customFeeds,
  practiceTests, practiceTestQuestions, practiceTestAttempts, testGapRecommendations, practiceQuestionBank,
  unlockKeys, keyUsageHistory, keyEarnHistory, keyPurchaseRequests,
  ideaContributions, novaCoins,
  ttsAudioCache,
  type Category, type InsertCategory,
  type Topic, type InsertTopic,
  type KnowledgeCard, type InsertKnowledgeCard,
  type TopicConnection, type InsertTopicConnection,
  type UserProgress, type InsertUserProgress,
  type SavedCard, type InsertSavedCard,
  type LearningRoadmap, type InsertLearningRoadmap,
  type AiChatSession, type InsertAiChatSession,
  type AiChatMessage, type InsertAiChatMessage,
  type UserXp, type InsertUserXp,
  type UserCategoryPreference, type InsertUserCategoryPreference,
  type LessonUnit, type InsertLessonUnit,
  type LessonProgress, type InsertLessonProgress,
  type TopicMastery, type InsertTopicMastery,
  type UserProfile, type InsertUserProfile,
  type Pathway, type InsertPathway,
  type PathwayTopic, type InsertPathwayTopic,
  type UserPathway, type InsertUserPathway,
  type Achievement, type InsertAchievement,
  type UserAchievement, type InsertUserAchievement,
  type MonthlyChallenge, type InsertMonthlyChallenge,
  type UserChallengeProgress, type InsertUserChallengeProgress,
  type ResearchIdea, type InsertResearchIdea,
  type UserStreak, type InsertUserStreak,
  type CustomTopic, type InsertCustomTopic,
  type UserInfographic, type InsertUserInfographic,
  type User3DReward, type InsertUser3DReward,
  type CustomFeed, type InsertCustomFeed,
  type PracticeTest, type InsertPracticeTest,
  type PracticeQuestionBank, type InsertPracticeQuestionBank,
  type PracticeTestQuestion, type InsertPracticeTestQuestion,
  type PracticeTestAttempt, type InsertPracticeTestAttempt,
  type TestGapRecommendation, type InsertTestGapRecommendation,
  type LessonContent,
  type NextGenContent,
  type UnlockKeys,
  type KeyUsageHistory,
  type KeyEarnHistory,
  type KeyPurchaseRequest,
  type InsertKeyPurchaseRequest,
  type IdeaContribution,
  type InsertIdeaContribution,
  type NovaCoin,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Topics
  getTopics(): Promise<Topic[]>;
  getTopicById(id: number): Promise<Topic | undefined>;
  getTopicsByCategory(categoryId: number): Promise<Topic[]>;
  createTopic(topic: InsertTopic): Promise<Topic>;

  // Knowledge Cards
  getAllCards(): Promise<KnowledgeCard[]>;
  getCardsByTopic(topicId: number): Promise<KnowledgeCard[]>;
  getCardById(id: number): Promise<KnowledgeCard | undefined>;
  createCard(card: InsertKnowledgeCard): Promise<KnowledgeCard>;
  getFeedCards(limit?: number): Promise<{ card: KnowledgeCard; topic: Topic; category?: Category }[]>;

  // Topic Connections
  getConnectionsFromTopic(topicId: number): Promise<TopicConnection[]>;
  getConnectionsToTopic(topicId: number): Promise<TopicConnection[]>;
  createConnection(connection: InsertTopicConnection): Promise<TopicConnection>;

  // User Progress
  getUserProgress(userId: string): Promise<UserProgress[]>;
  getProgressForTopic(userId: string, topicId: number): Promise<UserProgress | undefined>;
  upsertProgress(progress: InsertUserProgress): Promise<UserProgress>;
  getUserStats(userId: string): Promise<{ topicsExplored: number; topicsMastered: number; totalTimeSpent: number }>;

  // Saved Cards
  getSavedCards(userId: string): Promise<{ id: number; card: KnowledgeCard; topic: Topic; category?: Category; savedAt: Date }[]>;
  saveCard(userId: string, cardId: number): Promise<SavedCard>;
  unsaveCard(userId: string, cardId: number): Promise<void>;
  isCardSaved(userId: string, cardId: number): Promise<boolean>;

  // Learning Roadmaps
  getRoadmap(userId: string, topicId: number): Promise<LearningRoadmap | undefined>;
  createRoadmap(roadmap: InsertLearningRoadmap): Promise<LearningRoadmap>;

  // AI Chat
  getChatSessions(userId: string): Promise<AiChatSession[]>;
  getChatSession(sessionId: number): Promise<AiChatSession | undefined>;
  createChatSession(session: InsertAiChatSession): Promise<AiChatSession>;
  getChatMessages(sessionId: number): Promise<AiChatMessage[]>;
  createChatMessage(message: InsertAiChatMessage): Promise<AiChatMessage>;

  // Knowledge Graph
  getKnowledgeGraph(userId: string): Promise<{
    nodes: { id: number; title: string; category?: string; color: string; x: number; y: number; mastery: number; status: string }[];
    edges: { from: number; to: number; strength: number }[];
    stats: { total: number; mastered: number; learning: number };
  }>;

  // XP System
  getUserXp(userId: string): Promise<UserXp | undefined>;
  addXp(userId: string, amount: number): Promise<UserXp>;
  addTopicXp(userId: string, topicId: number, amount: number): Promise<UserProgress>;

  // Category Preferences
  getCategoryPreferences(userId: string): Promise<{ categoryId: number; enabled: boolean }[]>;
  setCategoryPreference(userId: string, categoryId: number, enabled: boolean): Promise<UserCategoryPreference>;
  deleteAllCategoryPreferences(userId: string): Promise<number>;
  getEnabledCategories(userId: string): Promise<number[]>;
  getFeedCardsFiltered(userId: string, limit?: number): Promise<{ card: KnowledgeCard; topic: Topic; category?: Category }[]>;

  // Lesson Units
  getLessonUnits(topicId: number, difficulty?: string): Promise<LessonUnit[]>;
  getLessonUnit(id: number): Promise<LessonUnit | undefined>;
  getLessonUnitByIndex(topicId: number, difficulty: string, unitIndex: number): Promise<LessonUnit | undefined>;
  createLessonUnit(unit: InsertLessonUnit): Promise<LessonUnit>;
  updateLessonContent(unitId: number, contentJson: LessonContent | NextGenContent): Promise<LessonUnit>;
  getAllLessonUnitsWithContent(): Promise<LessonUnit[]>;
  clearLessonUnitContent(unitId: number): Promise<void>;
  deleteLessonUnitsByTopicId(topicId: number): Promise<void>;

  // Lesson Progress
  getLessonProgress(userId: string, unitId: number): Promise<LessonProgress | undefined>;
  getUserLessonProgress(userId: string, topicId: number): Promise<{ unit: LessonUnit; progress: LessonProgress | null }[]>;
  startLesson(userId: string, unitId: number): Promise<LessonProgress>;
  completeLesson(userId: string, unitId: number, quizScore?: number): Promise<LessonProgress>;

  // Topic Mastery
  getTopicMastery(userId: string, topicId: number): Promise<TopicMastery | undefined>;
  getOrCreateTopicMastery(userId: string, topicId: number): Promise<TopicMastery>;
  updateTopicMastery(userId: string, topicId: number, updates: Partial<TopicMastery>): Promise<TopicMastery>;
  checkAndUnlockTiers(userId: string, topicId: number): Promise<TopicMastery>;
  getUserMasteredTopics(userId: string): Promise<{ topicId: number; topicTitle: string }[]>;

  // User Profiles
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createOrUpdateUserProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile>;

  // Pathways
  getPathways(): Promise<Pathway[]>;
  getPathwayById(id: number): Promise<Pathway | undefined>;
  createPathway(pathway: InsertPathway): Promise<Pathway>;
  getPathwayTopics(pathwayId: number): Promise<{ topic: Topic; order: number; isRequired: boolean }[]>;
  addTopicToPathway(pathwayId: number, topicId: number, order: number, isRequired: boolean): Promise<PathwayTopic>;
  getUserPathways(userId: string): Promise<{ pathway: Pathway; enrollment: UserPathway }[]>;
  getCustomPathways(userId: string): Promise<Pathway[]>;
  enrollInPathway(userId: string, pathwayId: number): Promise<UserPathway>;
  updatePathwayProgress(userId: string, pathwayId: number, progress: number): Promise<UserPathway>;

  // Achievements
  getAchievements(): Promise<Achievement[]>;
  getAchievementById(id: number): Promise<Achievement | undefined>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  getUserAchievements(userId: string): Promise<{ achievement: Achievement; earnedAt: Date }[]>;
  awardAchievement(userId: string, achievementId: number): Promise<UserAchievement>;
  hasAchievement(userId: string, achievementId: number): Promise<boolean>;
  checkAndAwardAchievements(userId: string): Promise<Achievement[]>;

  // Monthly Challenges
  getActiveChallenges(): Promise<MonthlyChallenge[]>;
  getChallengeById(id: number): Promise<MonthlyChallenge | undefined>;
  createChallenge(challenge: InsertMonthlyChallenge): Promise<MonthlyChallenge>;
  joinChallenge(userId: string, challengeId: number): Promise<UserChallengeProgress>;
  updateChallengeProgress(userId: string, challengeId: number, lessonsCompleted: number, xpEarned: number): Promise<UserChallengeProgress>;
  getChallengeLeaderboard(challengeId: number): Promise<{ userId: string; lessonsCompleted: number; xpEarned: number; rank: number }[]>;

  // Research Ideas
  createResearchIdea(idea: InsertResearchIdea): Promise<ResearchIdea>;
  getUserResearchIdeas(userId: string): Promise<ResearchIdea[]>;
  getValidatedResearchIdeas(userId: string): Promise<ResearchIdea[]>;
  voteResearchIdea(ideaId: number): Promise<ResearchIdea>;

  // User Streaks
  getUserStreak(userId: string): Promise<UserStreak | undefined>;
  updateStreak(userId: string): Promise<UserStreak>;

  // Custom Topics
  createCustomTopic(topic: InsertCustomTopic): Promise<CustomTopic>;
  getUserCustomTopics(userId: string): Promise<CustomTopic[]>;
  getCustomTopicById(id: number): Promise<CustomTopic | undefined>;
  updateCustomTopicStatus(id: number, status: string, generatedTopicId?: number, generatedCategoryId?: number): Promise<CustomTopic>;

  // User Infographics
  createUserInfographic(infographic: InsertUserInfographic): Promise<UserInfographic>;
  getUserInfographics(userId: string): Promise<UserInfographic[]>;
  getUserInfographicByTopic(userId: string, topicId: number): Promise<UserInfographic | undefined>;
  countUserInfographics(userId: string): Promise<number>;

  // 3D Rewards
  createUser3DReward(reward: InsertUser3DReward): Promise<User3DReward>;
  getUser3DRewards(userId: string): Promise<User3DReward[]>;
  updateUser3DRewardStatus(id: number, status: string, modelUrl?: string): Promise<User3DReward>;
  getPending3DRewards(): Promise<User3DReward[]>;

  // XP by difficulty
  getXpForDifficulty(difficulty: string): number;

  // Custom Feeds
  getCustomFeeds(userId: string): Promise<CustomFeed[]>;
  getCustomFeedById(id: number): Promise<CustomFeed | undefined>;
  createCustomFeed(feed: InsertCustomFeed): Promise<CustomFeed>;
  updateCustomFeed(id: number, updates: Partial<InsertCustomFeed>): Promise<CustomFeed>;
  deleteCustomFeed(id: number): Promise<void>;
  setDefaultFeed(userId: string, feedId: number | null): Promise<void>;
  getDefaultFeed(userId: string): Promise<CustomFeed | undefined>;
  getFeedCardsByTopics(topicIds: number[], limit?: number): Promise<{ card: KnowledgeCard; topic: Topic; category?: Category }[]>;

  // Practice Tests
  createPracticeTest(test: InsertPracticeTest): Promise<PracticeTest>;
  getPracticeTest(id: number): Promise<PracticeTest | undefined>;
  getUserPracticeTests(userId: string): Promise<PracticeTest[]>;
  updatePracticeTestStatus(id: number, status: string, totalQuestions?: number): Promise<PracticeTest>;
  
  // Practice Test Questions
  createPracticeTestQuestion(question: InsertPracticeTestQuestion): Promise<PracticeTestQuestion>;
  createPracticeTestQuestions(questions: InsertPracticeTestQuestion[]): Promise<PracticeTestQuestion[]>;
  getPracticeTestQuestions(testId: number): Promise<PracticeTestQuestion[]>;
  getPracticeTestQuestion(id: number): Promise<PracticeTestQuestion | undefined>;
  
  // Practice Test Attempts
  createPracticeTestAttempt(attempt: InsertPracticeTestAttempt): Promise<PracticeTestAttempt>;
  getPracticeTestAttempt(id: number): Promise<PracticeTestAttempt | undefined>;
  getUserPracticeTestAttempts(userId: string): Promise<{ attempt: PracticeTestAttempt; test: PracticeTest }[]>;
  getActiveAttempt(userId: string, testId: number): Promise<PracticeTestAttempt | undefined>;
  updateAttemptAnswers(attemptId: number, answers: Record<string, number>, flaggedQuestions?: number[]): Promise<PracticeTestAttempt>;
  updateAttemptTime(attemptId: number, timeSpent: number): Promise<PracticeTestAttempt>;
  completeAttempt(attemptId: number, score: number, categoryScores: Record<string, { correct: number; total: number }>): Promise<PracticeTestAttempt>;
  
  // Test Gap Recommendations
  createTestGapRecommendations(recommendations: InsertTestGapRecommendation[]): Promise<TestGapRecommendation[]>;
  getTestGapRecommendations(attemptId: number): Promise<TestGapRecommendation[]>;
  
  // Question Bank
  getQuestionBankQuestions(testType: string, categories: string[], limit?: number): Promise<PracticeQuestionBank[]>;
  getQuestionBankCount(testType: string): Promise<number>;
  addQuestionToBank(question: InsertPracticeQuestionBank): Promise<PracticeQuestionBank>;
  addQuestionsToBank(questions: InsertPracticeQuestionBank[]): Promise<PracticeQuestionBank[]>;

  // Unlock Keys
  getUserKeys(userId: string): Promise<UnlockKeys>;
  useKeyOnTopic(userId: string, topicId: number): Promise<{ success: boolean; error?: string }>;
  getKeyEarnProgress(userId: string): Promise<{ topicsCompletedToday: number; topicsNeeded: number; alreadyEarnedToday: boolean; qualifyingTopics: number[] }>;
  checkAndAwardDailyKey(userId: string): Promise<{ awarded: boolean; newTotal: number }>;

  // Key Purchases (Dogecoin)
  createKeyPurchaseRequest(userId: string, quantity: number): Promise<KeyPurchaseRequest>;
  getPendingPurchaseRequests(): Promise<(KeyPurchaseRequest & { username?: string })[]>;
  getUserPurchaseRequests(userId: string): Promise<KeyPurchaseRequest[]>;
  resolveKeyPurchaseRequest(requestId: number, approved: boolean, adminNote?: string): Promise<KeyPurchaseRequest>;

  // Idea Contributions (Pioneer system)
  createIdeaContribution(userId: string, topicId: number, unitId: number | null, title: string, description: string): Promise<IdeaContribution>;
  getIdeaContributionsByTopic(topicId: number): Promise<(IdeaContribution & { username?: string })[]>;
  getUserIdeaContributions(userId: string): Promise<IdeaContribution[]>;

  // Nova Coins
  getUserNovaCoins(userId: string): Promise<NovaCoin>;
  awardNovaCoin(userId: string): Promise<NovaCoin>;

  // TTS Settings
  getTtsSettings(userId: string): Promise<{ voicePreset: string; referenceAudio: string | null; playbackSpeed: number }>;
  saveTtsSettings(userId: string, voicePreset: string, referenceAudio?: string | null, playbackSpeed?: number): Promise<void>;
  getTtsAudioCache(unitId: number, voiceConfigHash: string): Promise<{ audioData: string; audioFormat: string } | null>;
  saveTtsAudioCache(unitId: number, voiceConfigHash: string, audioData: string, audioFormat: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Categories
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  // Topics
  async getTopics(): Promise<Topic[]> {
    return db.select().from(topics);
  }

  async getTopicById(id: number): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic;
  }

  async getTopicsByCategory(categoryId: number): Promise<Topic[]> {
    return db.select().from(topics).where(eq(topics.categoryId, categoryId));
  }

  async createTopic(topic: InsertTopic): Promise<Topic> {
    const [created] = await db.insert(topics).values(topic).returning();
    return created;
  }

  // Knowledge Cards
  async getAllCards(): Promise<KnowledgeCard[]> {
    return db.select().from(knowledgeCards);
  }

  async getCardsByTopic(topicId: number): Promise<KnowledgeCard[]> {
    return db.select().from(knowledgeCards).where(eq(knowledgeCards.topicId, topicId)).orderBy(knowledgeCards.order);
  }

  async getCardById(id: number): Promise<KnowledgeCard | undefined> {
    const [card] = await db.select().from(knowledgeCards).where(eq(knowledgeCards.id, id));
    return card;
  }

  async createCard(card: InsertKnowledgeCard): Promise<KnowledgeCard> {
    const [created] = await db.insert(knowledgeCards).values(card).returning();
    return created;
  }

  async getFeedCards(limit = 20): Promise<{ card: KnowledgeCard; topic: Topic; category?: Category }[]> {
    const cards = await db
      .select({
        card: knowledgeCards,
        topic: topics,
        category: categories,
      })
      .from(knowledgeCards)
      .innerJoin(topics, eq(knowledgeCards.topicId, topics.id))
      .leftJoin(categories, eq(topics.categoryId, categories.id))
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    return cards.map((row) => ({
      card: row.card,
      topic: row.topic,
      category: row.category || undefined,
    }));
  }

  // Topic Connections
  async getConnectionsFromTopic(topicId: number): Promise<TopicConnection[]> {
    return db.select().from(topicConnections).where(eq(topicConnections.fromTopicId, topicId));
  }

  async getConnectionsToTopic(topicId: number): Promise<TopicConnection[]> {
    return db.select().from(topicConnections).where(eq(topicConnections.toTopicId, topicId));
  }

  async createConnection(connection: InsertTopicConnection): Promise<TopicConnection> {
    const [created] = await db.insert(topicConnections).values(connection).returning();
    return created;
  }

  // User Progress
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return db.select().from(userProgress).where(eq(userProgress.userId, userId));
  }

  async getProgressForTopic(userId: string, topicId: number): Promise<UserProgress | undefined> {
    const [progress] = await db.select().from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.topicId, topicId)));
    return progress;
  }

  async upsertProgress(progress: InsertUserProgress): Promise<UserProgress> {
    const existing = await this.getProgressForTopic(progress.userId, progress.topicId);
    if (existing) {
      const [updated] = await db.update(userProgress)
        .set({
          ...progress,
          lastAccessedAt: new Date(),
        })
        .where(eq(userProgress.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userProgress).values(progress).returning();
    return created;
  }

  async getUserStats(userId: string): Promise<{ topicsExplored: number; topicsMastered: number; totalTimeSpent: number }> {
    const progress = await this.getUserProgress(userId);
    const topicsExplored = progress.length;
    const topicsMastered = progress.filter((p) => p.status === "mastered").length;
    const totalTimeSpent = progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
    return { topicsExplored, topicsMastered, totalTimeSpent };
  }

  // Saved Cards
  async getSavedCards(userId: string): Promise<{ id: number; card: KnowledgeCard; topic: Topic; category?: Category; savedAt: Date }[]> {
    const saved = await db
      .select({
        saved: savedCards,
        card: knowledgeCards,
        topic: topics,
        category: categories,
      })
      .from(savedCards)
      .innerJoin(knowledgeCards, eq(savedCards.cardId, knowledgeCards.id))
      .innerJoin(topics, eq(knowledgeCards.topicId, topics.id))
      .leftJoin(categories, eq(topics.categoryId, categories.id))
      .where(eq(savedCards.userId, userId))
      .orderBy(desc(savedCards.savedAt));

    return saved.map((row) => ({
      id: row.saved.id,
      card: row.card,
      topic: row.topic,
      category: row.category || undefined,
      savedAt: row.saved.savedAt,
    }));
  }

  async saveCard(userId: string, cardId: number): Promise<SavedCard> {
    const [created] = await db.insert(savedCards).values({ userId, cardId }).returning();
    return created;
  }

  async unsaveCard(userId: string, cardId: number): Promise<void> {
    await db.delete(savedCards).where(and(eq(savedCards.userId, userId), eq(savedCards.cardId, cardId)));
  }

  async isCardSaved(userId: string, cardId: number): Promise<boolean> {
    const [saved] = await db.select().from(savedCards)
      .where(and(eq(savedCards.userId, userId), eq(savedCards.cardId, cardId)));
    return !!saved;
  }

  // Learning Roadmaps
  async getRoadmap(userId: string, topicId: number): Promise<LearningRoadmap | undefined> {
    const [roadmap] = await db.select().from(learningRoadmaps)
      .where(and(eq(learningRoadmaps.userId, userId), eq(learningRoadmaps.topicId, topicId)));
    return roadmap;
  }

  async createRoadmap(roadmap: InsertLearningRoadmap): Promise<LearningRoadmap> {
    const [created] = await db.insert(learningRoadmaps).values(roadmap).returning();
    return created;
  }

  // AI Chat
  async getChatSessions(userId: string): Promise<AiChatSession[]> {
    return db.select().from(aiChatSessions)
      .where(eq(aiChatSessions.userId, userId))
      .orderBy(desc(aiChatSessions.createdAt));
  }

  async getChatSession(sessionId: number): Promise<AiChatSession | undefined> {
    const [session] = await db.select().from(aiChatSessions).where(eq(aiChatSessions.id, sessionId));
    return session;
  }

  async createChatSession(session: InsertAiChatSession): Promise<AiChatSession> {
    const [created] = await db.insert(aiChatSessions).values(session).returning();
    return created;
  }

  async getChatMessages(sessionId: number): Promise<AiChatMessage[]> {
    return db.select().from(aiChatMessages)
      .where(eq(aiChatMessages.sessionId, sessionId))
      .orderBy(aiChatMessages.createdAt);
  }

  async createChatMessage(message: InsertAiChatMessage): Promise<AiChatMessage> {
    const [created] = await db.insert(aiChatMessages).values(message).returning();
    return created;
  }

  // Knowledge Graph
  async getKnowledgeGraph(userId: string): Promise<{
    nodes: { id: number; title: string; category?: string; color: string; x: number; y: number; mastery: number; status: string }[];
    edges: { from: number; to: number; strength: number }[];
    stats: { total: number; mastered: number; learning: number };
  }> {
    const allTopics = await this.getTopics();
    const progress = await this.getUserProgress(userId);
    const connections = await db.select().from(topicConnections);
    const allCategories = await this.getCategories();

    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const progressMap = new Map(progress.map((p) => [p.topicId, p]));

    const categoryColors: Record<string, string> = {
      purple: "#8b5cf6",
      blue: "#3b82f6",
      green: "#22c55e",
      orange: "#f59e0b",
      pink: "#ec4899",
      red: "#ef4444",
    };

    const nodes = allTopics.map((topic, index) => {
      const angle = (index / allTopics.length) * 2 * Math.PI;
      const radius = 150 + Math.random() * 100;
      const category = topic.categoryId ? categoryMap.get(topic.categoryId) : undefined;
      const userProgressItem = progressMap.get(topic.id);

      return {
        id: topic.id,
        title: topic.title,
        category: category?.name,
        color: category ? categoryColors[category.color] || "#6b7280" : "#6b7280",
        x: 400 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
        mastery: userProgressItem?.mastery || 0,
        status: userProgressItem?.status || "unexplored",
      };
    });

    const edges = connections.map((conn) => ({
      from: conn.fromTopicId,
      to: conn.toTopicId,
      strength: conn.strength || 1,
    }));

    const stats = {
      total: allTopics.length,
      mastered: progress.filter((p) => p.status === "mastered").length,
      learning: progress.filter((p) => p.status === "learning").length,
    };

    return { nodes, edges, stats };
  }

  // XP System
  async getUserXp(userId: string): Promise<UserXp | undefined> {
    const [xp] = await db.select().from(userXp).where(eq(userXp.userId, userId));
    return xp;
  }

  async addXp(userId: string, amount: number): Promise<UserXp> {
    const existing = await this.getUserXp(userId);
    
    // Calculate level based on XP (100 XP per level, exponential growth)
    const calculateLevel = (totalXp: number): number => {
      return Math.floor(Math.sqrt(totalXp / 100)) + 1;
    };

    if (existing) {
      const newTotalXp = (existing.totalXp || 0) + amount;
      const newLevel = calculateLevel(newTotalXp);
      
      const [updated] = await db.update(userXp)
        .set({
          totalXp: newTotalXp,
          level: newLevel,
          updatedAt: new Date(),
        })
        .where(eq(userXp.id, existing.id))
        .returning();
      return updated;
    }

    const newLevel = calculateLevel(amount);
    const [created] = await db.insert(userXp).values({
      userId,
      totalXp: amount,
      level: newLevel,
    }).returning();
    return created;
  }

  async addTopicXp(userId: string, topicId: number, amount: number): Promise<UserProgress> {
    const existing = await this.getProgressForTopic(userId, topicId);
    
    // Calculate level for topic (10 XP per level for topics)
    const calculateTopicLevel = (xp: number): number => {
      return Math.floor(xp / 10);
    };

    // Also add to total XP
    await this.addXp(userId, amount);

    if (existing) {
      const newXp = (existing.xp || 0) + amount;
      const newLevel = calculateTopicLevel(newXp);
      
      const [updated] = await db.update(userProgress)
        .set({
          xp: newXp,
          currentLevel: newLevel,
          lastAccessedAt: new Date(),
        })
        .where(eq(userProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(userProgress).values({
      userId,
      topicId,
      xp: amount,
      currentLevel: calculateTopicLevel(amount),
      status: "learning",
    }).returning();
    return created;
  }

  // Category Preferences
  async getCategoryPreferences(userId: string): Promise<{ categoryId: number; enabled: boolean }[]> {
    const prefs = await db.select().from(userCategoryPreferences)
      .where(eq(userCategoryPreferences.userId, userId));
    return prefs.map((p) => ({ categoryId: p.categoryId, enabled: p.enabled }));
  }

  async setCategoryPreference(userId: string, categoryId: number, enabled: boolean): Promise<UserCategoryPreference> {
    const existing = await db.select().from(userCategoryPreferences)
      .where(and(
        eq(userCategoryPreferences.userId, userId),
        eq(userCategoryPreferences.categoryId, categoryId)
      ));

    if (existing.length > 0) {
      const [updated] = await db.update(userCategoryPreferences)
        .set({ enabled })
        .where(eq(userCategoryPreferences.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(userCategoryPreferences)
      .values({ userId, categoryId, enabled })
      .returning();
    return created;
  }

  async deleteAllCategoryPreferences(userId: string): Promise<number> {
    const result = await db.delete(userCategoryPreferences)
      .where(eq(userCategoryPreferences.userId, userId));
    return result.rowCount || 0;
  }

  async getEnabledCategories(userId: string): Promise<number[]> {
    const prefs = await this.getCategoryPreferences(userId);
    const allCategories = await this.getCategories();
    
    console.log(`[Storage] getEnabledCategories for user ${userId}: ${prefs.length} prefs, ${allCategories.length} total categories`);
    
    // If no preferences set, all categories are enabled by default
    if (prefs.length === 0) {
      console.log(`[Storage] No preferences found for user ${userId}, returning all ${allCategories.length} categories`);
      return allCategories.map((c) => c.id);
    }
    
    const prefsMap = new Map(prefs.map((p) => [p.categoryId, p.enabled]));
    
    // Categories without explicit preference are enabled by default
    const enabledIds = allCategories
      .filter((c) => prefsMap.get(c.id) !== false)
      .map((c) => c.id);
    
    console.log(`[Storage] User ${userId} has ${enabledIds.length} enabled categories: ${enabledIds.join(', ')}`);
    return enabledIds;
  }

  async getFeedCardsFiltered(userId: string, limit = 20): Promise<{ card: KnowledgeCard; topic: Topic; category?: Category }[]> {
    let enabledCategories = await this.getEnabledCategories(userId);
    
    // Fallback: If somehow all categories are disabled, enable all to prevent empty feed
    if (enabledCategories.length === 0) {
      console.log(`[Storage] WARN: No enabled categories for user ${userId}, falling back to all categories`);
      const allCategories = await this.getCategories();
      enabledCategories = allCategories.map((c) => c.id);
    }
    
    // If still no categories exist, return empty
    if (enabledCategories.length === 0) {
      console.log(`[Storage] ERROR: No categories exist in database!`);
      return [];
    }

    const cards = await db
      .select({
        card: knowledgeCards,
        topic: topics,
        category: categories,
      })
      .from(knowledgeCards)
      .innerJoin(topics, eq(knowledgeCards.topicId, topics.id))
      .leftJoin(categories, eq(topics.categoryId, categories.id))
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    console.log(`[Storage] Retrieved ${cards.length} cards from database for user ${userId}`);

    // Filter by enabled categories
    const filteredCards = cards
      .filter((row) => !row.topic.categoryId || enabledCategories.includes(row.topic.categoryId))
      .map((row) => ({
        card: row.card,
        topic: row.topic,
        category: row.category || undefined,
      }));
    
    console.log(`[Storage] Filtered to ${filteredCards.length} cards for user ${userId}`);
    return filteredCards;
  }

  // Lesson Units
  async getLessonUnits(topicId: number, difficulty?: string): Promise<LessonUnit[]> {
    if (difficulty) {
      return db.select().from(lessonUnits)
        .where(and(eq(lessonUnits.topicId, topicId), eq(lessonUnits.difficulty, difficulty)))
        .orderBy(lessonUnits.unitIndex);
    }
    return db.select().from(lessonUnits)
      .where(eq(lessonUnits.topicId, topicId))
      .orderBy(lessonUnits.difficulty, lessonUnits.unitIndex);
  }

  async getLessonUnit(id: number): Promise<LessonUnit | undefined> {
    const [unit] = await db.select().from(lessonUnits).where(eq(lessonUnits.id, id));
    return unit;
  }

  async getLessonUnitByIndex(topicId: number, difficulty: string, unitIndex: number): Promise<LessonUnit | undefined> {
    const [unit] = await db.select().from(lessonUnits)
      .where(and(
        eq(lessonUnits.topicId, topicId),
        eq(lessonUnits.difficulty, difficulty),
        eq(lessonUnits.unitIndex, unitIndex)
      ));
    return unit;
  }

  async createLessonUnit(unit: InsertLessonUnit): Promise<LessonUnit> {
    const [created] = await db.insert(lessonUnits).values(unit).returning();
    return created;
  }

  async updateLessonContent(unitId: number, contentJson: LessonContent | NextGenContent): Promise<LessonUnit> {
    const [updated] = await db.update(lessonUnits)
      .set({ contentJson })
      .where(eq(lessonUnits.id, unitId))
      .returning();
    return updated;
  }

  async getAllLessonUnitsWithContent(): Promise<LessonUnit[]> {
    return db.select().from(lessonUnits).where(isNotNull(lessonUnits.contentJson));
  }

  async clearLessonUnitContent(unitId: number): Promise<void> {
    await db.update(lessonUnits)
      .set({ contentJson: null })
      .where(eq(lessonUnits.id, unitId));
  }

  async deleteLessonUnitsByTopicId(topicId: number): Promise<void> {
    // Fetch all unit IDs for this topic so we can delete dependent rows first
    const units = await db.select({ id: lessonUnits.id }).from(lessonUnits).where(eq(lessonUnits.topicId, topicId));
    if (units.length === 0) return;
    const unitIds = units.map((u) => u.id);

    // Delete all dependent rows that reference lesson_units.id (FK without cascade)
    await db.delete(lessonProgress).where(inArray(lessonProgress.unitId, unitIds));
    await db.delete(ttsAudioCache).where(inArray(ttsAudioCache.unitId, unitIds));
    await db.delete(ideaContributions).where(inArray(ideaContributions.unitId, unitIds));

    // Now safe to delete the units themselves
    await db.delete(lessonUnits).where(eq(lessonUnits.topicId, topicId));
  }

  // Lesson Progress
  async getLessonProgress(userId: string, unitId: number): Promise<LessonProgress | undefined> {
    const [progress] = await db.select().from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.unitId, unitId)));
    return progress;
  }

  async getUserLessonProgress(userId: string, topicId: number): Promise<{ unit: LessonUnit; progress: LessonProgress | null }[]> {
    const units = await this.getLessonUnits(topicId);
    const results = await Promise.all(units.map(async (unit) => {
      const progress = await this.getLessonProgress(userId, unit.id);
      return { unit, progress: progress || null };
    }));
    return results;
  }

  async startLesson(userId: string, unitId: number): Promise<LessonProgress> {
    const existing = await this.getLessonProgress(userId, unitId);
    if (existing) {
      const [updated] = await db.update(lessonProgress)
        .set({ status: "in_progress", lastAccessedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(lessonProgress.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(lessonProgress)
      .values({ userId, unitId, status: "in_progress" })
      .returning();
    return created;
  }

  async completeLesson(userId: string, unitId: number, quizScore?: number): Promise<LessonProgress> {
    const existing = await this.getLessonProgress(userId, unitId);
    if (existing) {
      const [updated] = await db.update(lessonProgress)
        .set({ 
          status: "completed", 
          quizScore: quizScore ?? existing.quizScore,
          completedAt: sql`CURRENT_TIMESTAMP`,
          lastAccessedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(lessonProgress.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(lessonProgress)
      .values({ userId, unitId, status: "completed", quizScore })
      .returning();
    return created;
  }

  // Topic Mastery
  async getTopicMastery(userId: string, topicId: number): Promise<TopicMastery | undefined> {
    const [mastery] = await db.select().from(topicMastery)
      .where(and(eq(topicMastery.userId, userId), eq(topicMastery.topicId, topicId)));
    return mastery;
  }

  async getOrCreateTopicMastery(userId: string, topicId: number): Promise<TopicMastery> {
    const existing = await this.getTopicMastery(userId, topicId);
    if (existing) return existing;
    
    const [created] = await db.insert(topicMastery)
      .values({ userId, topicId })
      .returning();
    return created;
  }

  async updateTopicMastery(userId: string, topicId: number, updates: Partial<TopicMastery>): Promise<TopicMastery> {
    const mastery = await this.getOrCreateTopicMastery(userId, topicId);
    const [updated] = await db.update(topicMastery)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(topicMastery.id, mastery.id))
      .returning();
    return updated;
  }

  async checkAndUnlockTiers(userId: string, topicId: number): Promise<TopicMastery> {
    const mastery = await this.getOrCreateTopicMastery(userId, topicId);
    const units = await this.getLessonUnits(topicId);
    
    const beginnerUnits = units.filter(u => u.difficulty === "beginner");
    const intermediateUnits = units.filter(u => u.difficulty === "intermediate");
    const advancedUnits = units.filter(u => u.difficulty === "advanced");
    
    let beginnerCompleted = 0;
    let intermediateCompleted = 0;
    let advancedCompleted = 0;
    let nextgenCompleted = 0;
    
    for (const unit of units) {
      const progress = await this.getLessonProgress(userId, unit.id);
      if (progress?.status === "completed") {
        if (unit.difficulty === "beginner") beginnerCompleted++;
        else if (unit.difficulty === "intermediate") intermediateCompleted++;
        else if (unit.difficulty === "advanced") advancedCompleted++;
        else if (unit.difficulty === "nextgen") nextgenCompleted++;
      }
    }
    
    // Unlock tiers based on 70% completion of previous tier
    const beginnerThreshold = Math.ceil(beginnerUnits.length * 0.7);
    const intermediateThreshold = Math.ceil(intermediateUnits.length * 0.7);
    const advancedThreshold = Math.ceil(advancedUnits.length * 0.7);
    
    const intermediateUnlocked = beginnerUnits.length > 0 && beginnerCompleted >= beginnerThreshold;
    const advancedUnlocked = intermediateUnits.length > 0 && intermediateCompleted >= intermediateThreshold;
    const nextgenUnlocked = advancedUnits.length > 0 && advancedCompleted >= advancedThreshold;
    
    return this.updateTopicMastery(userId, topicId, {
      beginnerCompleted,
      intermediateCompleted,
      advancedCompleted,
      nextgenCompleted,
      intermediateUnlocked,
      advancedUnlocked,
      nextgenUnlocked,
    });
  }

  async getUserMasteredTopics(userId: string): Promise<{ topicId: number; topicTitle: string }[]> {
    const masteries = await db.select().from(topicMastery)
      .where(eq(topicMastery.userId, userId));
    
    const masteredTopics = [];
    for (const m of masteries) {
      // Consider a topic "mastered" if beginner is fully completed
      const units = await this.getLessonUnits(m.topicId, "beginner");
      if (units.length > 0 && m.beginnerCompleted >= units.length) {
        const topic = await this.getTopicById(m.topicId);
        if (topic) {
          masteredTopics.push({ topicId: topic.id, topicTitle: topic.title });
        }
      }
    }
    return masteredTopics;
  }

  // User Profiles
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async createOrUpdateUserProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    if (existing) {
      const [updated] = await db.update(userProfiles)
        .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(userProfiles.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userProfiles)
      .values({ userId, ...data })
      .returning();
    return created;
  }

  // Pathways
  async getPathways(): Promise<Pathway[]> {
    return db.select().from(pathways).where(eq(pathways.isActive, true));
  }

  async getPathwayById(id: number): Promise<Pathway | undefined> {
    const [pathway] = await db.select().from(pathways).where(eq(pathways.id, id));
    return pathway;
  }

  async createPathway(pathway: InsertPathway): Promise<Pathway> {
    const [created] = await db.insert(pathways).values(pathway).returning();
    return created;
  }

  async getPathwayTopics(pathwayId: number): Promise<{ topic: Topic; order: number; isRequired: boolean }[]> {
    const results = await db.select({
      pathwayTopic: pathwayTopics,
      topic: topics,
    })
      .from(pathwayTopics)
      .innerJoin(topics, eq(pathwayTopics.topicId, topics.id))
      .where(eq(pathwayTopics.pathwayId, pathwayId))
      .orderBy(pathwayTopics.order);
    
    return results.map(r => ({
      topic: r.topic,
      order: r.pathwayTopic.order,
      isRequired: r.pathwayTopic.isRequired,
    }));
  }

  async addTopicToPathway(pathwayId: number, topicId: number, order: number, isRequired: boolean): Promise<PathwayTopic> {
    const [created] = await db.insert(pathwayTopics)
      .values({ pathwayId, topicId, order, isRequired })
      .returning();
    return created;
  }

  async getCustomPathways(userId: string): Promise<Pathway[]> {
    return db.select().from(pathways)
      .where(eq(pathways.createdByUserId, userId));
  }

  async getUserPathways(userId: string): Promise<{ pathway: Pathway; enrollment: UserPathway }[]> {
    const results = await db.select({
      pathway: pathways,
      enrollment: userPathways,
    })
      .from(userPathways)
      .innerJoin(pathways, eq(userPathways.pathwayId, pathways.id))
      .where(eq(userPathways.userId, userId));
    
    return results.map(r => ({ pathway: r.pathway, enrollment: r.enrollment }));
  }

  async enrollInPathway(userId: string, pathwayId: number): Promise<UserPathway> {
    const existing = await db.select().from(userPathways)
      .where(and(eq(userPathways.userId, userId), eq(userPathways.pathwayId, pathwayId)));
    if (existing.length > 0) return existing[0];
    
    const [created] = await db.insert(userPathways)
      .values({ userId, pathwayId })
      .returning();
    return created;
  }

  async updatePathwayProgress(userId: string, pathwayId: number, progress: number): Promise<UserPathway> {
    const [updated] = await db.update(userPathways)
      .set({ 
        progress, 
        status: progress >= 100 ? "completed" : "in_progress",
        completedAt: progress >= 100 ? sql`CURRENT_TIMESTAMP` : null,
      })
      .where(and(eq(userPathways.userId, userId), eq(userPathways.pathwayId, pathwayId)))
      .returning();
    return updated;
  }

  // Achievements
  async getAchievements(): Promise<Achievement[]> {
    return db.select().from(achievements);
  }

  async getAchievementById(id: number): Promise<Achievement | undefined> {
    const [achievement] = await db.select().from(achievements).where(eq(achievements.id, id));
    return achievement;
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [created] = await db.insert(achievements).values(achievement).returning();
    return created;
  }

  async getUserAchievements(userId: string): Promise<{ achievement: Achievement; earnedAt: Date }[]> {
    const results = await db.select({
      userAchievement: userAchievements,
      achievement: achievements,
    })
      .from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId));
    
    return results.map(r => ({ 
      achievement: r.achievement, 
      earnedAt: r.userAchievement.earnedAt 
    }));
  }

  async awardAchievement(userId: string, achievementId: number): Promise<UserAchievement> {
    const [created] = await db.insert(userAchievements)
      .values({ userId, achievementId })
      .returning();
    
    // Award XP for the achievement
    const achievement = await this.getAchievementById(achievementId);
    if (achievement?.xpReward && achievement.xpReward > 0) {
      await this.addXp(userId, achievement.xpReward);
    }
    
    return created;
  }

  async hasAchievement(userId: string, achievementId: number): Promise<boolean> {
    const [existing] = await db.select().from(userAchievements)
      .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)));
    return !!existing;
  }

  async checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
    const allAchievements = await this.getAchievements();
    const userXpData = await this.getUserXp(userId);
    const masteredTopics = await this.getUserMasteredTopics(userId);
    const researchIdeasList = await this.getValidatedResearchIdeas(userId);
    const streak = await this.getUserStreak(userId);
    const lessonsProgress = await db.select().from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.status, "completed")));
    
    const awarded: Achievement[] = [];
    
    for (const achievement of allAchievements) {
      if (await this.hasAchievement(userId, achievement.id)) continue;
      
      const req = achievement.requirement as { type: string; value: number };
      let earned = false;
      
      switch (req.type) {
        case "xp":
          earned = (userXpData?.totalXp || 0) >= req.value;
          break;
        case "topics":
          earned = masteredTopics.length >= req.value;
          break;
        case "lessons":
          earned = lessonsProgress.length >= req.value;
          break;
        case "streak":
          earned = (streak?.currentStreak || 0) >= req.value;
          break;
        case "research_ideas":
          earned = researchIdeasList.length >= req.value;
          break;
        case "polymath":
          earned = masteredTopics.length >= 50 && researchIdeasList.length >= 5;
          break;
      }
      
      if (earned) {
        await this.awardAchievement(userId, achievement.id);
        awarded.push(achievement);
      }
    }
    
    return awarded;
  }

  // Monthly Challenges
  async getActiveChallenges(): Promise<MonthlyChallenge[]> {
    const now = new Date();
    return db.select().from(monthlyChallenges)
      .where(and(
        eq(monthlyChallenges.isActive, true),
        sql`${monthlyChallenges.startDate} <= ${now}`,
        sql`${monthlyChallenges.endDate} >= ${now}`
      ));
  }

  async getChallengeById(id: number): Promise<MonthlyChallenge | undefined> {
    const [challenge] = await db.select().from(monthlyChallenges).where(eq(monthlyChallenges.id, id));
    return challenge;
  }

  async createChallenge(challenge: InsertMonthlyChallenge): Promise<MonthlyChallenge> {
    const [created] = await db.insert(monthlyChallenges).values(challenge).returning();
    return created;
  }

  async joinChallenge(userId: string, challengeId: number): Promise<UserChallengeProgress> {
    const existing = await db.select().from(userChallengeProgress)
      .where(and(eq(userChallengeProgress.userId, userId), eq(userChallengeProgress.challengeId, challengeId)));
    if (existing.length > 0) return existing[0];
    
    const [created] = await db.insert(userChallengeProgress)
      .values({ userId, challengeId })
      .returning();
    return created;
  }

  async updateChallengeProgress(userId: string, challengeId: number, lessonsCompleted: number, xpEarned: number): Promise<UserChallengeProgress> {
    const [updated] = await db.update(userChallengeProgress)
      .set({ lessonsCompleted, xpEarned })
      .where(and(eq(userChallengeProgress.userId, userId), eq(userChallengeProgress.challengeId, challengeId)))
      .returning();
    return updated;
  }

  async getChallengeLeaderboard(challengeId: number): Promise<{ userId: string; lessonsCompleted: number; xpEarned: number; rank: number }[]> {
    const participants = await db.select().from(userChallengeProgress)
      .where(eq(userChallengeProgress.challengeId, challengeId))
      .orderBy(desc(userChallengeProgress.xpEarned));
    
    return participants.map((p, index) => ({
      userId: p.userId,
      lessonsCompleted: p.lessonsCompleted,
      xpEarned: p.xpEarned,
      rank: index + 1,
    }));
  }

  // Research Ideas
  async createResearchIdea(idea: InsertResearchIdea): Promise<ResearchIdea> {
    const [created] = await db.insert(researchIdeas).values(idea).returning();
    return created;
  }

  async getUserResearchIdeas(userId: string): Promise<ResearchIdea[]> {
    return db.select().from(researchIdeas)
      .where(eq(researchIdeas.userId, userId))
      .orderBy(desc(researchIdeas.createdAt));
  }

  async getValidatedResearchIdeas(userId: string): Promise<ResearchIdea[]> {
    return db.select().from(researchIdeas)
      .where(and(eq(researchIdeas.userId, userId), eq(researchIdeas.status, "validated")));
  }

  async voteResearchIdea(ideaId: number): Promise<ResearchIdea> {
    const [updated] = await db.update(researchIdeas)
      .set({ votes: sql`${researchIdeas.votes} + 1` })
      .where(eq(researchIdeas.id, ideaId))
      .returning();
    
    // Auto-validate if reaches 10 votes
    if ((updated.votes ?? 0) >= 10 && updated.status === "submitted") {
      const [validated] = await db.update(researchIdeas)
        .set({ status: "validated" })
        .where(eq(researchIdeas.id, ideaId))
        .returning();
      return validated;
    }
    
    return updated;
  }

  // User Streaks
  async getUserStreak(userId: string): Promise<UserStreak | undefined> {
    const [streak] = await db.select().from(userStreaks).where(eq(userStreaks.userId, userId));
    return streak;
  }

  async updateStreak(userId: string): Promise<UserStreak> {
    const existing = await this.getUserStreak(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (existing) {
      const lastActivity = existing.lastActivityDate ? new Date(existing.lastActivityDate) : null;
      lastActivity?.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let newStreak = existing.currentStreak;
      
      if (lastActivity?.getTime() === today.getTime()) {
        // Already logged today
        return existing;
      } else if (lastActivity?.getTime() === yesterday.getTime()) {
        // Consecutive day
        newStreak = existing.currentStreak + 1;
      } else {
        // Streak broken
        newStreak = 1;
      }
      
      const [updated] = await db.update(userStreaks)
        .set({
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, existing.longestStreak),
          lastActivityDate: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(userStreaks.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(userStreaks)
      .values({ userId, currentStreak: 1, longestStreak: 1, lastActivityDate: sql`CURRENT_TIMESTAMP` })
      .returning();
    return created;
  }

  // Custom Topics
  async createCustomTopic(topic: InsertCustomTopic): Promise<CustomTopic> {
    const [created] = await db.insert(customTopics).values(topic).returning();
    return created;
  }

  async getUserCustomTopics(userId: string): Promise<CustomTopic[]> {
    return db.select().from(customTopics)
      .where(eq(customTopics.userId, userId))
      .orderBy(desc(customTopics.createdAt));
  }

  async getCustomTopicById(id: number): Promise<CustomTopic | undefined> {
    const [topic] = await db.select().from(customTopics)
      .where(eq(customTopics.id, id));
    return topic;
  }

  async updateCustomTopicStatus(id: number, status: string, generatedTopicId?: number, generatedCategoryId?: number): Promise<CustomTopic> {
    const [updated] = await db.update(customTopics)
      .set({ status, generatedTopicId, generatedCategoryId })
      .where(eq(customTopics.id, id))
      .returning();
    return updated;
  }

  // XP by difficulty
  getXpForDifficulty(difficulty: string): number {
    switch (difficulty) {
      case "beginner":
        return 1;
      case "intermediate":
        return 3;
      case "advanced":
        return 5;
      case "nextgen":
        return 10;
      default:
        return 1;
    }
  }

  // User Infographics
  async createUserInfographic(infographic: InsertUserInfographic): Promise<UserInfographic> {
    const [created] = await db.insert(userInfographics).values(infographic).returning();
    return created;
  }

  async getUserInfographics(userId: string): Promise<UserInfographic[]> {
    return db.select().from(userInfographics)
      .where(eq(userInfographics.userId, userId))
      .orderBy(desc(userInfographics.generatedAt));
  }

  async getUserInfographicByTopic(userId: string, topicId: number): Promise<UserInfographic | undefined> {
    const [infographic] = await db.select().from(userInfographics)
      .where(and(
        eq(userInfographics.userId, userId),
        eq(userInfographics.topicId, topicId)
      ));
    return infographic;
  }

  async countUserInfographics(userId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(userInfographics)
      .where(eq(userInfographics.userId, userId));
    return Number(result?.count || 0);
  }

  // 3D Rewards
  async createUser3DReward(reward: InsertUser3DReward): Promise<User3DReward> {
    const [created] = await db.insert(user3DRewards).values(reward).returning();
    return created;
  }

  async getUser3DRewards(userId: string): Promise<User3DReward[]> {
    return db.select().from(user3DRewards)
      .where(eq(user3DRewards.userId, userId))
      .orderBy(desc(user3DRewards.createdAt));
  }

  async updateUser3DRewardStatus(id: number, status: string, modelUrl?: string): Promise<User3DReward> {
    const updates: any = { status };
    if (modelUrl) {
      updates.modelUrl = modelUrl;
      updates.completedAt = sql`CURRENT_TIMESTAMP`;
    }
    const [updated] = await db.update(user3DRewards)
      .set(updates)
      .where(eq(user3DRewards.id, id))
      .returning();
    return updated;
  }

  async getPending3DRewards(): Promise<User3DReward[]> {
    return db.select().from(user3DRewards)
      .where(eq(user3DRewards.status, "pending"));
  }

  // Custom Feeds
  async getCustomFeeds(userId: string): Promise<CustomFeed[]> {
    return db.select().from(customFeeds)
      .where(eq(customFeeds.userId, userId))
      .orderBy(desc(customFeeds.createdAt));
  }

  async getCustomFeedById(id: number): Promise<CustomFeed | undefined> {
    const [feed] = await db.select().from(customFeeds)
      .where(eq(customFeeds.id, id));
    return feed;
  }

  async createCustomFeed(feed: InsertCustomFeed): Promise<CustomFeed> {
    const [created] = await db.insert(customFeeds).values(feed).returning();
    return created;
  }

  async updateCustomFeed(id: number, updates: Partial<InsertCustomFeed>): Promise<CustomFeed> {
    const [updated] = await db.update(customFeeds)
      .set(updates)
      .where(eq(customFeeds.id, id))
      .returning();
    return updated;
  }

  async deleteCustomFeed(id: number): Promise<void> {
    await db.delete(customFeeds).where(eq(customFeeds.id, id));
  }

  async setDefaultFeed(userId: string, feedId: number | null): Promise<void> {
    // First, unset all defaults for this user
    await db.update(customFeeds)
      .set({ isDefault: false })
      .where(eq(customFeeds.userId, userId));
    
    // Then set the new default if provided
    if (feedId !== null) {
      await db.update(customFeeds)
        .set({ isDefault: true })
        .where(and(
          eq(customFeeds.id, feedId),
          eq(customFeeds.userId, userId)
        ));
    }
  }

  async getDefaultFeed(userId: string): Promise<CustomFeed | undefined> {
    const [feed] = await db.select().from(customFeeds)
      .where(and(
        eq(customFeeds.userId, userId),
        eq(customFeeds.isDefault, true)
      ));
    return feed;
  }

  async getFeedCardsByTopics(topicIds: number[], limit: number = 50): Promise<{ card: KnowledgeCard; topic: Topic; category?: Category }[]> {
    if (topicIds.length === 0) return [];
    
    const cards = await db.select({
      card: knowledgeCards,
      topic: topics,
      category: categories,
    })
      .from(knowledgeCards)
      .innerJoin(topics, eq(knowledgeCards.topicId, topics.id))
      .leftJoin(categories, eq(topics.categoryId, categories.id))
      .where(inArray(knowledgeCards.topicId, topicIds))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
    
    return cards.map(row => ({
      card: row.card,
      topic: row.topic,
      category: row.category || undefined,
    }));
  }

  // Practice Tests
  async createPracticeTest(test: InsertPracticeTest): Promise<PracticeTest> {
    const [created] = await db.insert(practiceTests).values(test).returning();
    return created;
  }

  async getPracticeTest(id: number): Promise<PracticeTest | undefined> {
    const [test] = await db.select().from(practiceTests).where(eq(practiceTests.id, id));
    return test;
  }

  async getUserPracticeTests(userId: string): Promise<PracticeTest[]> {
    return db.select().from(practiceTests)
      .where(eq(practiceTests.userId, userId))
      .orderBy(desc(practiceTests.createdAt));
  }

  async updatePracticeTestStatus(id: number, status: string, totalQuestions?: number): Promise<PracticeTest> {
    const updates: any = { status };
    if (totalQuestions !== undefined) {
      updates.totalQuestions = totalQuestions;
    }
    const [updated] = await db.update(practiceTests)
      .set(updates)
      .where(eq(practiceTests.id, id))
      .returning();
    return updated;
  }

  // Practice Test Questions
  async createPracticeTestQuestion(question: InsertPracticeTestQuestion): Promise<PracticeTestQuestion> {
    const [created] = await db.insert(practiceTestQuestions).values(question).returning();
    return created;
  }

  async createPracticeTestQuestions(questions: InsertPracticeTestQuestion[]): Promise<PracticeTestQuestion[]> {
    if (questions.length === 0) return [];
    const created = await db.insert(practiceTestQuestions).values(questions).returning();
    return created;
  }

  async getPracticeTestQuestions(testId: number): Promise<PracticeTestQuestion[]> {
    return db.select().from(practiceTestQuestions)
      .where(eq(practiceTestQuestions.testId, testId))
      .orderBy(practiceTestQuestions.questionIndex);
  }

  async getPracticeTestQuestion(id: number): Promise<PracticeTestQuestion | undefined> {
    const [question] = await db.select().from(practiceTestQuestions)
      .where(eq(practiceTestQuestions.id, id));
    return question;
  }

  // Practice Test Attempts
  async createPracticeTestAttempt(attempt: InsertPracticeTestAttempt): Promise<PracticeTestAttempt> {
    const [created] = await db.insert(practiceTestAttempts).values(attempt).returning();
    return created;
  }

  async getPracticeTestAttempt(id: number): Promise<PracticeTestAttempt | undefined> {
    const [attempt] = await db.select().from(practiceTestAttempts)
      .where(eq(practiceTestAttempts.id, id));
    return attempt;
  }

  async getUserPracticeTestAttempts(userId: string): Promise<{ attempt: PracticeTestAttempt; test: PracticeTest }[]> {
    const results = await db.select({
      attempt: practiceTestAttempts,
      test: practiceTests,
    })
      .from(practiceTestAttempts)
      .innerJoin(practiceTests, eq(practiceTestAttempts.testId, practiceTests.id))
      .where(eq(practiceTestAttempts.userId, userId))
      .orderBy(desc(practiceTestAttempts.startedAt));
    
    return results;
  }

  async getActiveAttempt(userId: string, testId: number): Promise<PracticeTestAttempt | undefined> {
    const [attempt] = await db.select().from(practiceTestAttempts)
      .where(and(
        eq(practiceTestAttempts.userId, userId),
        eq(practiceTestAttempts.testId, testId),
        eq(practiceTestAttempts.status, "in_progress")
      ));
    return attempt;
  }

  async updateAttemptAnswers(attemptId: number, answers: Record<string, number>, flaggedQuestions?: number[]): Promise<PracticeTestAttempt> {
    const updates: any = { answers };
    if (flaggedQuestions !== undefined) {
      updates.flaggedQuestions = flaggedQuestions;
    }
    const [updated] = await db.update(practiceTestAttempts)
      .set(updates)
      .where(eq(practiceTestAttempts.id, attemptId))
      .returning();
    return updated;
  }

  async updateAttemptTime(attemptId: number, timeSpent: number): Promise<PracticeTestAttempt> {
    const [updated] = await db.update(practiceTestAttempts)
      .set({ timeSpent })
      .where(eq(practiceTestAttempts.id, attemptId))
      .returning();
    return updated;
  }

  async completeAttempt(attemptId: number, score: number, categoryScores: Record<string, { correct: number; total: number }>): Promise<PracticeTestAttempt> {
    const [updated] = await db.update(practiceTestAttempts)
      .set({
        status: "completed",
        score,
        categoryScores,
        completedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(practiceTestAttempts.id, attemptId))
      .returning();
    return updated;
  }

  // Test Gap Recommendations
  async createTestGapRecommendations(recommendations: InsertTestGapRecommendation[]): Promise<TestGapRecommendation[]> {
    if (recommendations.length === 0) return [];
    const created = await db.insert(testGapRecommendations).values(recommendations).returning();
    return created;
  }

  async getTestGapRecommendations(attemptId: number): Promise<TestGapRecommendation[]> {
    return db.select().from(testGapRecommendations)
      .where(eq(testGapRecommendations.attemptId, attemptId))
      .orderBy(desc(testGapRecommendations.gapScore));
  }

  // Question Bank
  async getQuestionBankQuestions(testType: string, categories: string[], limit: number = 20): Promise<PracticeQuestionBank[]> {
    return db.select().from(practiceQuestionBank)
      .where(and(
        eq(practiceQuestionBank.testType, testType.toUpperCase()),
        inArray(practiceQuestionBank.category, categories)
      ))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  }

  async getQuestionBankCount(testType: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(practiceQuestionBank)
      .where(eq(practiceQuestionBank.testType, testType.toUpperCase()));
    return Number(result[0]?.count || 0);
  }

  async addQuestionToBank(question: InsertPracticeQuestionBank): Promise<PracticeQuestionBank> {
    const [created] = await db.insert(practiceQuestionBank).values(question).returning();
    return created;
  }

  async addQuestionsToBank(questions: InsertPracticeQuestionBank[]): Promise<PracticeQuestionBank[]> {
    if (questions.length === 0) return [];
    const created = await db.insert(practiceQuestionBank).values(questions).returning();
    return created;
  }

  // Unlock Keys
  async getUserKeys(userId: string): Promise<UnlockKeys> {
    const [existing] = await db.select().from(unlockKeys).where(eq(unlockKeys.userId, userId));
    if (existing) return existing;
    const [created] = await db.insert(unlockKeys)
      .values({ userId, totalKeys: 3, usedKeys: 0 })
      .returning();
    return created;
  }

  async useKeyOnTopic(userId: string, topicId: number): Promise<{ success: boolean; error?: string }> {
    const keys = await this.getUserKeys(userId);
    const availableKeys = keys.totalKeys - keys.usedKeys;
    if (availableKeys <= 0) {
      return { success: false, error: "No keys available" };
    }

    const mastery = await this.getOrCreateTopicMastery(userId, topicId);
    if (mastery.keyUnlocked) {
      return { success: false, error: "Topic already unlocked" };
    }

    const [updated] = await db.update(unlockKeys)
      .set({ usedKeys: sql`${unlockKeys.usedKeys} + 1`, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(unlockKeys.id, keys.id), sql`${unlockKeys.totalKeys} - ${unlockKeys.usedKeys} > 0`))
      .returning();

    if (!updated) {
      return { success: false, error: "No keys available" };
    }

    await db.update(topicMastery)
      .set({
        keyUnlocked: true,
        intermediateUnlocked: true,
        advancedUnlocked: true,
        nextgenUnlocked: true,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(topicMastery.id, mastery.id));

    await db.insert(keyUsageHistory).values({ userId, topicId });

    return { success: true };
  }

  async getKeyEarnProgress(userId: string): Promise<{ topicsCompletedToday: number; topicsNeeded: number; alreadyEarnedToday: boolean; qualifyingTopics: number[] }> {
    const today = new Date().toISOString().split('T')[0];
    const keys = await this.getUserKeys(userId);

    if (keys.lastKeyEarnedDate === today) {
      return { topicsCompletedToday: 0, topicsNeeded: 3, alreadyEarnedToday: true, qualifyingTopics: [] };
    }

    const allMastery = await db.select().from(topicMastery)
      .where(and(
        eq(topicMastery.userId, userId),
        eq(topicMastery.keyUnlocked, false),
        sql`${topicMastery.beginnerCompleted} > 0`,
        sql`${topicMastery.intermediateCompleted} > 0`,
        sql`${topicMastery.advancedCompleted} > 0`
      ));

    const earnedTopics = await db.select().from(keyEarnHistory)
      .where(eq(keyEarnHistory.userId, userId));
    const earnedTopicIds = new Set(earnedTopics.map(e => e.topicId));

    const qualifyingTopics = allMastery
      .filter(m => !earnedTopicIds.has(m.topicId))
      .map(m => m.topicId);

    return {
      topicsCompletedToday: qualifyingTopics.length,
      topicsNeeded: 3,
      alreadyEarnedToday: false,
      qualifyingTopics,
    };
  }

  async checkAndAwardDailyKey(userId: string): Promise<{ awarded: boolean; newTotal: number }> {
    const progress = await this.getKeyEarnProgress(userId);
    const keys = await this.getUserKeys(userId);

    if (progress.alreadyEarnedToday || progress.topicsCompletedToday < 3) {
      return { awarded: false, newTotal: keys.totalKeys };
    }

    const today = new Date().toISOString().split('T')[0];

    const [updated] = await db.update(unlockKeys)
      .set({
        totalKeys: sql`${unlockKeys.totalKeys} + 1`,
        lastKeyEarnedDate: today,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(
        eq(unlockKeys.id, keys.id),
        sql`${unlockKeys.lastKeyEarnedDate} IS DISTINCT FROM ${today}`
      ))
      .returning();

    if (!updated) {
      return { awarded: false, newTotal: keys.totalKeys };
    }

    const topicsToRecord = progress.qualifyingTopics.slice(0, 3);
    for (const topicId of topicsToRecord) {
      await db.insert(keyEarnHistory).values({ userId, topicId, earnDate: today });
    }

    return { awarded: true, newTotal: updated.totalKeys };
  }

  // Key Purchases (Dogecoin)
  async createKeyPurchaseRequest(userId: string, quantity: number): Promise<KeyPurchaseRequest> {
    const [created] = await db.insert(keyPurchaseRequests)
      .values({ userId, quantity, dogeAmount: quantity, status: "pending" })
      .returning();
    return created;
  }

  async getPendingPurchaseRequests(): Promise<(KeyPurchaseRequest & { username?: string })[]> {
    const requests = await db.select({
      request: keyPurchaseRequests,
      firstName: users.firstName,
      lastName: users.lastName,
    })
      .from(keyPurchaseRequests)
      .leftJoin(users, eq(keyPurchaseRequests.userId, users.id))
      .where(eq(keyPurchaseRequests.status, "pending"))
      .orderBy(desc(keyPurchaseRequests.createdAt));

    return requests.map(r => ({
      ...r.request,
      username: [r.firstName, r.lastName].filter(Boolean).join(' ') || undefined,
    }));
  }

  async getUserPurchaseRequests(userId: string): Promise<KeyPurchaseRequest[]> {
    return db.select().from(keyPurchaseRequests)
      .where(eq(keyPurchaseRequests.userId, userId))
      .orderBy(desc(keyPurchaseRequests.createdAt));
  }

  async resolveKeyPurchaseRequest(requestId: number, approved: boolean, adminNote?: string): Promise<KeyPurchaseRequest> {
    const [updated] = await db.update(keyPurchaseRequests)
      .set({
        status: approved ? "approved" : "rejected",
        adminNote: adminNote || null,
        resolvedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(keyPurchaseRequests.id, requestId))
      .returning();

    if (approved) {
      await this.getUserKeys(updated.userId);
      await db.update(unlockKeys)
        .set({
          totalKeys: sql`${unlockKeys.totalKeys} + ${updated.quantity}`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(unlockKeys.userId, updated.userId));
    }

    return updated;
  }

  // Idea Contributions (Pioneer system)
  async createIdeaContribution(userId: string, topicId: number, unitId: number | null, title: string, description: string): Promise<IdeaContribution> {
    const [created] = await db.insert(ideaContributions).values({
      userId,
      topicId,
      unitId: unitId || null,
      title,
      description,
    }).returning();
    return created;
  }

  async getIdeaContributionsByTopic(topicId: number): Promise<(IdeaContribution & { username?: string })[]> {
    const results = await db
      .select({
        idea: ideaContributions,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(ideaContributions)
      .leftJoin(users, eq(ideaContributions.userId, users.id))
      .where(eq(ideaContributions.topicId, topicId))
      .orderBy(desc(ideaContributions.submittedAt));

    return results.map(r => ({
      ...r.idea,
      username: [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Anonymous Pioneer',
    }));
  }

  async getUserIdeaContributions(userId: string): Promise<IdeaContribution[]> {
    return db.select().from(ideaContributions)
      .where(eq(ideaContributions.userId, userId))
      .orderBy(desc(ideaContributions.submittedAt));
  }

  // Nova Coins
  async getUserNovaCoins(userId: string): Promise<NovaCoin> {
    const [existing] = await db.select().from(novaCoins).where(eq(novaCoins.userId, userId));
    if (existing) return existing;

    const [created] = await db.insert(novaCoins).values({ userId, totalCoins: 0 }).returning();
    return created;
  }

  async awardNovaCoin(userId: string): Promise<NovaCoin> {
    const existing = await this.getUserNovaCoins(userId);
    const [updated] = await db.update(novaCoins)
      .set({
        totalCoins: sql`${novaCoins.totalCoins} + 1`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(novaCoins.userId, userId))
      .returning();
    return updated || existing;
  }

  async getTtsSettings(userId: string): Promise<{ voicePreset: string; referenceAudio: string | null; playbackSpeed: number }> {
    const profile = await this.getUserProfile(userId);
    return {
      voicePreset: profile?.ttsVoicePreset || "browser",
      referenceAudio: profile?.ttsReferenceAudio || null,
      playbackSpeed: parseFloat(profile?.ttsPlaybackSpeed || "1.0") || 1.0,
    };
  }

  async saveTtsSettings(userId: string, voicePreset: string, referenceAudio?: string | null, playbackSpeed?: number): Promise<void> {
    const updates: Partial<InsertUserProfile> = {
      ttsVoicePreset: voicePreset,
    };
    if (referenceAudio !== undefined) updates.ttsReferenceAudio = referenceAudio;
    if (playbackSpeed !== undefined) updates.ttsPlaybackSpeed = String(playbackSpeed);
    // createOrUpdateUserProfile appends updatedAt internally
    await this.createOrUpdateUserProfile(userId, updates);
  }

  async getTtsAudioCache(unitId: number, voiceConfigHash: string): Promise<{ audioData: string; audioFormat: string } | null> {
    const [cached] = await db.select()
      .from(ttsAudioCache)
      .where(and(eq(ttsAudioCache.unitId, unitId), eq(ttsAudioCache.voiceConfigHash, voiceConfigHash)));
    if (!cached) return null;
    return { audioData: cached.audioData, audioFormat: cached.audioFormat || "wav" };
  }

  async saveTtsAudioCache(unitId: number, voiceConfigHash: string, audioData: string, audioFormat: string): Promise<void> {
    try {
      await db.insert(ttsAudioCache).values({ unitId, voiceConfigHash, audioData, audioFormat });
    } catch {
      // Ignore duplicate key errors
    }
  }
}

export const storage = new DatabaseStorage();
