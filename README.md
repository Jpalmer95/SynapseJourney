# SynapseJourney 🧠 

SynapseJourney is a production-ready, open-source educational platform designed to radically enhance human cross-topic learning, curiosity, and accessibility to high-quality information. 

By utilizing dynamic syllabus generation, AI-powered spaced repetition systems (SRS), real-time interactive sandboxing, and multimodal learning tools (like WebGPU TTS and Mermaid.js), SynapseJourney creates personalized, dynamic pathways for any topic in the world.

## 🚀 Features (Current)
* **Dynamic AI Syllabus Generation:** The platform no longer restricts course pathways. It auto-generates variable amounts of curriculum content and structures depending on the depth and complexity of the subject queried.
* **Kokoro82M WebGPU TTS Pipelining:** Features a bespoke gapless text-to-speech audio pipelining architecture. Next-sentence audio is pre-synthesized natively on the user's GPU while the current sentence is playing, leading to flawlessly smooth audio lessons.
* **Spaced Repetition System (SRS):** Employs an SM-2 inspired spaced repetition algorithm mapping to a backend database of memory flashcards. Integrated with a Daily Review widget to drill critical curriculum points continuously and enhance true retention.
* **Mermaid.js Concept Viz:** Bypasses basic text constraints by securely rendering Mermaid.js graphs and flowcharts dynamically provided by the AI tutor mapping out structural learning concepts.
* **Interactive Code Sandboxes (Sandpack):** Includes live, in-browser React and Vanilla JS code editors for programming/math examples, empowering users to immediately test code snippets while learning.
* **Curated Truth Backlinks:** The AI generation strictly includes verifiable backlinks to resources, Grokipedia, and YouTube, passing all URLs through an SSRF-validator security filter.
* **Pseudo-3D Knowledge Exploration Graph:** A stunning drag-and-drop, zoomable node graph charting a user's knowledge pathways, connections across disparate disciplines, and tracked mastery levels over time.

## 🗺️ Roadmap & Future Vision
SynapseJourney is evolving. Here are incredibly powerful mechanics and ideas we plan to implement to exponentially scale human serendipity and accessible learning:

1. **Cross-Topic Synthesis Quests (The Polymath Protocol)**
   * *Concept:* Once a user achieves mastery in two disparate topics (e.g., "Quantum Mechanics" and "Music Theory"), the system dynamically generates a "Synthesis Quest" forcing the user to draw on constraints from *both* logic sets to solve a bespoke problem, forging deep neural connections across disciplines.

2. **Global Curiosity Feed & Social P2P Mentorship**
   * *Concept:* A collaborative dashboard where users' most profound "Aha!" moments and high-value AI chat questions are anonymized and surfaced. Users can seamlessly branch their own curriculum off another user's public learning pathway.

3. **Audio-First "Podcast" Mode (Endless Audio Curriculum)**
   * *Concept:* Combine the existing gapless WebGPU TTS pipeline with conversational LLM generation to synthesize custom, on-the-fly "Podcast Episodes." The AI simulates two hosts dynamically discussing the user's daily due SRS topics, allowing for hands-free learning during commutes or chores.

4. **Micro-credentialing & Crypto Web3 Verification**
   * *Concept:* Upon mastering complex pathways, users receive verifiable blockchain credentials alongside their Pioneer Nova Coins. By integrating with the Lightning Network and Dogecoin, expert users can stake micro-bounties for human tutoring on 'Unsolved Roadblocks' in the NextGen tier.

5. **Feynman Technique AI "Student" Avatar**
   * *Concept:* Instead of the AI acting strictly as a tutor, the AI occasionally flips roles to simulate a beginner student. The user is challenged to teach and explain a concept they supposedly "Mastered" to the AI. If the AI detects gaps in the user's explanation, it dynamically generates an intervention lesson to patch the hole.

## Getting Started

### Local Deployment
Ensure you've installed all project dependencies utilizing \`npm install\`.
You will need to supply the application with connection strings to your PostgreSQL database. Make sure to set your \`DATABASE_URL\` environmental variable.

To spin up the database schemas locally, perform the database push:
\`\`\`bash
npm run db:push
\`\`\`

To start the dev server:
\`\`\`bash
npm run dev
\`\`\`

### Dependencies
This stack utilizes Node.js, Express, React 18, Vite, PostgreSQL (Drizzle ORM), shadcn/ui, Kokoro-js (WebGPU), and Sandpack. It also integrates an LLM API context wrapper for dynamic course generation.

## License
Provided under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for more information.
