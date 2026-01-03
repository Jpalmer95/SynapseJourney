# Synapse Design Guidelines

## Design Approach
**Reference-Based:** Drawing inspiration from Linear's precision, Notion's knowledge organization, and Duolingo's learning engagement, combined with TikTok's immersive feed mechanics. The aesthetic prioritizes smooth interactions, spatial clarity, and progressive disclosure of complexity.

## Core Design Principles
1. **Immersive Simplicity** - Full-screen experiences with minimal chrome
2. **Fluid Transitions** - Smooth state changes between feed, deep-dive, and 3D views
3. **Spatial Hierarchy** - Clear visual relationships between concepts and knowledge layers
4. **Contextual Density** - Simple feed cards, complex deep-dive interfaces

## Typography System

**Primary Font:** Inter (Google Fonts) - Clean, modern, excellent screen readability
**Accent Font:** JetBrains Mono (Google Fonts) - For code snippets and technical content

### Type Scale
- Hero/Display: text-5xl to text-7xl, font-bold (48-72px)
- Card Titles: text-2xl to text-3xl, font-semibold (24-30px)
- Body: text-base to text-lg, font-normal (16-18px)
- Metadata: text-sm, font-medium (14px)
- Captions: text-xs, font-normal (12px)

### Hierarchy Rules
- Feed cards: Large, bold headlines with minimal supporting text
- AI chat: Medium-weight conversational text with clear speaker differentiation
- 3D visualization labels: Small, uppercase, tracked spacing (tracking-wide)
- Code blocks: Monospace, syntax-highlighted, text-sm

## Layout System

**Spacing Units:** Consistent use of Tailwind units: 2, 4, 6, 8, 12, 16, 24, 32
- Tight spacing: space-y-2 (8px) for related elements
- Standard: space-y-4 (16px) for component sections
- Generous: space-y-8 (32px) for major section breaks
- Extra generous: space-y-16 (64px) for view transitions

**Container Strategy:**
- Feed cards: w-full h-screen (immersive, one card at a time)
- Chat interface: max-w-4xl mx-auto (optimal conversation width)
- Dashboard: max-w-7xl mx-auto (wide layout for data visualization)
- 3D visualization: w-full h-full (full viewport experience)

## Component Architecture

### 1. Nebula Feed (Home)
**Layout:** Full-screen vertical cards, swipeable
- Card container: h-screen w-full with backdrop blur
- Content area: max-w-2xl mx-auto px-6 py-12
- Header: Minimal top bar with user avatar (top-4 right-4)
- Card content: Centered vertically, flex flex-col justify-center
- Actions: Fixed bottom bar (bottom-8) with Dive, Save, Skip buttons
- Progress indicators: Subtle dots or line (top-6 left-6)

**Card Types:**
- Text cards: Large headline (text-4xl), short description (text-lg), category tag
- Visual cards: Full-bleed image/video with gradient overlay, text overlaid
- Code cards: Syntax-highlighted snippet with explanation
- Quote cards: Large pull-quote typography with attribution

### 2. Rabbit Hole (Deep Dive)
**Layout:** Slide-in panel covering 90% of screen
- Header: Topic title (text-3xl) with back button, progress bar
- Main area: Scrollable content with clear sections
- Sidebar: Sticky concept map (hidden on mobile, w-64 on desktop)
- Learning path: Vertical timeline with expandable levels
- AI helper: Floating button (bottom-right) expanding to chat panel

**Section Structure:**
- Level cards: Rounded containers (rounded-xl) with level badges
- Content blocks: Generous padding (p-8), clear separators (border-t)
- Code examples: Full-width with copy button
- Interactive elements: Quizzes, drag-and-drop with immediate feedback

### 3. AI Companion Chat
**Layout:** Overlay panel or dedicated view
- Messages: Alternating alignment (user right, AI left)
- User messages: Compact, rounded-2xl, px-4 py-2
- AI messages: Wider, with avatar, supporting rich content
- Input: Fixed bottom with elevated shadow, rounded-full
- Suggestions: Horizontal scrollable chips above input

