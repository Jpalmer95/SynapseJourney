import { db } from "../server/db";
import { achievements, pathways } from "../shared/schema";

const defaultAchievements = [
  // Milestone Achievements
  {
    name: "First Spark",
    description: "Complete your very first lesson",
    icon: "Zap",
    category: "milestone",
    requirement: { type: "lessons", value: 1 },
    xpReward: 5,
    isSecret: false,
    rarity: "common",
  },
  {
    name: "Ignition",
    description: "Complete your first full topic (all levels)",
    icon: "Flame",
    category: "milestone",
    requirement: { type: "topics", value: 1 },
    xpReward: 20,
    isSecret: false,
    rarity: "common",
  },
  {
    name: "100 XP Club",
    description: "Earn your first 100 XP",
    icon: "Star",
    category: "milestone",
    requirement: { type: "xp", value: 100 },
    xpReward: 10,
    isSecret: false,
    rarity: "common",
  },
  {
    name: "1000 XP Master",
    description: "Earn 1,000 XP total",
    icon: "Trophy",
    category: "milestone",
    requirement: { type: "xp", value: 1000 },
    xpReward: 50,
    isSecret: false,
    rarity: "uncommon",
  },
  {
    name: "Knowledge Seeker",
    description: "Complete 10 lessons in total",
    icon: "Book",
    category: "milestone",
    requirement: { type: "lessons", value: 10 },
    xpReward: 15,
    isSecret: false,
    rarity: "common",
  },
  {
    name: "Bookworm",
    description: "Complete 10 lessons in a single day",
    icon: "BookOpen",
    category: "milestone",
    requirement: { type: "daily_lessons", value: 10 },
    xpReward: 25,
    isSecret: false,
    rarity: "uncommon",
  },
  // Streak Achievements
  {
    name: "3-Day Streak",
    description: "Maintain a 3-day learning streak",
    icon: "Flame",
    category: "streak",
    requirement: { type: "streak", value: 3 },
    xpReward: 10,
    isSecret: false,
    rarity: "common",
  },
  {
    name: "7-Day Streak",
    description: "Maintain a 7-day learning streak",
    icon: "Flame",
    category: "streak",
    requirement: { type: "streak", value: 7 },
    xpReward: 25,
    isSecret: false,
    rarity: "uncommon",
  },
  {
    name: "30-Day Streak",
    description: "Maintain a 30-day learning streak",
    icon: "Flame",
    category: "streak",
    requirement: { type: "streak", value: 30 },
    xpReward: 100,
    isSecret: false,
    rarity: "rare",
  },
  {
    name: "Century",
    description: "Maintain a 100-day learning streak",
    icon: "Crown",
    category: "streak",
    requirement: { type: "streak", value: 100 },
    xpReward: 500,
    isSecret: false,
    rarity: "legendary",
  },
  // Rare/Easter Egg Achievements
  {
    name: "Lucky 7",
    description: "Score 100% on 7 quizzes in a row",
    icon: "Sparkles",
    category: "rare",
    requirement: { type: "perfect_streak", value: 7 },
    xpReward: 50,
    isSecret: true,
    rarity: "rare",
  },
  {
    name: "Early Bird",
    description: "Complete a lesson before 7am",
    icon: "Sunrise",
    category: "rare",
    requirement: { type: "time_of_day", value: 7 },
    xpReward: 15,
    isSecret: true,
    rarity: "uncommon",
  },
  {
    name: "Night Owl",
    description: "Complete a lesson after midnight",
    icon: "Moon",
    category: "rare",
    requirement: { type: "time_of_day", value: 0 },
    xpReward: 15,
    isSecret: true,
    rarity: "uncommon",
  },
  {
    name: "Comeback Kid",
    description: "Return after 7+ days away and complete a lesson",
    icon: "RefreshCw",
    category: "rare",
    requirement: { type: "comeback", value: 7 },
    xpReward: 20,
    isSecret: true,
    rarity: "uncommon",
  },
  {
    name: "Renaissance",
    description: "Master topics across 5+ different pathways",
    icon: "Palette",
    category: "rare",
    requirement: { type: "pathways", value: 5 },
    xpReward: 100,
    isSecret: false,
    rarity: "epic",
  },
  // Mastery Achievements
  {
    name: "Generalist",
    description: "Master at least 25 different topics",
    icon: "GraduationCap",
    category: "mastery",
    requirement: { type: "topics", value: 25 },
    xpReward: 200,
    isSecret: false,
    rarity: "epic",
  },
  {
    name: "Polymath",
    description: "Master 50+ topics AND contribute 5+ validated research ideas",
    icon: "Brain",
    category: "mastery",
    requirement: { type: "polymath", value: 1 },
    xpReward: 1000,
    isSecret: false,
    rarity: "legendary",
  },
  // Research Achievements
  {
    name: "Ideator",
    description: "Submit your first novel research idea",
    icon: "Lightbulb",
    category: "research",
    requirement: { type: "research_ideas", value: 1 },
    xpReward: 25,
    isSecret: false,
    rarity: "uncommon",
  },
  {
    name: "Trailblazer",
    description: "Be among the first 10 to complete a newly added topic",
    icon: "Compass",
    category: "research",
    requirement: { type: "trailblazer", value: 1 },
    xpReward: 50,
    isSecret: true,
    rarity: "rare",
  },
  {
    name: "Hypothesis Hunter",
    description: "Have 3 research ideas validated by community votes",
    icon: "Target",
    category: "research",
    requirement: { type: "validated_ideas", value: 3 },
    xpReward: 75,
    isSecret: false,
    rarity: "rare",
  },
];

