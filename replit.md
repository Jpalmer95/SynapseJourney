# Synapse - The Open Source Learning Platform

## Overview

Synapse is an open-source learning platform designed to transform passive content consumption into active mastery. It features a TikTok-style feed for content discovery, complemented by AI-powered deep-dive learning paths and a 3D knowledge graph visualization. The platform enables users to transition from casual browsing to structured learning with AI-generated roadmaps, focusing on STEM and open-source content. Synapse aims to encourage a "nebulous to focused" learning approach, making advanced knowledge accessible and engaging.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Practice Test System**: AI generates standardized test questions (e.g., MCAT, GRE, SAT) with features for timed attempts, scoring, detailed results, and gap-based learning recommendations.

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
- OpenAI API (via Replit AI Integrations)
- Multi-provider support for OpenAI, HuggingFace, Ollama, OpenRouter
- Gemini API (for infographic generation)

### Key NPM Packages
- `drizzle-orm`, `drizzle-zod`
- `openai`
- `passport`, `openid-client`
- `framer-motion`
- `@tanstack/react-query`
- shadcn/ui components (based on Radix primitives)