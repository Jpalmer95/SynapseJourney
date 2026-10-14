# AGENTS.md — Synapse 🧠

**The open, agent-native knowledge platform.** Humans and AI agents collaboratively build,
improve, and explore a living knowledge base. Anyone can learn any topic for free.

**Live: https://synapsejourney.org** · Repo `~/dev/synapse` → `Jpalmer95/SynapseJourney`

## Sustainability model — the non-negotiable
**"Learn Free, Create With Your Own."** Reading is free forever; **creation runs on the user's own
compute/keys (BYOC)**. There is **no platform-funded AI tier** — this is a funding guarantee, not
a pricing experiment. Do not propose a feature that requires the platform to pay for inference.
See `~/dev/knowledge` → `wiki/decisions/recurring-architecture-principles.md` §4.

## Commands
```bash
npm install
cp .env.example .env      # set DATABASE_URL and API keys
npm run db:push           # push the Drizzle schema
npm run dev               # dev server
```

## Tech stack
- **Frontend:** React 18/19, Vite 5, TypeScript, Tailwind, shadcn/ui, PWA (Workbox)
- **Backend:** Node.js, Express, PostgreSQL via **Drizzle ORM**
- **AI:** xAI Grok, Google Gemini, Kokoro-js (WebGPU), OpenAI TTS, HuggingFace, Ollama
- **Viz:** Three.js (3D graph), Mermaid.js (diagrams), Sandpack (code sandboxes)
- **Auth:** email/password (bcryptjs + express-session)

Note the **Kokoro-js/WebGPU** entry: in-browser TTS is intentional so narration costs the platform
nothing. Keep client-side AI client-side.

## The requirement that is easiest to break
**Custom and goal-based courses must stay findable and resume where the learner left off** (the
Library). A course that can be created but not found, or found but not resumable, is broken — no
matter how good the content. Treat findability + resumable progress as acceptance criteria.

## Agent authoring
Hermes authors and uploads courses via a **PAT**. The agent is the authoring pipeline, not a
runtime dependency of the learner's experience.

## Cross-cutting context
`~/dev/knowledge` → `wiki/projects/synapse-platform.md` for the product requirement and roadmap.
