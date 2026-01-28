# Synapse - The Open Source Learning Platform

## Overview

Synapse is an open-source learning platform that bridges the gap between passive consumption (doom-scrolling) and active mastery (structured learning). It combines a TikTok-style swipeable feed for discovery with AI-powered deep-dive learning paths and 3D knowledge graph visualization.

The core concept is "nebulous to focused" learning - users can browse knowledge casually through a feed, then dive deep into any topic with AI-generated structured learning roadmaps. The platform emphasizes STEM and open source content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints under `/api/*`
- **Authentication**: Replit OAuth via OpenID Connect with Passport.js
- **Session Management**: PostgreSQL-backed sessions via connect-pg-simple

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod validation schemas
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**:
  - `users`, `sessions` - Authentication (mandatory for Replit Auth)
  - `categories`, `topics`, `knowledgeCards` - Knowledge graph content
  - `topicConnections` - Graph edges connecting related topics
  - `userProgress`, `savedCards` - User learning state
  - `userXp` - User total XP and level tracking
  - `userCategoryPreferences` - Category filter preferences for personalized feed
  - `lessonUnits` - AI-generated lesson content per topic/difficulty
  - `lessonProgress` - User completion tracking per lesson unit
  - `topicMastery` - Tracks unlocked difficulty tiers per user/topic
  - `aiChatSessions`, `aiChatMessages` - AI chat history
  - `userProfiles` - Extended user profiles (age, technical level, experience)
  - `pathways`, `pathwayTopics`, `userPathways` - Curated learning pathways
  - `achievements`, `userAchievements` - Gamification and milestone tracking
  - `monthlyChallenges`, `userChallengeProgress` - Monthly challenge system
  - `userStreaks` - Learning streak tracking
  - `researchIdeas` - User-submitted research ideas
  - `customTopics` - AI-generated custom learning journeys

### Lesson System (AI-Generated Content)
- **Difficulty Levels**: Beginner → Intermediate → Advanced → **Next Gen**
- **Progression Gating**: 70% completion required to unlock next tier
- **Standard Content Structure** (Beginner/Intermediate/Advanced):
  - Concept explanation (2-3 paragraphs)
  - Real-world analogy
  - Worked example (with optional code)
  - Quiz (3 multiple choice questions with explanations)
  - Cross-topic connections (references to mastered topics)
- **Next Gen Content Structure** (Frontier Research):
  - Research context (current state of field)
  - Industry challenge (active problems, current approaches, open questions)
  - Thought exercises (creative prompts with hints and exploration paths)
  - Emerging trends (implications and potential breakthroughs)
  - Creative synthesis challenge (cross-domain thinking prompts)
  - Further resources (papers, tools, communities)
- **Content Generation**: On-demand AI generation, cached in database
- **Next Gen Purpose**: Encourage learners to think like researchers, explore cutting-edge questions, and contribute creative insights to the frontier of knowledge

### XP & Leveling System
- **XP by Difficulty**: Beginner +1, Intermediate +3, Advanced +5, Next Gen +10
- **Quiz Bonus**: +50% bonus XP for quiz score >= 70%
- XP accumulates across all topics into a total user level
- Level progression: Level = floor(sqrt(totalXP / 100)) + 1
- XP displayed in RabbitHole header and Profile page

### Achievements System
- **Categories**: Milestones, Streaks, Easter Eggs, Mastery, Research
- **20 Default Achievements**: First Spark, Ignition, 100XP Club, 1000XP Master, 3/7/30-Day Streaks, Century, Lucky 7, Early Bird, Night Owl, Generalist, Polymath, Ideator, Trailblazer
- **Rarities**: Common, Uncommon, Rare, Epic, Legendary
- Achievements checked automatically on lesson completion and other triggers

### Learning Pathways
- **10 Default Pathways**: Physics, Engineering, Astrophysics, Computer Science, AI, Mathematics, Chemistry, Biology, Music Theory, Open Source Contributing
- Curated groupings of related topics for comprehensive learning
- Progress tracking per pathway with enrollment system

### Custom Topics (Explore Feature)
- Users can search existing topics or create AI-generated custom learning journeys
- AI generates category, topic, and lesson units for any subject
- Status tracking: pending → generating → ready/failed

### User Profiles
- Age range, technical level, prior experience areas
- Hugging Face token option for free AI alternative to GPT-4o
- Test Out setting to skip basic/intermediate courses via quiz

### Streak Tracking
- Daily streak updated on lesson completion
- Longest streak record maintained
- Streak achievements unlock at 3, 7, 30, and 100 days

### AI Integration
- **Provider**: Multi-provider support (OpenAI, HuggingFace, Ollama, OpenRouter)
- **Provider Selection**: Users configure preferred provider in Settings page
- **Features**: 
  - Socratic AI tutor chat with topic context
  - Dynamic learning roadmap generation
  - Image generation capabilities
  - Infographic generation via Gemini API
- **Batch Processing**: Rate-limited batch utilities with retry logic
- **Provider Abstraction**: `server/ai-providers.ts` provides unified interface

### Reward System
- **Infographic Rewards**: Recap cheat sheets auto-generated on completing advanced/nextgen lessons
  - Uses Gemini API for high-quality visual generation
  - Stored in `userInfographics` table with base64 image data
  - Viewable and downloadable from Collection page (/collection)
- **3D Model Milestones**: Special rewards unlock every 10 infographics collected
  - Artistic blend descriptions combine themes from contributing topics
  - Status tracking: pending → generating → ready
  - Stored in `user3DRewards` table
- **Collection Page**: Gallery view at /collection showing all earned rewards

### Key Design Patterns
- **Monorepo Structure**: Client (`client/`), server (`server/`), shared (`shared/`)
- **Path Aliases**: `@/` for client src, `@shared/` for shared code
- **Storage Pattern**: Interface-based storage classes in `server/storage.ts`
- **Replit Integrations**: Modular integration code in `server/replit_integrations/`

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL` environment variable)
- Drizzle Kit for migrations (`npm run db:push`)

### Authentication
- Replit OAuth/OpenID Connect
- Required env vars: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`

### AI Services
- OpenAI API via Replit AI Integrations
- Required env vars: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Key NPM Packages
- `drizzle-orm` / `drizzle-zod` - Database ORM
- `openai` - AI API client
- `passport` / `openid-client` - Authentication
- `framer-motion` - Animations
- `@tanstack/react-query` - Data fetching
- Full shadcn/ui component set via Radix primitives