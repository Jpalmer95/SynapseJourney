import {
  users, categories, topics, knowledgeCards, topicConnections,
  userProgress, savedCards, learningRoadmaps, aiChatSessions, aiChatMessages,
  userXp, userCategoryPreferences, lessonUnits, lessonProgress, topicMastery,
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
  type LessonContent,
  type NextGenContent,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

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
  getEnabledCategories(userId: string): Promise<number[]>;
  getFeedCardsFiltered(userId: string, limit?: number): Promise<{ card: KnowledgeCard; topic: Topic; category?: Category }[]>;

  // Lesson Units
  getLessonUnits(topicId: number, difficulty?: string): Promise<LessonUnit[]>;
  getLessonUnit(id: number): Promise<LessonUnit | undefined>;
  getLessonUnitByIndex(topicId: number, difficulty: string, unitIndex: number): Promise<LessonUnit | undefined>;
  createLessonUnit(unit: InsertLessonUnit): Promise<LessonUnit>;
  updateLessonContent(unitId: number, contentJson: LessonContent | NextGenContent): Promise<LessonUnit>;

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

  async getEnabledCategories(userId: string): Promise<number[]> {
    const prefs = await this.getCategoryPreferences(userId);
    const allCategories = await this.getCategories();
    
    // If no preferences set, all categories are enabled by default
    if (prefs.length === 0) {
      return allCategories.map((c) => c.id);
    }
    
    const prefsMap = new Map(prefs.map((p) => [p.categoryId, p.enabled]));
    
    // Categories without explicit preference are enabled by default
    return allCategories
      .filter((c) => prefsMap.get(c.id) !== false)
      .map((c) => c.id);
  }

  async getFeedCardsFiltered(userId: string, limit = 20): Promise<{ card: KnowledgeCard; topic: Topic; category?: Category }[]> {
    const enabledCategories = await this.getEnabledCategories(userId);
    
    if (enabledCategories.length === 0) {
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

    // Filter by enabled categories
    return cards
      .filter((row) => !row.topic.categoryId || enabledCategories.includes(row.topic.categoryId))
      .map((row) => ({
        card: row.card,
        topic: row.topic,
        category: row.category || undefined,
      }));
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
}

export const storage = new DatabaseStorage();
