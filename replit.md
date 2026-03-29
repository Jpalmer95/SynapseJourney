# Synapse - The Open Source Learning Platform

## Overview

Synapse is an open-source learning platform designed to transform passive content consumption into active mastery. It features a TikTok-style feed for content discovery, complemented by AI-powered deep-dive learning paths and a 3D knowledge graph visualization. The platform enables users to transition from casual browsing to structured learning with AI-generated roadmaps, focusing on STEM and open-source content. Synapse aims to encourage a "nebulous to focused" learning approach, making advanced knowledge accessible and engaging.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (March 2026)

- **AI TTS (Text-to-Speech) Upgrade**: Replaced browser-only Web Speech API with server-side TTS. Primary provider is **OpenAI TTS** (`tts-1` model, MP3). Fallback chain: OpenAI TTS → Qwen3-TTS Gradio Space → HF Inference API (facebook/mms-tts-eng) → browser speechSynthesis. Audio cached in `ttsAudioCache` DB table (base64, keyed by unitId+voiceConfigHash). 6 AI voice presets: Aria→shimmer, Nova→nova, Lyra→fable, Echo→echo, Sage→onyx, Orion→alloy. Custom voice cloning: upload audio reference (<5MB) via POST `/api/tts/voice-upload`. Playback uses HTML5 `<audio>` element for server-generated audio. `use-tts.tsx` hook updated for server TTS, iOS AudioContext unlock, Tesla fallback. `tts-button.tsx` redesigned with 3-tab UI (AI Voices, Browser, Clone).
- **Tesla TTS fix**: `shouldTryServer` is set `true` when `getVoices().length === 0`; outer catch broadened to handle synthesis-failed / synthesis-unavailable / audio-hardware / network browser error codes (auto-retries server TTS).
- **iOS TTS fix**: `unlockAudio()` helper creates a silent 1-sample AudioContext buffer source and plays it synchronously within the user gesture, before any `await`, in both `speak()` and `speakSections()`. This allows HTML5 audio playback on iOS without autoplay restriction.
- **TTS Voice Settings Storage**: New columns on `userProfiles`: `ttsVoicePreset`, `ttsReferenceAudio`, `ttsPlaybackSpeed`. New `ttsAudioCache` table with unitId, voiceConfigHash, audioData, audioFormat. API: `GET/PUT /api/tts/settings`, `POST /api/tts/voice-upload`, `POST /api/tts/generate`, `GET /api/tts/presets`, `GET /api/tts/cache-status/:unitId`.
- **Predictive Pre-Generation**: When a lesson unit is loaded, the server asynchronously generates the next unit's content and TTS audio in the background (fire-and-forget). Helper functions `predictivelyGenerateNextUnit()` and `preTTSForUnit()` in `server/routes.ts`.
- **Link Validation & Relevance**: New `server/link-validator.ts` validates each `externalResources` URL after AI generation (HEAD request, 8s timeout). Dead links are removed; if fewer than 2 survive, a retry prompt asks the AI for alternatives. AI content generation prompts updated with `CRITICAL RESOURCE SPECIFICITY RULES` to force topic/domain-specific URLs. Category name is now fetched and passed to `generateLessonContent()`. Background staleness re-validation: content older than 30 days gets links re-checked on next access (`revalidateUnitLinks()`).

## Recent Changes (February 2026)