**Rich Content Support:**
- LaTeX rendering: Inline equations, display math blocks
- Code snippets: Syntax highlighted with language badge
- Inline definitions: Dotted underline, tooltip on hover
- Images/diagrams: Full-width within message bounds

### 4. 3D Knowledge Map
**Layout:** Full-screen immersive canvas
- Controls: Floating panel (top-right) with view options
- Legend: Bottom-left, semi-transparent panel
- Info cards: Hover-triggered tooltips near nodes
- Timeline: Bottom slider showing learning progression
- Stats overlay: Top-left showing total concepts, connections

**Visual Elements:**
- Nodes: Sphere representations with scale based on mastery
- Connections: Lines with varying opacity based on strength
- Clusters: Grouped by domain with subtle boundary highlighting
- Active path: Highlighted trail showing recent learning journey

### 5. Navigation & Chrome
**Primary Nav:** Minimal side rail on desktop (w-16), bottom bar on mobile
- Icons only with labels on hover
- States: Feed, Map, Profile, Saved
- Unobtrusive: Fades during immersive experiences

**Profile Dashboard:**
- Hero stats: Large numbers (text-6xl) with labels
- Learning streak: Calendar heatmap visualization
- Recent topics: Horizontal card carousel
- Achievements: Badge grid with unlock states

## Animation Guidelines

**Micro-interactions:**
- Card swipes: Transform with slight rotation (-2deg to 2deg)
- Button press: Scale down (scale-95) with subtle lift shadow
- Modal entry: Slide up from bottom with fade-in backdrop
- 3D rotation: Smooth easing (cubic-bezier)

**Transitions:**
- Feed to deep-dive: Expanding card animation (300ms)
- Chat appearance: Slide from right (250ms)
- Tab switches: Crossfade (200ms)
- Loading states: Skeleton screens, no spinners

**Performance:**
- Limit simultaneous animations to 3 elements
- Use transform and opacity for GPU acceleration
- Reduce motion for accessibility preferences

## Responsive Strategy

**Mobile-First Breakpoints:**
- Base (mobile): Single column, full-screen cards
- md (768px): Side-by-side panels for Rabbit Hole
- lg (1024px): Persistent sidebar, wider content
- xl (1280px): Maximum layout width, multi-column grids

**Touch Optimization:**
- Large tap targets: min-h-12 (48px)
- Swipe gestures: Full card height
- Pull to refresh: Top-of-feed gesture
- Long-press: Context menus and quick actions

## Accessibility

**Semantic Structure:**
- Proper heading hierarchy (h1 → h6)
- ARIA labels for icon-only buttons
- Focus indicators: 2px ring with offset
- Keyboard navigation: Tab order follows visual flow

**Contrast & Readability:**
- Text contrast: Minimum WCAG AA (4.5:1)
- Interactive elements: Clear hover/focus states
- Error states: Icon + text, not just visual treatment
- Success feedback: Toast notifications with action undo

## Images

**Hero Image:** No traditional hero - the app opens directly to the immersive feed experience

**Card Images:** 
- Feed cards: Full-bleed background images with gradient overlays (from transparent to semi-opaque) for text readability
- Topic cards: Accent images (aspect-16/9) representing the subject matter
- Profile: Circular avatar images (w-12 h-12 for nav, w-24 h-24 for profile)
- 3D map: No static images - rendered canvas visualization

**Image Treatment:**
- Buttons on images: backdrop-blur-md with semi-transparent backgrounds
- Loading: Skeleton placeholders matching aspect ratio
- Error states: Subtle icon placeholder

This design creates a cohesive, modern learning platform that balances engagement with functionality, prioritizing smooth interactions and clear information hierarchy throughout the user journey.