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

// Lesson Units (AI-generated learning content)
export const lessonUnits = pgTable("lesson_units", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  difficulty: text("difficulty").notNull(), // beginner, intermediate, advanced
  unitIndex: integer("unit_index").notNull(),
  title: text("title").notNull(),
  outline: text("outline"), // Brief description of unit
  contentJson: jsonb("content_json"), // Full lesson content: { concept, analogy, example, quiz, crossLinks }
  generatedAt: timestamp("generated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Lesson Progress (user completion tracking per unit)
export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  unitId: integer("unit_id").references(() => lessonUnits.id).notNull(),
  status: text("status").notNull().default("not_started"), // not_started, in_progress, completed
  quizScore: integer("quiz_score"), // null if not attempted, 0-100
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at").default(sql`CURRENT_TIMESTAMP`),
});

// Topic Mastery (tracks unlocked tiers per user per topic)
export const topicMastery = pgTable("topic_mastery", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  beginnerUnlocked: boolean("beginner_unlocked").default(true).notNull(),
  intermediateUnlocked: boolean("intermediate_unlocked").default(false).notNull(),
  advancedUnlocked: boolean("advanced_unlocked").default(false).notNull(),
  nextgenUnlocked: boolean("nextgen_unlocked").default(false).notNull(),
  beginnerCompleted: integer("beginner_completed").default(0).notNull(),
  intermediateCompleted: integer("intermediate_completed").default(0).notNull(),
  advancedCompleted: integer("advanced_completed").default(0).notNull(),
  nextgenCompleted: integer("nextgen_completed").default(0).notNull(),
  keyUnlocked: boolean("key_unlocked").default(false).notNull(), // True if user used an unlock key on this topic
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Unlock Keys (earned by mastering topics, can unlock all tiers of any topic)
export const unlockKeys = pgTable("unlock_keys", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  totalKeys: integer("total_keys").default(3).notNull(),
  usedKeys: integer("used_keys").default(0).notNull(),
  lastKeyEarnedDate: varchar("last_key_earned_date"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Key Usage History (tracks which topics were unlocked with keys)
export const keyUsageHistory = pgTable("key_usage_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  usedAt: timestamp("used_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Key Earn History (tracks which topics counted toward earning a daily key)
export const keyEarnHistory = pgTable("key_earn_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  earnDate: varchar("earn_date").notNull(),
  earnedAt: timestamp("earned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Key Purchase Requests (Dogecoin purchases awaiting admin approval)
export const keyPurchaseRequests = pgTable("key_purchase_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  quantity: integer("quantity").notNull(),
  dogeAmount: integer("doge_amount").notNull(),
  status: varchar("status").default("pending").notNull(),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  resolvedAt: timestamp("resolved_at"),
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

// User Profiles (background, expertise, preferences)
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  ageRange: text("age_range"), // "under18", "18-24", "25-34", "35-44", "45-54", "55+"
  technicalLevel: text("technical_level").default("beginner"), // beginner, intermediate, advanced, expert
  priorExperience: text("prior_experience").array(), // ["software", "physics", "music", etc.]
  allowTestOut: boolean("allow_test_out").default(false).notNull(),
  huggingFaceToken: text("hugging_face_token"), // Optional HF token for free models
  ollamaUrl: text("ollama_url"), // Optional local Ollama URL (e.g., http://localhost:11434)
  openRouterKey: text("open_router_key"), // Optional OpenRouter API key for paid models
  preferredAiProvider: text("preferred_ai_provider").default("openai"), // "openai", "huggingface", "ollama", "openrouter"
  preferredModel: text("preferred_model"), // Specific model name for the provider
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Learning Pathways (curated groupings like Physics, Engineering, etc.)
export const pathways = pgTable("pathways", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  difficulty: text("difficulty").default("mixed"), // beginner, intermediate, advanced, mixed
  estimatedHours: integer("estimated_hours"),
  isActive: boolean("is_active").default(true).notNull(),
  createdByUserId: varchar("created_by_user_id"), // null = system pathway, set = user-created custom pathway
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Pathway Topics (topics recommended within a pathway)
export const pathwayTopics = pgTable("pathway_topics", {
  id: serial("id").primaryKey(),
  pathwayId: integer("pathway_id").references(() => pathways.id).notNull(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  order: integer("order").default(0).notNull(),
  isRequired: boolean("is_required").default(true).notNull(),
});

// User Pathway Enrollment
export const userPathways = pgTable("user_pathways", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  pathwayId: integer("pathway_id").references(() => pathways.id).notNull(),
  status: text("status").default("enrolled").notNull(), // enrolled, in_progress, completed
  progress: integer("progress").default(0).notNull(), // percentage 0-100
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// Achievements System
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: text("category").notNull(), // milestone, streak, rare, mastery, research
  requirement: jsonb("requirement").notNull(), // { type: "xp", value: 100 } or { type: "topics", value: 25 }
  xpReward: integer("xp_reward").default(0),
  isSecret: boolean("is_secret").default(false).notNull(), // Easter egg achievements
  rarity: text("rarity").default("common"), // common, uncommon, rare, epic, legendary
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// User Achievements (earned achievements)
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  achievementId: integer("achievement_id").references(() => achievements.id).notNull(),
  earnedAt: timestamp("earned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  progress: integer("progress").default(0), // For tracking progress toward achievement
});

// Monthly/Quarterly Challenges
export const monthlyChallenges = pgTable("monthly_challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  topicTitle: text("topic_title").notNull(), // The frontier topic to explore
  topicDescription: text("topic_description").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  xpMultiplier: integer("xp_multiplier").default(2), // Bonus XP multiplier
  isActive: boolean("is_active").default(true).notNull(),
  challengeType: text("challenge_type").default("monthly"), // monthly, quarterly
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// User Challenge Progress
export const userChallengeProgress = pgTable("user_challenge_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  challengeId: integer("challenge_id").references(() => monthlyChallenges.id).notNull(),
  lessonsCompleted: integer("lessons_completed").default(0).notNull(),
  xpEarned: integer("xp_earned").default(0).notNull(),
  rank: integer("rank"), // Leaderboard position
  completedAt: timestamp("completed_at"),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Research Ideas (for Polymath achievement - novel research paths)
export const researchIdeas = pgTable("research_ideas", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  relatedTopics: integer("related_topics").array(), // Topic IDs that inspired this
  status: text("status").default("submitted"), // submitted, validated, featured
  votes: integer("votes").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// User Learning Streaks
export const userStreaks = pgTable("user_streaks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastActivityDate: timestamp("last_activity_date"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Custom User Topics (user-created learning journeys)
export const customTopics = pgTable("custom_topics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  generatedCategoryId: integer("generated_category_id").references(() => categories.id),
  generatedTopicId: integer("generated_topic_id").references(() => topics.id),
  status: text("status").default("pending"), // pending, generating, ready, failed
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// User Infographics (recap cheat sheets earned on topic completion)
export const userInfographics = pgTable("user_infographics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  topicTitle: text("topic_title").notNull(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  prompt: text("prompt"), // The prompt used to generate the infographic
  generatedAt: timestamp("generated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// 3D Model Rewards (earned after collecting 10 infographics)
export const user3DRewards = pgTable("user_3d_rewards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicIds: integer("topic_ids").array().notNull(), // The 10 topics that unlocked this reward
  artDescription: text("art_description").notNull(), // AI-generated artistic blend description
  modelUrl: text("model_url"), // URL to the 3D model once generated (null = pending)
  status: text("status").default("pending").notNull(), // pending, generating, ready, failed
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// Custom Feeds (user-defined topic filters for personalized feed experience)
export const customFeeds = pgTable("custom_feeds", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  topicIds: integer("topic_ids").array().notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Practice Tests (standardized test prep like MCAT, GRE, SAT)
export const practiceTests = pgTable("practice_tests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  testType: text("test_type").notNull(), // MCAT, GRE, SAT, IQ, custom
  title: text("title").notNull(),
  description: text("description"),
  totalQuestions: integer("total_questions").default(0).notNull(),
  timeLimit: integer("time_limit"), // in minutes, null = untimed
  categories: text("categories").array(), // question categories/sections
  status: text("status").default("generating").notNull(), // generating, ready, failed
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Question Bank - Reusable pool of practice questions to reduce AI generation costs
export const practiceQuestionBank = pgTable("practice_question_bank", {
  id: serial("id").primaryKey(),
  testType: text("test_type").notNull(), // MCAT, GRE, SAT, etc.
  category: text("category").notNull(), // e.g., Biology, Chemistry for MCAT
  questionType: text("question_type").default("multiple_choice").notNull(),
  passage: text("passage"), // for passage-based questions
  question: text("question").notNull(),
  options: jsonb("options").notNull(), // string array of options
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull(),
  difficulty: text("difficulty").default("medium"), // easy, medium, hard
  isPublic: boolean("is_public").default(true), // publicly available question
  source: text("source"), // source attribution if any
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Practice Test Questions
export const practiceTestQuestions = pgTable("practice_test_questions", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").references(() => practiceTests.id).notNull(),
  questionIndex: integer("question_index").notNull(),
  category: text("category").notNull(), // e.g., Biology, Chemistry for MCAT
  questionType: text("question_type").default("multiple_choice").notNull(), // multiple_choice, passage_based
  passage: text("passage"), // for passage-based questions
  question: text("question").notNull(),
  options: jsonb("options").notNull(), // string array of options
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull(),
  difficulty: text("difficulty").default("medium"), // easy, medium, hard
});

// Practice Test Attempts (user's test sessions)
export const practiceTestAttempts = pgTable("practice_test_attempts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  testId: integer("test_id").references(() => practiceTests.id).notNull(),
  status: text("status").default("in_progress").notNull(), // in_progress, completed, abandoned
  answers: jsonb("answers").default('{}').notNull(), // { questionId: selectedIndex }
  flaggedQuestions: integer("flagged_questions").array(), // question IDs flagged for review
  score: integer("score"), // percentage 0-100
  categoryScores: jsonb("category_scores"), // { category: { correct: n, total: n } }
  timeSpent: integer("time_spent").default(0), // seconds
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// Recommended Learning from Test Gaps
export const testGapRecommendations = pgTable("test_gap_recommendations", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").references(() => practiceTestAttempts.id).notNull(),
  category: text("category").notNull(),
  gapScore: integer("gap_score").notNull(), // how weak in this area (0-100, higher = weaker)
  suggestedTopicTitle: text("suggested_topic_title").notNull(),
  suggestedTopicDescription: text("suggested_topic_description"),
  customTopicId: integer("custom_topic_id").references(() => customTopics.id), // if user created the journey
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Idea Contributions (Pioneer system for novel research ideas)
export const ideaContributions = pgTable("idea_contributions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  topicId: integer("topic_id").references(() => topics.id).notNull(),
  unitId: integer("unit_id").references(() => lessonUnits.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  submittedAt: timestamp("submitted_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Nova Coins (valueless credits tracking novel idea contributions)
export const novaCoins = pgTable("nova_coins", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  totalCoins: integer("total_coins").default(0).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
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
export const insertLessonUnitSchema = createInsertSchema(lessonUnits).omit({ id: true, generatedAt: true });
export const insertLessonProgressSchema = createInsertSchema(lessonProgress).omit({ id: true, completedAt: true, lastAccessedAt: true });
export const insertTopicMasterySchema = createInsertSchema(topicMastery).omit({ id: true, updatedAt: true });
export const insertUnlockKeysSchema = createInsertSchema(unlockKeys).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKeyUsageHistorySchema = createInsertSchema(keyUsageHistory).omit({ id: true, usedAt: true });
export const insertKeyEarnHistorySchema = createInsertSchema(keyEarnHistory).omit({ id: true, earnedAt: true });
export const insertKeyPurchaseRequestSchema = createInsertSchema(keyPurchaseRequests).omit({ id: true, createdAt: true, resolvedAt: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPathwaySchema = createInsertSchema(pathways).omit({ id: true, createdAt: true });
export const insertPathwayTopicSchema = createInsertSchema(pathwayTopics).omit({ id: true });
export const insertUserPathwaySchema = createInsertSchema(userPathways).omit({ id: true, startedAt: true, completedAt: true });
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true, createdAt: true });
export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({ id: true, earnedAt: true });
export const insertMonthlyChallengeSchema = createInsertSchema(monthlyChallenges).omit({ id: true, createdAt: true });
export const insertUserChallengeProgressSchema = createInsertSchema(userChallengeProgress).omit({ id: true, joinedAt: true, completedAt: true });
export const insertResearchIdeaSchema = createInsertSchema(researchIdeas).omit({ id: true, createdAt: true });
export const insertUserStreakSchema = createInsertSchema(userStreaks).omit({ id: true, updatedAt: true });
export const insertCustomTopicSchema = createInsertSchema(customTopics).omit({ id: true, createdAt: true });
export const insertUserInfographicSchema = createInsertSchema(userInfographics).omit({ id: true, generatedAt: true });
export const insertUser3DRewardSchema = createInsertSchema(user3DRewards).omit({ id: true, createdAt: true, completedAt: true });
export const insertCustomFeedSchema = createInsertSchema(customFeeds).omit({ id: true, createdAt: true });
export const insertPracticeTestSchema = createInsertSchema(practiceTests).omit({ id: true, createdAt: true });
export const insertPracticeQuestionBankSchema = createInsertSchema(practiceQuestionBank).omit({ id: true, createdAt: true });
export const insertPracticeTestQuestionSchema = createInsertSchema(practiceTestQuestions).omit({ id: true });
export const insertPracticeTestAttemptSchema = createInsertSchema(practiceTestAttempts).omit({ id: true, startedAt: true, completedAt: true });
export const insertTestGapRecommendationSchema = createInsertSchema(testGapRecommendations).omit({ id: true, createdAt: true });
export const insertIdeaContributionSchema = createInsertSchema(ideaContributions).omit({ id: true, submittedAt: true });
export const insertNovaCoinSchema = createInsertSchema(novaCoins).omit({ id: true, updatedAt: true });

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
export type LessonUnit = typeof lessonUnits.$inferSelect;
export type InsertLessonUnit = z.infer<typeof insertLessonUnitSchema>;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type InsertLessonProgress = z.infer<typeof insertLessonProgressSchema>;
export type TopicMastery = typeof topicMastery.$inferSelect;
export type InsertTopicMastery = z.infer<typeof insertTopicMasterySchema>;
export type UnlockKeys = typeof unlockKeys.$inferSelect;
export type InsertUnlockKeys = z.infer<typeof insertUnlockKeysSchema>;
export type KeyUsageHistory = typeof keyUsageHistory.$inferSelect;
export type InsertKeyUsageHistory = z.infer<typeof insertKeyUsageHistorySchema>;
export type KeyEarnHistory = typeof keyEarnHistory.$inferSelect;
export type InsertKeyEarnHistory = z.infer<typeof insertKeyEarnHistorySchema>;
export type KeyPurchaseRequest = typeof keyPurchaseRequests.$inferSelect;
export type InsertKeyPurchaseRequest = z.infer<typeof insertKeyPurchaseRequestSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type Pathway = typeof pathways.$inferSelect;
export type InsertPathway = z.infer<typeof insertPathwaySchema>;
export type PathwayTopic = typeof pathwayTopics.$inferSelect;
export type InsertPathwayTopic = z.infer<typeof insertPathwayTopicSchema>;
export type UserPathway = typeof userPathways.$inferSelect;
export type InsertUserPathway = z.infer<typeof insertUserPathwaySchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type MonthlyChallenge = typeof monthlyChallenges.$inferSelect;
export type InsertMonthlyChallenge = z.infer<typeof insertMonthlyChallengeSchema>;
export type UserChallengeProgress = typeof userChallengeProgress.$inferSelect;
export type InsertUserChallengeProgress = z.infer<typeof insertUserChallengeProgressSchema>;
export type ResearchIdea = typeof researchIdeas.$inferSelect;
export type InsertResearchIdea = z.infer<typeof insertResearchIdeaSchema>;
export type UserStreak = typeof userStreaks.$inferSelect;
export type InsertUserStreak = z.infer<typeof insertUserStreakSchema>;
export type CustomTopic = typeof customTopics.$inferSelect;
export type InsertCustomTopic = z.infer<typeof insertCustomTopicSchema>;
export type UserInfographic = typeof userInfographics.$inferSelect;
export type InsertUserInfographic = z.infer<typeof insertUserInfographicSchema>;
export type User3DReward = typeof user3DRewards.$inferSelect;
export type InsertUser3DReward = z.infer<typeof insertUser3DRewardSchema>;
export type CustomFeed = typeof customFeeds.$inferSelect;
export type InsertCustomFeed = z.infer<typeof insertCustomFeedSchema>;
export type PracticeTest = typeof practiceTests.$inferSelect;
export type InsertPracticeTest = z.infer<typeof insertPracticeTestSchema>;
export type PracticeQuestionBank = typeof practiceQuestionBank.$inferSelect;
export type InsertPracticeQuestionBank = z.infer<typeof insertPracticeQuestionBankSchema>;
export type PracticeTestQuestion = typeof practiceTestQuestions.$inferSelect;
export type InsertPracticeTestQuestion = z.infer<typeof insertPracticeTestQuestionSchema>;
export type PracticeTestAttempt = typeof practiceTestAttempts.$inferSelect;
export type InsertPracticeTestAttempt = z.infer<typeof insertPracticeTestAttemptSchema>;
export type TestGapRecommendation = typeof testGapRecommendations.$inferSelect;
export type InsertTestGapRecommendation = z.infer<typeof insertTestGapRecommendationSchema>;
export type IdeaContribution = typeof ideaContributions.$inferSelect;
export type InsertIdeaContribution = z.infer<typeof insertIdeaContributionSchema>;
export type NovaCoin = typeof novaCoins.$inferSelect;
export type InsertNovaCoin = z.infer<typeof insertNovaCoinSchema>;

// Lesson content structure for AI generation
export interface LessonContent {
  concept: string;
  analogy: string;
  keyTakeaways?: string[];
  example: {
    title: string;
    content: string;
    code?: string;
  };
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  crossLinks?: {
    topicId: number;
    topicTitle: string;
    connection: string;
  }[];
  externalResources?: {
    title: string;
    url: string;
    type: "course" | "video" | "paper" | "book" | "forum" | "tool";
    description: string;
  }[];
}

// Next Gen content structure for frontier research challenges
export interface NextGenContent {
  researchContext: string;
  openRoadblocks?: {
    title: string;
    description: string;
    whyItMatters: string;
  }[];
  industryChallenge: {
    title: string;
    description: string;
    currentApproaches: string[];
    openQuestions: string[];
  };
  thoughtExercises: {
    prompt: string;
    hints: string[];
    explorationPaths: string[];
  }[];
  emergingTrends: {
    trend: string;
    implications: string;
    potentialBreakthroughs: string;
  }[];
  creativeSynthesis: {
    challenge: string;
    relatedConcepts: string[];
    suggestedConnections: string[];
  };
  communityForums?: {
    name: string;
    url: string;
    description: string;
  }[];
  resources?: {
    title: string;
    url?: string;
    type: string;
    description: string;
  }[];
}