const defaultPathways = [
  {
    name: "Physics",
    description: "From classical mechanics to quantum theory, explore the fundamental laws that govern our universe.",
    icon: "Atom",
    color: "purple",
    difficulty: "mixed",
    estimatedHours: 50,
    isActive: true,
  },
  {
    name: "Engineering",
    description: "Apply scientific principles to design and build solutions for real-world problems.",
    icon: "Wrench",
    color: "blue",
    difficulty: "mixed",
    estimatedHours: 60,
    isActive: true,
  },
  {
    name: "Astrophysics",
    description: "Journey through the cosmos, from stellar evolution to black holes and the origins of the universe.",
    icon: "Rocket",
    color: "indigo",
    difficulty: "advanced",
    estimatedHours: 40,
    isActive: true,
  },
  {
    name: "Computer Science",
    description: "Master algorithms, data structures, and computational thinking.",
    icon: "Code",
    color: "green",
    difficulty: "mixed",
    estimatedHours: 55,
    isActive: true,
  },
  {
    name: "Artificial Intelligence",
    description: "Explore machine learning, neural networks, and the future of intelligent systems.",
    icon: "Brain",
    color: "pink",
    difficulty: "advanced",
    estimatedHours: 45,
    isActive: true,
  },
  {
    name: "Mathematics",
    description: "Build a strong foundation from algebra through calculus and beyond.",
    icon: "Calculator",
    color: "orange",
    difficulty: "mixed",
    estimatedHours: 65,
    isActive: true,
  },
  {
    name: "Chemistry",
    description: "Understand atomic structure, reactions, and the molecular basis of life.",
    icon: "Flask",
    color: "teal",
    difficulty: "mixed",
    estimatedHours: 40,
    isActive: true,
  },
  {
    name: "Biology",
    description: "From cells to ecosystems, discover the science of living organisms.",
    icon: "Leaf",
    color: "lime",
    difficulty: "mixed",
    estimatedHours: 45,
    isActive: true,
  },
  {
    name: "Music Theory",
    description: "Learn the language of music: scales, chords, harmony, and composition.",
    icon: "Music",
    color: "rose",
    difficulty: "beginner",
    estimatedHours: 30,
    isActive: true,
  },
  {
    name: "Open Source Contributing",
    description: "Learn to contribute to open source projects and collaborate with developers worldwide.",
    icon: "GitBranch",
    color: "gray",
    difficulty: "intermediate",
    estimatedHours: 25,
    isActive: true,
  },
];

async function seed() {
  console.log("Seeding achievements and pathways...");
  
  // Seed achievements
  for (const achievement of defaultAchievements) {
    try {
      await db.insert(achievements).values(achievement).onConflictDoNothing();
      console.log(`Created achievement: ${achievement.name}`);
    } catch (error) {
      console.log(`Achievement ${achievement.name} may already exist, skipping...`);
    }
  }
  
  // Seed pathways
  for (const pathway of defaultPathways) {
    try {
      await db.insert(pathways).values(pathway).onConflictDoNothing();
      console.log(`Created pathway: ${pathway.name}`);
    } catch (error) {
      console.log(`Pathway ${pathway.name} may already exist, skipping...`);
    }
  }
  
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
