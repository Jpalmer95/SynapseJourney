// server/routes/tests.ts — Practice Test Preparation Routes
import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { getUserChatProvider, validateUserChatCredentials, type ProviderConfig } from "../ai-providers";
import { getTestCategories, getDefaultTimeLimit, generatePracticeTestQuestions } from "./ai";

// AI chat schema for discussing practice test questions
const practiceTestChatSchema = z.object({
  question: z.string().min(1),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  explanation: z.string(),
  userMessage: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
});

export function registerTestsRoutes(app: Express) {
  // AI chat for discussing practice test questions
  app.post("/api/practice-tests/chat", isAuthenticated, async (req: any, res: Response) => {
    try {
      const parsed = practiceTestChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const { question, userAnswer, correctAnswer, explanation, userMessage, history } = parsed.data;
      const userId = req.user.claims.sub;
      
      // Get user's AI provider preference for chat (user pays via their API keys)
      const userProfile = await storage.getUserProfile(userId);
      const providerConfig: ProviderConfig = {
        provider: (userProfile?.preferredAiProvider as ProviderConfig["provider"]) || "gemini",
        huggingFaceToken: userProfile?.huggingFaceToken || undefined,
        ollamaUrl: userProfile?.ollamaUrl || undefined,
        openRouterKey: userProfile?.openRouterKey || undefined,
        preferredModel: userProfile?.preferredModel || undefined,
      };
      
      // Validate user has configured their own chat provider credentials
      const credentialCheck = validateUserChatCredentials(providerConfig);
      if (!credentialCheck.valid) {
        return res.status(402).json({ 
          error: "CHAT_PROVIDER_REQUIRED",
          message: "AI chat requires you to set up your own AI provider. Please configure your credentials in Settings.",
          missingCredential: credentialCheck.missingCredential,
          provider: credentialCheck.provider,
        });
      }
      
      const systemPrompt = `You are a helpful tutor helping a student understand a practice test question they got wrong.

Question: ${question}
User's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}
Explanation: ${explanation}

Help the student understand why their answer was wrong and why the correct answer is right. Be encouraging and educational. If they ask follow-up questions, provide clear explanations.`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...(history || []),
        { role: "user" as const, content: userMessage }
      ];

      // Use user's selected provider for chat (not course content provider)
      const provider = getUserChatProvider(providerConfig);
      if (!provider) {
        return res.status(402).json({ 
          error: "CHAT_PROVIDER_REQUIRED",
          message: "AI chat requires you to set up your own AI provider.",
        });
      }
      const content = await provider.chat(
        messages.map(m => ({ role: m.role, content: m.content })),
        { maxTokens: 1024 }
      ) || "I couldn't generate a response. Please try again.";
      res.json({ response: content });
    } catch (error) {
      console.error("Error in practice test chat:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  // Create practice test
  app.post("/api/practice-tests", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { testType, title, description, generateNew } = req.body;
      if (!testType || !title) {
        return res.status(400).json({ error: "Test type and title are required" });
      }
      
      const categories = getTestCategories(testType);
      
      // Check if we have enough questions in the bank (unless user wants new questions)
      const bankCount = generateNew ? 0 : await storage.getQuestionBankCount(testType);
      const minQuestionsNeeded = 5; // Use question bank if at least 5 questions available
      const useQuestionBank = bankCount >= minQuestionsNeeded && !generateNew;
      
      const practiceTest = await storage.createPracticeTest({
        userId: req.user.claims.sub,
        testType: testType.toUpperCase(),
        title,
        description: description || null,
        totalQuestions: 0,
        timeLimit: getDefaultTimeLimit(testType),
        categories,
        status: useQuestionBank ? "ready" : "generating",
      });
      
      if (useQuestionBank) {
        // Pull questions from the question bank
        const bankQuestions = await storage.getQuestionBankQuestions(testType, categories, minQuestionsNeeded);
        const questionsToInsert = bankQuestions.map((q: any, index: number) => ({
          testId: practiceTest.id,
          questionIndex: index,
          category: q.category,
          questionType: q.questionType || "multiple_choice",
          passage: q.passage || null,
          question: q.question,
          options: q.options as string[],
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          difficulty: q.difficulty || "medium",
        }));
        
        await storage.createPracticeTestQuestions(questionsToInsert);
        await storage.updatePracticeTestStatus(practiceTest.id, "ready", questionsToInsert.length);
        
        const updatedTest = await storage.getPracticeTest(practiceTest.id);
        res.json(updatedTest);
      } else {
        // Generate questions with AI in the background
        generatePracticeTestQuestions(practiceTest.id, testType, description).catch(console.error);
        res.json(practiceTest);
      }
    } catch (error) {
      console.error("Error creating practice test:", error);
      res.status(500).json({ error: "Failed to create practice test" });
    }
  });

  // Get user's practice tests
  app.get("/api/user/practice-tests", isAuthenticated, async (req: any, res: Response) => {
    try {
      const tests = await storage.getUserPracticeTests(req.user.claims.sub);
      res.json(tests);
    } catch (error) {
      console.error("Error fetching practice tests:", error);
      res.status(500).json({ error: "Failed to fetch practice tests" });
    }
  });

  // Get practice test by ID
  app.get("/api/practice-tests/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const testId = parseInt(req.params.id);
      if (isNaN(testId)) {
        return res.status(400).json({ error: "Invalid test ID" });
      }
      
      const test = await storage.getPracticeTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Practice test not found" });
      }
      
      // Only allow owner to view
      if (test.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      res.json(test);
    } catch (error) {
      console.error("Error fetching practice test:", error);
      res.status(500).json({ error: "Failed to fetch practice test" });
    }
  });

  // Get practice test questions
  app.get("/api/practice-tests/:id/questions", isAuthenticated, async (req: any, res: Response) => {
    try {
      const testId = parseInt(req.params.id);
      if (isNaN(testId)) {
        return res.status(400).json({ error: "Invalid test ID" });
      }
      
      const test = await storage.getPracticeTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Practice test not found" });
      }
      
      if (test.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const questions = await storage.getPracticeTestQuestions(testId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  // Start or resume a test attempt
  app.post("/api/practice-tests/:id/attempt", isAuthenticated, async (req: any, res: Response) => {
    try {
      const testId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const test = await storage.getPracticeTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Practice test not found" });
      }
      
      if (test.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      if (test.status !== "ready") {
        return res.status(400).json({ error: "Test is not ready yet" });
      }
      
      // Check for existing active attempt
      let attempt = await storage.getActiveAttempt(userId, testId);
      
      if (!attempt) {
        // Create new attempt
        attempt = await storage.createPracticeTestAttempt({
          userId,
          testId,
          status: "in_progress",
          answers: {},
          flaggedQuestions: [],
          timeSpent: 0,
        });
      }
      
      res.json(attempt);
    } catch (error) {
      console.error("Error starting attempt:", error);
      res.status(500).json({ error: "Failed to start test attempt" });
    }
  });

  // Update attempt answers (auto-save)
  app.patch("/api/practice-tests/attempts/:attemptId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const { answers, flaggedQuestions, timeSpent } = req.body;
      
      const attempt = await storage.getPracticeTestAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      
      if (attempt.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      if (attempt.status !== "in_progress") {
        return res.status(400).json({ error: "Attempt already completed" });
      }
      
      // Update answers if provided
      if (answers !== undefined) {
        await storage.updateAttemptAnswers(attemptId, answers, flaggedQuestions);
      }
      
      // Update time if provided
      if (timeSpent !== undefined) {
        await storage.updateAttemptTime(attemptId, timeSpent);
      }
      
      const updated = await storage.getPracticeTestAttempt(attemptId);
      res.json(updated);
    } catch (error) {
      console.error("Error updating attempt:", error);
      res.status(500).json({ error: "Failed to update attempt" });
    }
  });

  // Submit test attempt for scoring
  app.post("/api/practice-tests/attempts/:attemptId/submit", isAuthenticated, async (req: any, res: Response) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      
      const attempt = await storage.getPracticeTestAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      
      if (attempt.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      if (attempt.status !== "in_progress") {
        return res.status(400).json({ error: "Attempt already submitted" });
      }
      
      // Get questions and calculate score
      const questions = await storage.getPracticeTestQuestions(attempt.testId);
      const answers = attempt.answers as Record<string, number>;
      
      let totalCorrect = 0;
      const categoryScores: Record<string, { correct: number; total: number }> = {};
      
      for (const question of questions) {
        const category = question.category;
        if (!categoryScores[category]) {
          categoryScores[category] = { correct: 0, total: 0 };
        }
        categoryScores[category].total++;
        
        const userAnswer = answers[question.id.toString()];
        if (userAnswer === question.correctIndex) {
          totalCorrect++;
          categoryScores[category].correct++;
        }
      }
      
      const score = questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0;
      
      // Complete the attempt
      const completedAttempt = await storage.completeAttempt(attemptId, score, categoryScores);
      
      // Generate gap recommendations
      const gapRecommendations = [];
      for (const [category, scores] of Object.entries(categoryScores)) {
        const categoryScore = scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0;
        if (categoryScore < 70) {
          gapRecommendations.push({
            attemptId,
            category,
            gapScore: 100 - categoryScore,
            suggestedTopicTitle: `${category} Deep Dive`,
            suggestedTopicDescription: `Strengthen your understanding of ${category} concepts based on your practice test results.`,
          });
        }
      }
      
      if (gapRecommendations.length > 0) {
        await storage.createTestGapRecommendations(gapRecommendations);
      }
      
      res.json({
        attempt: completedAttempt,
        categoryScores,
        recommendations: gapRecommendations,
      });
    } catch (error) {
      console.error("Error submitting attempt:", error);
      res.status(500).json({ error: "Failed to submit attempt" });
    }
  });

  // Get attempt results
  app.get("/api/practice-tests/attempts/:attemptId/results", isAuthenticated, async (req: any, res: Response) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      
      const attempt = await storage.getPracticeTestAttempt(attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Attempt not found" });
      }
      
      if (attempt.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const test = await storage.getPracticeTest(attempt.testId);
      const questions = await storage.getPracticeTestQuestions(attempt.testId);
      const recommendations = await storage.getTestGapRecommendations(attemptId);
      
      res.json({
        attempt,
        test,
        questions,
        recommendations,
      });
    } catch (error) {
      console.error("Error fetching results:", error);
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  // Get user's completed test attempts
  app.get("/api/user/practice-test-attempts", isAuthenticated, async (req: any, res: Response) => {
    try {
      const attempts = await storage.getUserPracticeTestAttempts(req.user.claims.sub);
      res.json(attempts);
    } catch (error) {
      console.error("Error fetching attempts:", error);
      res.status(500).json({ error: "Failed to fetch attempts" });
    }
  });
}
