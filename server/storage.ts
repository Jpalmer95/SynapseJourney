import {
  users, categories, topics, knowledgeCards, topicConnections,
  userProgress, savedCards, learningRoadmaps, aiChatSessions, aiChatMessages,
  type Category, type InsertCategory,
  type Topic, type InsertTopic,
  type KnowledgeCard, type InsertKnowledgeCard,
  type TopicConnection, type InsertTopicConnection,
  type UserProgress, type InsertUserProgress,
  type SavedCard, type InsertSavedCard,
  type LearningRoadmap, type InsertLearningRoadmap,
  type AiChatSession, type InsertAiChatSession,
  type AiChatMessage, type InsertAiChatMessage,
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
}

export const storage = new DatabaseStorage();
