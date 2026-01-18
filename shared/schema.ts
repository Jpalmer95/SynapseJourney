import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";

// Knowledge Categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
});

// Knowledge Topics (nodes in the knowledge graph)
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  difficulty: text("difficulty").notNull().default("beginner"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Knowledge Cards (content pieces)
export const knowledgeCards = pgTable("knowledge_cards", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  cardType: text("card_type").notNull().default("text"),
  tags: text("tags").array(),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Topic Connections (edges in the knowledge graph)
export const topicConnections = pgTable("topic_connections", {
  id: serial("id").primaryKey(),
  fromTopicId: integer("from_topic_id").references(() => topics.id).notNull(),
  toTopicId: integer("to_topic_id").references(() => topics.id).notNull(),
  connectionType: text("connection_type").notNull().default("related"),
  strength: integer("strength").default(1),
});

// User Learning Progress with XP tracking
export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  status: text("status").notNull().default("discovered"),
  mastery: integer("mastery").default(0),
  timeSpent: integer("time_spent").default(0),
  xp: integer("xp").default(0),
  currentLevel: integer("current_level").default(0),
  lastAccessedAt: timestamp("last_accessed_at").default(sql`CURRENT_TIMESTAMP`),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`),
});

// User XP totals and level
export const userXp = pgTable("user_xp", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  totalXp: integer("total_xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// User Category Preferences (for settings)
export const userCategoryPreferences = pgTable("user_category_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
});

// Saved/Favorite Cards
export const savedCards = pgTable("saved_cards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  cardId: integer("card_id").references(() => knowledgeCards.id).notNull(),
  savedAt: timestamp("saved_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Learning Roadmaps (AI-generated paths)
export const learningRoadmaps = pgTable("learning_roadmaps", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  levels: jsonb("levels").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// AI Chat Sessions (per topic context)
export const aiChatSessions = pgTable("ai_chat_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicId: integer("topic_id").references(() => topics.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const aiChatMessages = pgTable("ai_chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => aiChatSessions.id).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  category: one(categories, {
    fields: [topics.categoryId],
    references: [categories.id],
  }),
  cards: many(knowledgeCards),
  connectionsFrom: many(topicConnections, { relationName: "fromTopic" }),
  connectionsTo: many(topicConnections, { relationName: "toTopic" }),
  progress: many(userProgress),
}));

export const knowledgeCardsRelations = relations(knowledgeCards, ({ one }) => ({
  topic: one(topics, {
    fields: [knowledgeCards.topicId],
    references: [topics.id],
  }),
}));

export const topicConnectionsRelations = relations(topicConnections, ({ one }) => ({
  fromTopic: one(topics, {
    fields: [topicConnections.fromTopicId],
    references: [topics.id],
    relationName: "fromTopic",
  }),
  toTopic: one(topics, {
    fields: [topicConnections.toTopicId],
    references: [topics.id],
    relationName: "toTopic",
  }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  topic: one(topics, {
    fields: [userProgress.topicId],
    references: [topics.id],
  }),
}));

// Insert Schemas
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertTopicSchema = createInsertSchema(topics).omit({ id: true, createdAt: true });
export const insertKnowledgeCardSchema = createInsertSchema(knowledgeCards).omit({ id: true, createdAt: true });
export const insertTopicConnectionSchema = createInsertSchema(topicConnections).omit({ id: true });
export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true, lastAccessedAt: true, startedAt: true });
export const insertSavedCardSchema = createInsertSchema(savedCards).omit({ id: true, savedAt: true });
export const insertLearningRoadmapSchema = createInsertSchema(learningRoadmaps).omit({ id: true, createdAt: true });
export const insertAiChatSessionSchema = createInsertSchema(aiChatSessions).omit({ id: true, createdAt: true });
export const insertAiChatMessageSchema = createInsertSchema(aiChatMessages).omit({ id: true, createdAt: true });
export const insertUserXpSchema = createInsertSchema(userXp).omit({ id: true, updatedAt: true });
export const insertUserCategoryPreferenceSchema = createInsertSchema(userCategoryPreferences).omit({ id: true });

// Types
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Topic = typeof topics.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type KnowledgeCard = typeof knowledgeCards.$inferSelect;
export type InsertKnowledgeCard = z.infer<typeof insertKnowledgeCardSchema>;
export type TopicConnection = typeof topicConnections.$inferSelect;
export type InsertTopicConnection = z.infer<typeof insertTopicConnectionSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type SavedCard = typeof savedCards.$inferSelect;
export type InsertSavedCard = z.infer<typeof insertSavedCardSchema>;
export type LearningRoadmap = typeof learningRoadmaps.$inferSelect;
export type InsertLearningRoadmap = z.infer<typeof insertLearningRoadmapSchema>;
export type AiChatSession = typeof aiChatSessions.$inferSelect;
export type InsertAiChatSession = z.infer<typeof insertAiChatSessionSchema>;
export type AiChatMessage = typeof aiChatMessages.$inferSelect;
export type InsertAiChatMessage = z.infer<typeof insertAiChatMessageSchema>;
export type UserXp = typeof userXp.$inferSelect;
export type InsertUserXp = z.infer<typeof insertUserXpSchema>;
export type UserCategoryPreference = typeof userCategoryPreferences.$inferSelect;
export type InsertUserCategoryPreference = z.infer<typeof insertUserCategoryPreferenceSchema>;