- **Admin Unlock Bypass**: Admin user (jpkorstad@gmail.com) can now access all difficulty levels without progression requirements. The `isAdmin` flag is passed through lesson endpoints and used both server-side and client-side to bypass lock checks.
- **Batch Content Generation**: Admin can generate content for all beginner/intermediate/advanced levels of a topic in a single API call. Uses `generateBatchLessonContent()` function for cost efficiency. Endpoint: `POST /api/admin/topics/:topicId/generate-batch`. Excludes Next Gen content (different structure). UI controls in topic header area.
- **Unlock Keys System (Full Implementation)**: Users get 3 free keys on signup. Keys unlock all 4 difficulty levels of any topic instantly. Users earn 1 key/day by completing beginner+intermediate+advanced on 3 different topics. Users can also buy keys with Dogecoin (1 DOGE = 1 key) via mydoge.com/JonK - purchase requests require admin approval. Tables: `unlockKeys` (balance + lastKeyEarnedDate), `keyUsageHistory`, `keyEarnHistory` (daily earn tracking), `keyPurchaseRequests` (Dogecoin purchases). `keyUnlocked` field on `topicMastery` bypasses all tier locks. UI shows key balance in topic header, unlock button on locked tabs, daily earn progress bar, and Buy Keys modal with Dogecoin payment link. Admin sees pending purchase approvals in the Buy Keys modal. Atomic SQL updates prevent race conditions on key usage and daily awards.
- **Admin Lesson Regeneration (Fixed)**: Admin-only "Regenerate" button visible when viewing lesson content. Only the admin account (jpkorstad@gmail.com) can see this button. Now immediately generates fresh content instead of just clearing and waiting for next access. Uses neutral context (empty mastered topics) to generate content suitable for all learners. If AI generation fails, original content is preserved and admin can retry. Protected by `isAdminUser()` check. Endpoints: `GET /api/admin/check` and `POST /api/admin/lessons/:unitId/regenerate`.
- **Two-Tier AI Architecture**: Implemented separation between course content (always Gemini 3 Pro at platform's expense) and personal chat/Q&A (user's credentials required). This ensures consistent quality for shared content while protecting the platform from unlimited chat costs.
- **Chat Requires User Credentials**: Users MUST configure their own AI provider (Hugging Face, Ollama, or OpenRouter) to use chat features. No fallback to platform Gemini for chat - this protects the solo developer from exponential costs as the user base grows.
- **Chat Setup Flow**: When users try to chat without credentials, they see a friendly overlay explaining the options and guiding them to settings.
- **Course Content Generation**: `generateCourseContent()` function always uses Gemini 3 Pro for lessons, roadmaps, practice tests, and custom topics - always free for users.
- **User Chat**: `getUserChatProvider()` requires user's own credentials (Hugging Face token, Ollama server, or OpenRouter key). Returns null and shows setup prompt if not configured.
- **Settings UI**: Shows only user-provided options for chat (no Gemini/free option). Info banner explains why credentials are needed. Course content is always free.
- **Placeholder Content Cleanup**: Added startup check `regeneratePlaceholderContent()` to find and clear any placeholder content for regeneration.
- **Fixed AI Content Generation**: Migrated from OpenAI SDK (chat.completions.create) to native @google/genai SDK (generateContent) for Gemini AI Integrations. The Replit AI Integrations only support the generateContent endpoint, not OpenAI-compatible chat.completions.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with shadcn/ui (New York style)
- **Animations**: Framer Motion
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful
- **Authentication**: Replit OAuth via OpenID Connect with Passport.js
- **Session Management**: PostgreSQL-backed sessions

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod validation schemas
- **Key Schemas**: Manages users, sessions, knowledge graph (categories, topics, cards), user progress, AI-generated content (lesson units, chat history), learning pathways, gamification (XP, achievements, streaks), and practice tests.

### AI-Powered Learning System
- **Content Generation**: AI dynamically generates lesson units across difficulty levels (Beginner, Intermediate, Advanced, Next Gen). "Next Gen" content focuses on frontier research and thought exercises.
- **Progression**: Gated difficulty tiers, requiring completion to unlock the next level.
- **Custom Pathways & Topics**: Users can create personalized learning pathways and custom topics, with AI assistance for topic suggestions and content generation.
- **Practice Test System**: Hybrid question sourcing - uses a reusable question bank of 54+ public domain questions by default (no API cost), with AI-generated unique questions as an optional fallback. Supports MCAT, GRE, SAT, LSAT, GMAT, ACT, IQ, and Bar Exam. Features include timed attempts, auto-save, detailed scoring, and gap-based learning recommendations.

### Gamification & Rewards
- **XP & Leveling**: Users earn XP for completing lessons and quizzes, contributing to a total user level.
- **Achievements**: Tracks various milestones, streaks, and mastery, with different rarities.
- **Reward System**: Generates infographic cheat sheets upon lesson completion and unlocks 3D model milestones based on collected infographics, viewable in a "Collection" gallery.

### User Experience & Features
- **Personalized Feeds**: Allows users to create custom feeds based on topic filters, enabling focused learning.
- **User Profiles**: Supports extended user profiles, including technical level and experience, with options for alternative AI providers.
- **Accessibility**: Integrated Text-to-Speech (TTS) for lesson content.
- **Onboarding**: A guided 3-step onboarding process for new users, including category and pathway selection.
- **Default Content Auto-Enrollment**: New users are automatically enrolled in all default pathways and categories, with options for customization later.
- **Navigation**: Consistent `AppLayout` with desktop SideNav, mobile BottomNav, and user profile menu.
- **Mobile Responsiveness**: Designed with responsive padding and content handling to ensure usability across devices.

### Key Design Patterns
- **Monorepo**: Client, server, and shared code are organized within a single repository.
- **Path Aliases**: Simplifies module imports.
- **Storage Pattern**: Interface-based storage classes for data persistence.
- **Modular Replit Integrations**: Dedicated structure for Replit-specific functionalities.

## External Dependencies

### Database
- PostgreSQL

### Authentication
- Replit OAuth/OpenID Connect

### AI Services
- **Default Model**: Gemini 3 Pro (gemini-3-pro-preview) via Replit AI Integrations
- Multi-provider support for Gemini, OpenAI, HuggingFace, Ollama, OpenRouter
- Gemini API (for infographic generation)

### Key NPM Packages
- `drizzle-orm`, `drizzle-zod`
- `openai`
- `passport`, `openid-client`
- `framer-motion`
- `@tanstack/react-query`
- shadcn/ui components (based on Radix primitives)