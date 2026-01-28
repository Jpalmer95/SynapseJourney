import { storage } from "./storage";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

export interface InfographicPrompt {
  topicTitle: string;
  topicDescription: string;
  difficulty: string;
  keyConceptsSummary: string;
}

export async function generateInfographicPrompt(
  topicTitle: string, 
  topicDescription: string,
  difficulty: string,
  lessonContent: any
): Promise<string> {
  const keyConcepts = lessonContent?.concept?.substring(0, 500) || topicDescription;
  
  return `Create a beautiful, educational infographic recap cheat sheet for the topic "${topicTitle}".

Style: Clean, modern educational infographic with a dark theme (deep purple/blue gradient background). 
Format: A visual summary/recap that a student would want to save and reference.

Content to visualize:
- Topic: ${topicTitle}
- Level: ${difficulty}
- Key concepts: ${keyConcepts}

Requirements:
1. Include the topic title prominently at the top
2. Use icons, diagrams, and visual metaphors to explain concepts
3. Include 3-5 key takeaways or facts in visually distinct boxes
4. Add a simple formula or key relationship if applicable
5. Use a color scheme that's easy on the eyes (blues, purples, teals)
6. Make text readable and well-organized
7. Include a "Quick Reference" or "Remember" section at the bottom

The infographic should be something a learner would be proud to collect and use for quick review.`;
}

export async function generateInfographicWithGemini(prompt: string): Promise<{ imageBase64: string; mimeType: string } | null> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not configured for infographic generation");
    return null;
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return {
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "image/png"
        };
      }
    }

    console.log("No image in Gemini response");
    return null;
  } catch (error) {
    console.error("Error generating infographic with Gemini:", error);
    return null;
  }
}

export async function generateAndStoreInfographic(
  userId: string,
  topicId: number,
  topicTitle: string,
  topicDescription: string,
  difficulty: string,
  lessonContent: any
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const existing = await storage.getUserInfographicByTopic(userId, topicId);
    if (existing) {
      return { success: true, imageUrl: existing.imageUrl };
    }

    const prompt = await generateInfographicPrompt(topicTitle, topicDescription, difficulty, lessonContent);
    const result = await generateInfographicWithGemini(prompt);
    
    if (!result) {
      return { success: false, error: "Failed to generate infographic" };
    }

    const imageUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
    
    await storage.createUserInfographic({
      userId,
      topicId,
      topicTitle,
      imageUrl,
      prompt,
    });

    const count = await storage.countUserInfographics(userId);
    if (count > 0 && count % 10 === 0) {
      await check3DRewardMilestone(userId);
    }

    return { success: true, imageUrl };
  } catch (error) {
    console.error("Error in generateAndStoreInfographic:", error);
    return { success: false, error: "An error occurred while generating the infographic" };
  }
}

async function check3DRewardMilestone(userId: string): Promise<void> {
  try {
    const count = await storage.countUserInfographics(userId);
    const rewards = await storage.getUser3DRewards(userId);
    const existingRewardCount = rewards.length;
    
    const milestones = Math.floor(count / 10);
    
    if (milestones > existingRewardCount) {
      const infographics = await storage.getUserInfographics(userId);
      const latestTen = infographics.slice(0, 10);
      const topicIds = latestTen.map(i => i.topicId);
      const topicTitles = latestTen.map(i => i.topicTitle);
      
      const artDescription = `A stunning 3D sculpture representing the fusion of knowledge from: ${topicTitles.join(", ")}. 
The sculpture should blend visual elements and symbols from each topic into a cohesive, abstract artwork that represents intellectual growth and cross-domain understanding. 
Style: Polished metallic with glowing energy veins, floating in space with subtle particle effects.`;

      await storage.createUser3DReward({
        userId,
        topicIds,
        artDescription,
        status: "pending",
      });
    }
  } catch (error) {
    console.error("Error checking 3D reward milestone:", error);
  }
}

export async function getFallbackInfographic(topicTitle: string): Promise<string> {
  const colors = ["#667eea", "#764ba2", "#f093fb", "#f5576c", "#4facfe", "#00f2fe"];
  const randomColor1 = colors[Math.floor(Math.random() * colors.length)];
  const randomColor2 = colors[Math.floor(Math.random() * colors.length)];
  
  const svg = `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${randomColor1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${randomColor2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <text x="400" y="80" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="36" font-weight="bold">
        ${topicTitle}
      </text>
      <text x="400" y="130" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="Arial, sans-serif" font-size="18">
        Recap Cheat Sheet
      </text>
      <rect x="50" y="170" width="700" height="380" rx="20" fill="rgba(255,255,255,0.15)"/>
      <text x="400" y="360" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24">
        Infographic Generation In Progress...
      </text>
      <text x="400" y="400" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Arial, sans-serif" font-size="16">
        Your custom recap will be ready soon!
      </text>
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
