/**
 * Role, Industry & Classical Mastery Roadmap Architect + Dynamic Timeline Engine
 *
 * Allows any learner (or external agent via MCP) to enter a target role, frontier
 * industry, or classical scientific discipline — e.g.:
 *   - "Frontier XR Chip Engineer"
 *   - "Autonomous Robotics Control Architect"
 *   - "Classical Hard Sciences: Physics & Electrodynamics"
 *
 * And curates a complete multi-course building-block roadmap:
 *   1. Reuses canonical reviewed catalog courses for foundations (Linear Algebra,
 *      Electromagnetism, Optics & Light, Neural Networks, etc.)
 *   2. Synthesizes specialized domain/role building-block courses with 4-stage
 *      Linear Spine outlines (Stage 1 Intro Course -> Stage 4 Frontier SOTA)
 *   3. Wires explicit prerequisite DAG edges + Pareto Impact Scores (1-100)
 *   4. Computes a personalized timeline that discounts hours for prior/scattered
 *      knowledge in `user_knowledge_ledger` and adapts live to daily study time
 *      and learning speed.
 */

import type { IStorage } from "./storage";
import type { Topic, Pathway } from "@shared/schema";
import { computeConceptOverlap, getPriorKnowledgeForTopic } from "./knowledge-ledger";
import { generateByokOrPool, validateByokCredentials, type ProviderConfig } from "./ai-providers";
import { indexTopicToFlywheel } from "./embeddings";

export type TrackType = "role_career" | "industry_frontier" | "classical_science";
export type ImpactTier = "foundation" | "core" | "high_impact" | "frontier";

export interface RoadmapBlockSpec {
  /** Existing topicId if reusing a catalog course, or omit to create/match by title */
  existingTopicId?: number | null;
  title: string;
  description: string;
  phaseLabel: string;
  impactTier: ImpactTier;
  impactScore: number; // 1-100
  estimatedHours: number;
  isRequired?: boolean;
  whyItMatters: string;
  /** Titles or 0-based indices of prerequisite blocks in this roadmap */
  prerequisiteIndices?: number[];
  /** Optional 4-stage linear spine units when creating a new specialized topic */
  units?: {
    title: string;
    outline: string;
    difficulty: "beginner" | "intermediate" | "advanced" | "nextgen";
    tierLabel?: string;
  }[];
}

export interface RoadmapArchitectInput {
  targetGoal: string;
  trackType?: TrackType;
  priorBackground?: string;
  dailyMinutes?: number;
  userConfig?: ProviderConfig;
  customBlocks?: RoadmapBlockSpec[];
}

export interface PathwayTimelineNode {
  topicId: number;
  title: string;
  description: string;
  order: number;
  phaseLabel: string;
  impactTier: ImpactTier;
  impactScore: number;
  isRequired: boolean;
  whyItMatters: string;
  prerequisiteTopicIds: number[];
  grossHours: number;
  priorMasteryPct: number;
  priorConceptsCount: number;
  hoursSaved: number;
  netHours: number;
  cumulativeHoursSequential: number;
  estimatedWeekSequential: number;
  unitCount: number;
  status: "mastered" | "in_progress" | "ready" | "locked";
}

export interface PathwayTimelineReport {
  pathway: Pathway;
  dailyMinutes: number;
  paceMode: "fast_track" | "balanced" | "rigorous";
  paceMultiplier: number;
  grossTotalHours: number;
  priorSavedHours: number;
  netBaseHours: number;
  adjustedRemainingHours: number;
  estimatedDays: number;
  estimatedWeeks: number;
  projectedCompletionDate: string;
  nodesSequential: PathwayTimelineNode[];
  nodesHighImpactFirst: PathwayTimelineNode[];
}

/**
 * Curated domain templates + intelligent decomposer so even a brand-new user
 * without a BYOC key gets an extraordinary multi-phase roadmap for roles like
 * "Frontier XR Chip Engineer", while BYOC / Hermes MCP can customize anything.
 */
function buildDeterministicBlocks(
  targetGoal: string,
  trackType: TrackType,
  catalogTopics: Topic[],
): {
  pathwayName: string;
  pathwayDescription: string;
  icon: string;
  color: string;
  blocks: RoadmapBlockSpec[];
  capstoneBottleneck: string;
} {
  const q = targetGoal.toLowerCase();
  const findCatalog = (...keywords: string[]): Topic | undefined => {
    for (const kw of keywords) {
      const exact = catalogTopics.find((t) => t.title.toLowerCase() === kw.toLowerCase());
      if (exact) return exact;
    }
    for (const kw of keywords) {
      const partial = catalogTopics.find((t) =>
        `${t.title} ${t.description}`.toLowerCase().includes(kw.toLowerCase()),
      );
      if (partial) return partial;
    }
    return undefined;
  };

  // Special high-precision blueprint for XR / AR / VR / Silicon / Chip / Hardware roles
  const isXrOrSilicon =
    (q.includes("xr") || q.includes("ar") || q.includes("vr") || q.includes("spatial") || q.includes("optics")) &&
    (q.includes("chip") || q.includes("silicon") || q.includes("asic") || q.includes("hardware") || q.includes("engineer") || q.includes("architect"));

  if (isXrOrSilicon) {
    const linAlg = findCatalog("Linear Algebra");
    const em = findCatalog("Electromagnetism");
    const optics = findCatalog("Optics & Light", "Optics");
    const algos = findCatalog("Algorithms", "Data Structures");
    const nn = findCatalog("Neural Networks", "Machine Learning");

    const blocks: RoadmapBlockSpec[] = [
      {
        existingTopicId: linAlg?.id ?? null,
        title: linAlg?.title || "Linear Algebra",
        description:
          linAlg?.description ||
          "Vector spaces, matrix decompositions, quaternions, and 3D projective geometry transforms.",
        phaseLabel: "Phase 1: Mathematical & Physical Underlayment",
        impactTier: "foundation",
        impactScore: 88,
        estimatedHours: 10,
        isRequired: true,
        whyItMatters:
          "Every 6DoF pose transform, camera projection matrix, and neural accelerator tensor operation runs on linear algebra.",
        prerequisiteIndices: [],
      },
      {
        existingTopicId: em?.id ?? null,
        title: em?.title || "Electromagnetism",
        description:
          em?.description ||
          "Maxwell's equations, transmission lines, high-speed interconnect signal integrity, and RF/EMI constraints.",
        phaseLabel: "Phase 1: Mathematical & Physical Underlayment",
        impactTier: "foundation",
        impactScore: 82,
        estimatedHours: 10,
        isRequired: true,
        whyItMatters:
          "Governs on-die parasitic capacitance, MIPI/UCIe high-speed links, and thermal/EMI limits in wearable XR frames.",
        prerequisiteIndices: [0],
      },
      {
        existingTopicId: optics?.id ?? null,
        title: optics?.title || "Optics & Light",
        description:
          optics?.description ||
          "Wave optics, diffraction gratings, polarization, and photonic waveguide propagation.",
        phaseLabel: "Phase 1: Mathematical & Physical Underlayment",
        impactTier: "foundation",
        impactScore: 86,
        estimatedHours: 9,
        isRequired: true,
        whyItMatters:
          "XR silicon must co-design display engines with diffractive waveguides, pancake optics, and eye-tracking IR sensors.",
        prerequisiteIndices: [1],
      },
      {
        existingTopicId: algos?.id ?? null,
        title: algos?.title || "Algorithms",
        description:
          algos?.description ||
          "Graph optimization, fixed-point numerical methods, and real-time scheduling under hard latency deadlines.",
        phaseLabel: "Phase 2: Compute & Neural Systems Core",
        impactTier: "core",
        impactScore: 85,
        estimatedHours: 9,
        isRequired: true,
        whyItMatters:
          "Hardware accelerators only win when paired with cache-aware, fixed-point algorithmic dataflows.",
        prerequisiteIndices: [0],
      },
      {
        existingTopicId: nn?.id ?? null,
        title: nn?.title || "Neural Networks",
        description:
          nn?.description ||
          "Convolutional, transformer, and state-space architectures, quantization (INT4/INT8/FP8), and sparsity.",
        phaseLabel: "Phase 2: Compute & Neural Systems Core",
        impactTier: "core",
        impactScore: 90,
        estimatedHours: 11,
        isRequired: true,
        whyItMatters:
          "Modern XR co-processors dedicate >50% of die area to quantized on-device vision, hand-tracking, and scene understanding.",
        prerequisiteIndices: [0, 3],
      },
      {
        title: "Low-Power VLSI, RTL & Mixed-Signal SoC Architecture",
        description:
          "CMOS power-performance-area (PPA), SystemVerilog RTL pipelines, clock/power gating, DVFS, and memory hierarchy for sub-2W wearable silicon.",
        phaseLabel: "Phase 3: Highest-Impact XR Silicon Building Blocks",
        impactTier: "high_impact",
        impactScore: 98,
        estimatedHours: 14,
        isRequired: true,
        whyItMatters:
          "Core craft of an XR chip engineer: hitting strict milliwatt power budgets while sustaining gigapixel/s sensor throughput.",
        prerequisiteIndices: [1, 3],
        units: [
          {
            title: "Intro Course: Wearable SoC PPA Envelope & Thermal Limits",
            outline: "Why XR glasses cap total system power under 1.5–3W; dynamic vs leakage power, C*V^2*f, and dark silicon trade-offs.",
            difficulty: "beginner",
            tierLabel: "Intro Course",
          },
          {
            title: "RTL Datapath Pipelining, Clock Gating & Multi-Vt Synthesis",
            outline: "Designing hazard-free SystemVerilog datapaths, fine-grained clock gating, and retention flip-flops.",
            difficulty: "intermediate",
            tierLabel: "Core Mechanics",
          },
          {
            title: "On-Chip SRAM, Scratchpad Dataflow & NoC Interconnects",
            outline: "Minimizing off-chip LPDDR/HBM energy (pJ/bit) via tiled SRAM banking, DMA engines, and AXI/NoC fabrics.",
            difficulty: "intermediate",
            tierLabel: "Core Mechanics",
          },
          {
            title: "Mixed-Signal Sensor Interfaces (MIPI CSI-2, ADC & ISP Front-Ends)",
            outline: "Ingesting multi-camera global-shutter + IMU streams with sub-millisecond line-buffer latency.",
            difficulty: "advanced",
            tierLabel: "Advanced Mastery",
          },
          {
            title: "3D IC Packaging, Chiplets (UCIe) & Near-Sensor Compute",
            outline: "Stacking CMOS image sensors with logic dies via hybrid Cu-Cu bonding to eliminate I/O energy bottlenecks.",
            difficulty: "nextgen",
            tierLabel: "Frontier & SOTA",
          },
        ],
      },
      {
        title: "Spatial Compute Accelerators: On-Chip SLAM, VIO & Systolic NPUs",
        description:
          "Hardware acceleration for Visual-Inertial Odometry (VIO), feature extraction, stereo depth, and quantized neural inference at <5ms latency.",
        phaseLabel: "Phase 3: Highest-Impact XR Silicon Building Blocks",
        impactTier: "high_impact",
        impactScore: 99,
        estimatedHours: 14,
        isRequired: true,
        whyItMatters:
          "The highest-leverage differentiator in frontier XR chips (Apple R1, Snapdragon XR2, Meta custom silicon) is deterministic real-time spatial perception.",
        prerequisiteIndices: [4, 5],
        units: [
          {
            title: "Intro Course: The 10ms Motion-to-Photon Budget & Perception Pipeline",
            outline: "End-to-end breakdown from IMU/camera capture to pose estimation, eye tracking, and frame warp.",
            difficulty: "beginner",
            tierLabel: "Intro Course",
          },
          {
            title: "Hardware Feature Detection, Optical Flow & Stereo Matching Cores",
            outline: "Line-buffered FAST/ORB feature extractors, pyramid Lucas-Kanade optical flow, and census-transform stereo engines.",
            difficulty: "intermediate",
            tierLabel: "Core Mechanics",
          },
          {
            title: "Visual-Inertial Odometry (VIO) & Factor-Graph Solver Hardware",
            outline: "Fixed-point Extended Kalman Filter (EKF) and sparse Cholesky/QR matrix solvers for 1kHz IMU + 60Hz camera fusion.",
            difficulty: "advanced",
            tierLabel: "Advanced Mastery",
          },
          {
            title: "Systolic Array NPUs, INT4/FP8 Quantization & Sparsity Engines",
            outline: "Dataflow architectures (weight-stationary vs output-stationary) for real-time hand tracking and Gaussian splat/NeRF decoding.",
            difficulty: "advanced",
            tierLabel: "Advanced Mastery",
          },
          {
            title: "Event-Based Neuromorphic Vision Sensors & In-Memory Compute",
            outline: "Microsecond-latency dynamic vision sensors (DVS) paired with analog/SRAM compute-in-memory for ultra-low-power eye tracking.",
            difficulty: "nextgen",
            tierLabel: "Frontier & SOTA",
          },
        ],
      },
      {
        title: "XR Display Engines, Late-Latching Reprojection & Waveguide Co-Design",
        description:
          "Async timewarp/spacewarp hardware, foveated rendering pipelines, Micro-OLED/Micro-LED backplanes, and holographic waveguide compensation.",
        phaseLabel: "Phase 4: Frontier XR Display & Photonic Co-Design",
        impactTier: "frontier",
        impactScore: 95,
        estimatedHours: 12,
        isRequired: true,
        whyItMatters:
          "Bridges silicon architecture directly to human visual perception, eliminating judder, vergence-accommodation conflict, and display power drain.",
        prerequisiteIndices: [2, 6],
        units: [
          {
            title: "Intro Course: Human Visual System Limits, FOV, PPD & Persistence",
            outline: "Retinal resolution (60+ PPD), low-persistence strobing, and why naive rendering causes motion sickness.",
            difficulty: "beginner",
            tierLabel: "Intro Course",
          },
          {
            title: "Hardware Asynchronous Timewarp (ATW) & Late-Latching Reprojection",
            outline: "Scanline-level homography and depth-aware reprojection engines that warp frames microseconds before photon emission.",
            difficulty: "intermediate",
            tierLabel: "Core Mechanics",
          },
          {
            title: "Eye-Tracked Foveated Rendering & Display Stream Compression",
            outline: "Dynamic eccentricity-based shading rate control and visually lossless link compression to cut pixel power by 70%.",
            difficulty: "advanced",
            tierLabel: "Advanced Mastery",
          },
          {
            title: "Micro-OLED / Micro-LED Silicon Backplanes & Non-Uniformity Correction",
            outline: "CMOS backplane pixel drivers, pulse-width vs analog modulation, and real-time waveguide Mura/color calibration LUTs.",
            difficulty: "nextgen",
            tierLabel: "Frontier & SOTA",
          },
        ],
      },
    ];

    return {
      pathwayName: targetGoal.trim(),
      pathwayDescription:
        "End-to-end engineering roadmap from mathematical & electromagnetic foundations to low-power VLSI, spatial SLAM/NPU accelerators, and sub-10ms XR display silicon.",
      icon: "Cpu",
      color: "cyan",
      blocks,
      capstoneBottleneck:
        "Design a <1.5W always-on XR perception & display co-processor architecture achieving <5ms motion-to-photon latency with 6DoF VIO and eye-tracked foveated reprojection.",
    };
  }

  // General intelligent decomposer for ANY role, industry, or classical science query
  const scoredCatalog = catalogTopics
    .map((t) => ({
      topic: t,
      score: computeConceptOverlap(targetGoal, `${t.title} ${t.description}`),
    }))
    .sort((a, b) => b.score - a.score);

  const pickedFoundations = scoredCatalog.slice(0, 3).map((x) => x.topic);
  if (pickedFoundations.length === 0 && catalogTopics.length >= 2) {
    pickedFoundations.push(catalogTopics[0], catalogTopics[1]);
  }

  const blocks: RoadmapBlockSpec[] = pickedFoundations.map((t, idx) => ({
    existingTopicId: t.id,
    title: t.title,
    description: t.description,
    phaseLabel: "Phase 1: Core Scientific & Mathematical Foundations",
    impactTier: "foundation" as const,
    impactScore: 84 - idx * 3,
    estimatedHours: 9,
    isRequired: true,
    whyItMatters: `Essential foundational underlayment for mastering ${targetGoal}.`,
    prerequisiteIndices: idx === 0 ? [] : [idx - 1],
  }));

  const baseIdx = blocks.length;
  blocks.push(
    {
      title: `${targetGoal}: Core Architecture & First-Principles Systems`,
      description: `Foundational systems, formal mechanisms, and core engineering building blocks for ${targetGoal}.`,
      phaseLabel: "Phase 2: Core Disciplinary Pillars",
      impactTier: "core",
      impactScore: 92,
      estimatedHours: 12,
      isRequired: true,
      whyItMatters: `Bridges foundational theory into the day-to-day mental models of ${targetGoal}.`,
      prerequisiteIndices: baseIdx > 0 ? [baseIdx - 1] : [],
      units: [
        {
          title: `Intro Course: System Map & First Principles of ${targetGoal}`,
          outline: "Core taxonomy, governing equations/abstractions, and how the key subsystems interact.",
          difficulty: "beginner",
          tierLabel: "Intro Course",
        },
        {
          title: `Core Mechanisms & Quantitative Trade-Offs in ${targetGoal}`,
          outline: "Primary state variables, bottlenecks, and canonical design patterns.",
          difficulty: "intermediate",
          tierLabel: "Core Mechanics",
        },
        {
          title: `Applied System Design & Verification for ${targetGoal}`,
          outline: "End-to-end implementation workflow, instrumentation, and failure-mode debugging.",
          difficulty: "advanced",
          tierLabel: "Advanced Mastery",
        },
      ],
    },
    {
      title: `${targetGoal}: Highest-Impact Practitioner Building Blocks (80/20 Core)`,
      description: `High-leverage technical workflows, optimization techniques, and production patterns for ${targetGoal}.`,
      phaseLabel: "Phase 3: Highest-Impact Industry Building Blocks",
      impactTier: "high_impact",
      impactScore: 98,
      estimatedHours: 14,
      isRequired: true,
      whyItMatters: `The highest-impact 20% of skills that drive 80% of real-world capability in ${targetGoal}.`,
      prerequisiteIndices: [baseIdx],
      units: [
        {
          title: `Intro Course: High-Leverage Workflows in ${targetGoal}`,
          outline: "Identifying critical-path constraints, performance metrics, and operator tooling.",
          difficulty: "beginner",
          tierLabel: "Intro Course",
        },
        {
          title: `Optimization, Scaling & Edge-Case Engineering`,
          outline: "Stress-testing assumptions, handling real-world noise/scale, and quantitative benchmarking.",
          difficulty: "intermediate",
          tierLabel: "Core Mechanics",
        },
        {
          title: `Production Architecture & Cross-Domain Integration`,
          outline: "Integrating with adjacent hardware/software/scientific stacks.",
          difficulty: "advanced",
          tierLabel: "Advanced Mastery",
        },
      ],
    },
    {
      title: `${targetGoal}: Frontier SOTA & Unsolved Bottlenecks`,
      description: `State-of-the-art research limits, open industry roadblocks, and falsifiable hypothesis design in ${targetGoal}.`,
      phaseLabel: "Phase 4: Frontier SOTA & Bottlenecks",
      impactTier: "frontier",
      impactScore: 94,
      estimatedHours: 10,
      isRequired: true,
      whyItMatters: `Prepares you to push past textbook knowledge and contribute to unsolved problems in ${targetGoal}.`,
      prerequisiteIndices: [baseIdx + 1],
      units: [
        {
          title: `Intro Course: Current SOTA Ceiling in ${targetGoal}`,
          outline: "Where current methods hit physical, computational, or theoretical walls.",
          difficulty: "beginner",
          tierLabel: "Intro Course",
        },
        {
          title: `Emerging Paradigms & Cross-Industry Transfers`,
          outline: "Novel techniques imported from adjacent fields to bypass legacy bottlenecks.",
          difficulty: "advanced",
          tierLabel: "Advanced Mastery",
        },
        {
          title: `Frontier Lab: Formulating a Falsifiable Hypothesis`,
          outline: "Designing a 2-week minimal viable experiment or simulation against an open bottleneck.",
          difficulty: "nextgen",
          tierLabel: "Frontier & SOTA",
        },
      ],
    },
  );

  return {
    pathwayName: targetGoal.trim(),
    pathwayDescription: `Structured mastery roadmap for ${targetGoal} — sequenced from foundational hard-science primitives through highest-impact building blocks to frontier SOTA bottlenecks.`,
    icon: trackType === "role_career" ? "Cpu" : trackType === "industry_frontier" ? "Rocket" : "Atom",
    color: trackType === "role_career" ? "cyan" : trackType === "industry_frontier" ? "purple" : "blue",
    blocks,
    capstoneBottleneck: `Identify and prototype a solution to a live SOTA bottleneck in ${targetGoal}.`,
  };
}

/**
 * Architect and persist a complete Role / Industry / Classical Mastery Pathway
 */
export async function architectMasteryRoadmap(
  storage: IStorage,
  userId: string,
  input: RoadmapArchitectInput,
): Promise<{
  pathway: Pathway;
  timeline: PathwayTimelineReport;
  createdTopicsCount: number;
  reusedTopicsCount: number;
}> {
  const targetGoal = input.targetGoal.trim();
  const trackType: TrackType = input.trackType || "role_career";
  const visibleTopics = await storage.getVisibleTopics(userId);
  const publishedTopics = visibleTopics.filter((t) => t.published);

  // Start from our deterministic + catalog-aware blueprint
  let blueprint = buildDeterministicBlocks(targetGoal, trackType, publishedTopics);

  // If customBlocks were explicitly supplied (e.g. via Hermes MCP `synapse.architect_pathway`), use them
  if (input.customBlocks && input.customBlocks.length > 0) {
    blueprint = {
      ...blueprint,
      blocks: input.customBlocks,
    };
  } else if (input.userConfig && validateByokCredentials(input.userConfig).valid) {
    // When BYOC is configured, let the user's model refine/tailor the building blocks
    try {
      const catalogSummary = publishedTopics
        .map((t) => `- id=${t.id}: "${t.title}" (${t.description.slice(0, 90)})`)
        .join("\n");

      const prompt = `You are a Principal Curriculum & Career Roadmap Architect for SynapseJourney.
The learner wants a complete, dependency-ordered mastery roadmap for:
TARGET ROLE / INDUSTRY / FIELD: "${targetGoal}"
TRACK TYPE: "${trackType}"
PRIOR BACKGROUND: "${input.priorBackground || "General STEM curiosity"}"

EXISTING CANONICAL COURSES IN CATALOG (reuse their exact existingTopicId whenever they are a genuine foundational or core building block):
${catalogSummary}

Design a 6 to 8 course roadmap broken into 4 sequential phases:
- "Phase 1: Mathematical & Physical Underlayment" (impactTier: "foundation") — reuse 2-4 relevant catalog courses by setting existingTopicId!
- "Phase 2: Core Disciplinary Pillars" (impactTier: "core")
- "Phase 3: Highest-Impact Building Blocks (80/20 Core)" (impactTier: "high_impact") — create 2-3 specialized courses tailored to "${targetGoal}"!
- "Phase 4: Frontier SOTA & Bottlenecks" (impactTier: "frontier") — create 1 frontier course!

For every NEW course (where existingTopicId is null), include 4 sequential units ("Intro Course", "Core Mechanics", "Advanced Mastery", "Frontier & SOTA").

Respond with ONLY a JSON object:
{
  "pathwayName": "Concise title",
  "pathwayDescription": "2-sentence overview of what this roadmap achieves",
  "icon": "Cpu|Rocket|Atom|Brain|Code|Wrench|Calculator|Beaker",
  "color": "cyan|purple|blue|emerald|amber|indigo",
  "capstoneBottleneck": "1-sentence frontier capstone challenge",
  "blocks": [
    {
      "existingTopicId": 13,
      "title": "Course Title",
      "description": "What this course covers",
      "phaseLabel": "Phase 1: Mathematical & Physical Underlayment",
      "impactTier": "foundation|core|high_impact|frontier",
      "impactScore": 95,
      "estimatedHours": 10,
      "whyItMatters": "1 sentence on why this block is essential for ${targetGoal}",
      "prerequisiteIndices": [0],
      "units": [
        { "title": "Intro Course: ...", "outline": "1-2 sentences", "difficulty": "beginner", "tierLabel": "Intro Course" }
      ]
    }
  ]
}`;

      const aiRes = await generateByokOrPool([{ role: "user", content: prompt }], input.userConfig, {
        responseFormat: "json",
        temperature: 0.6,
        maxTokens: 2048,
      });
      const raw = aiRes.content || "{}";
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const parsed = JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw.trim());
      if (Array.isArray(parsed.blocks) && parsed.blocks.length >= 3) {
        blueprint = {
          pathwayName: String(parsed.pathwayName || targetGoal).slice(0, 100),
          pathwayDescription: String(parsed.pathwayDescription || blueprint.pathwayDescription).slice(0, 480),
          icon: String(parsed.icon || blueprint.icon),
          color: String(parsed.color || blueprint.color),
          capstoneBottleneck: String(parsed.capstoneBottleneck || blueprint.capstoneBottleneck),
          blocks: parsed.blocks,
        };
      }
    } catch (aiErr) {
      console.warn("[PathwayArchitect] AI refinement failed, using deterministic blueprint:", aiErr);
    }
  }

  // Materialize topics & collect resolved topicIds by block index
  const categories = await storage.getCategories();
  const defaultCategoryId = categories[0]?.id ?? null;
  const resolvedTopicIds: number[] = [];
  let createdTopicsCount = 0;
  let reusedTopicsCount = 0;

  for (let i = 0; i < blueprint.blocks.length; i++) {
    const block = blueprint.blocks[i];
    let topic: Topic | undefined;

    if (block.existingTopicId) {
      topic = await storage.getTopicById(Number(block.existingTopicId));
    }
    if (!topic) {
      topic = visibleTopics.find((t) => t.title.toLowerCase() === block.title.trim().toLowerCase());
    }

    if (topic) {
      reusedTopicsCount++;
    } else {
      topic = await storage.createTopic({
        title: block.title.trim(),
        description: block.description || block.whyItMatters,
        categoryId: defaultCategoryId,
        difficulty: block.impactTier === "foundation" ? "beginner" : block.impactTier === "frontier" ? "advanced" : "intermediate",
        kind: "niche",
        published: false,
        ownerUserId: userId,
      } as any);
      visibleTopics.push(topic);
      createdTopicsCount++;

      // Create the 4-stage Linear Spine units for this new building-block topic so it's immediately runnable
      const unitsToCreate =
        block.units && block.units.length > 0
          ? block.units
          : [
              {
                title: `Intro Course: Orientation & First Principles of ${block.title}`,
                outline: `Core mental model, terminology, and governing equations for ${block.title}.`,
                difficulty: "beginner" as const,
                tierLabel: "Intro Course",
              },
              {
                title: `Core Mechanics & Building Blocks of ${block.title}`,
                outline: `Fundamental mechanisms, quantitative analysis, and practical design patterns.`,
                difficulty: "intermediate" as const,
                tierLabel: "Core Mechanics",
              },
              {
                title: `Applied Systems & Edge-Case Mastery in ${block.title}`,
                outline: `Real-world implementation constraints, verification, and failure modes.`,
                difficulty: "advanced" as const,
                tierLabel: "Advanced Mastery",
              },
              {
                title: `Frontier SOTA & Open Bottlenecks in ${block.title}`,
                outline: `Unsolved industry challenges and cross-domain research directions.`,
                difficulty: "nextgen" as const,
                tierLabel: "Frontier & SOTA",
              },
            ];

      const idxByDiff: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0, nextgen: 0 };
      for (const u of unitsToCreate) {
        const diff = ["beginner", "intermediate", "advanced", "nextgen"].includes(u.difficulty)
          ? u.difficulty
          : "intermediate";
        const unitIdx = idxByDiff[diff] ?? 0;
        idxByDiff[diff] = unitIdx + 1;
        await storage.createLessonUnit({
          topicId: topic.id,
          difficulty: diff,
          contentType: "balanced",
          unitIndex: unitIdx,
          title: u.title,
          outline: `${u.outline} [${u.tierLabel || "Core"}]`,
        });
      }

      indexTopicToFlywheel(storage as any, topic.id).catch(() => {});
    }

    resolvedTopicIds.push(topic.id);
  }

  const totalEstimatedHours = blueprint.blocks.reduce((sum, b) => sum + (Number(b.estimatedHours) || 8), 0);

  const pathway = await storage.createPathway({
    name: blueprint.pathwayName,
    description: blueprint.pathwayDescription,
    icon: blueprint.icon || "Cpu",
    color: blueprint.color || "cyan",
    difficulty: "mixed",
    estimatedHours: totalEstimatedHours,
    trackType,
    targetRole: targetGoal,
    roadmapMeta: {
      capstoneBottleneck: blueprint.capstoneBottleneck,
      priorBackground: input.priorBackground || null,
      createdAt: new Date().toISOString(),
    },
    isActive: true,
    createdByUserId: userId,
  } as any);

  const seenTopicIds = new Set<number>();
  for (let i = 0; i < blueprint.blocks.length; i++) {
    const block = blueprint.blocks[i];
    const topicId = resolvedTopicIds[i];
    if (seenTopicIds.has(topicId)) continue;
    seenTopicIds.add(topicId);

    const prereqTopicIds = (block.prerequisiteIndices || [])
      .map((idx) => resolvedTopicIds[idx])
      .filter((id): id is number => typeof id === "number" && id !== topicId);

    await storage.addTopicToPathway(pathway.id, topicId, i + 1, block.isRequired !== false, {
      prerequisiteTopicIds: prereqTopicIds,
      impactScore: Math.min(100, Math.max(10, Number(block.impactScore) || 85)),
      impactTier: block.impactTier || "core",
      estimatedHours: Math.max(2, Number(block.estimatedHours) || 8),
      phaseLabel: block.phaseLabel || `Phase ${Math.min(4, Math.floor(i / 2) + 1)}`,
      whyItMatters: block.whyItMatters || null,
    });

    // Also link prerequisites on the 3D Knowledge Web
    for (const prereqId of prereqTopicIds) {
      storage
        .createConnection({
          fromTopicId: prereqId,
          toTopicId: topicId,
          connectionType: "prerequisite",
          strength: 8,
        })
        .catch(() => {});
    }
  }

  await storage.enrollInPathway(userId, pathway.id);

  const timeline = await computePathwayTimeline(storage, userId, pathway.id, {
    dailyMinutes: input.dailyMinutes || 60,
    paceMode: "balanced",
  });

  return {
    pathway,
    timeline,
    createdTopicsCount,
    reusedTopicsCount,
  };
}

/**
 * Compute an interactive, prior-knowledge-aware timeline & impact ranking for any pathway
 */
export async function computePathwayTimeline(
  storage: IStorage,
  userId: string | null | undefined,
  pathwayId: number,
  opts?: {
    dailyMinutes?: number;
    paceMode?: "fast_track" | "balanced" | "rigorous";
  },
): Promise<PathwayTimelineReport> {
  const pathway = await storage.getPathwayById(pathwayId);
  if (!pathway) {
    throw new Error(`Pathway ${pathwayId} not found`);
  }

  const dailyMinutes = Math.min(480, Math.max(15, Number(opts?.dailyMinutes) || 60));
  const paceMode = opts?.paceMode || "balanced";
  const paceMultiplier = paceMode === "fast_track" ? 1.35 : paceMode === "rigorous" ? 0.75 : 1.0;

  const rawTopics = await storage.getPathwayTopics(pathwayId);
  const sorted = [...rawTopics].sort((a, b) => a.order - b.order);

  const masteredTopicIds = new Set<number>();
  const nodesSequential: PathwayTimelineNode[] = [];

  let grossTotalHours = 0;
  let priorSavedHours = 0;
  let netBaseHours = 0;
  let runningHours = 0;

  for (let idx = 0; idx < sorted.length; idx++) {
    const pt = sorted[idx];
    const units = await storage.getLessonUnits(pt.topic.id);
    const grossHours = pt.estimatedHours || Math.max(4, Math.round((units.length || 6) * 1.2));

    let priorMasteryPct = 0;
    let priorConceptsCount = 0;
    if (userId) {
      const prog = await storage.getProgressForTopic(userId, pt.topic.id);
      const priorReport = await getPriorKnowledgeForTopic(storage, userId, { topicId: pt.topic.id });
      priorMasteryPct = Math.max(prog?.mastery ?? 0, priorReport.effectiveMasteryPct);
      priorConceptsCount = priorReport.ledgerEntries.length;
    }

    if (priorMasteryPct >= 80) {
      masteredTopicIds.add(pt.topic.id);
    }

    const hoursSaved = Number(((grossHours * Math.min(100, priorMasteryPct)) / 100).toFixed(1));
    const netHours = Number(Math.max(0, grossHours - hoursSaved).toFixed(1));

    grossTotalHours += grossHours;
    priorSavedHours += hoursSaved;
    netBaseHours += netHours;
    runningHours += netHours / paceMultiplier;

    const hoursPerWeek = (dailyMinutes / 60) * 7;
    const estimatedWeekSequential = Math.max(1, Math.ceil(runningHours / Math.max(1, hoursPerWeek)));

    const prereqs = pt.prerequisiteTopicIds || [];
    const prereqsMet = prereqs.length === 0 || prereqs.every((pid) => masteredTopicIds.has(pid));
    const status: PathwayTimelineNode["status"] =
      priorMasteryPct >= 80
        ? "mastered"
        : priorMasteryPct > 0
        ? "in_progress"
        : prereqsMet
        ? "ready"
        : "locked";

    const fallbackPhase =
      idx === 0
        ? "Phase 1: Core Scientific & Mathematical Foundations"
        : idx < Math.ceil(sorted.length * 0.5)
        ? "Phase 2: Core Disciplinary Pillars"
        : idx < sorted.length - 1
        ? "Phase 3: Highest-Impact Building Blocks"
        : "Phase 4: Frontier SOTA & Bottlenecks";

    nodesSequential.push({
      topicId: pt.topic.id,
      title: pt.topic.title,
      description: pt.topic.description,
      order: pt.order || idx + 1,
      phaseLabel: pt.phaseLabel || fallbackPhase,
      impactTier: (pt.impactTier as ImpactTier) || (idx === 0 ? "foundation" : "core"),
      impactScore: pt.impactScore ?? (idx >= Math.floor(sorted.length / 2) ? 92 : 82),
      isRequired: pt.isRequired,
      whyItMatters:
        pt.whyItMatters ||
        `Sequential building block #${idx + 1} in ${pathway.name}.`,
      prerequisiteTopicIds: prereqs,
      grossHours,
      priorMasteryPct,
      priorConceptsCount,
      hoursSaved,
      netHours,
      cumulativeHoursSequential: Number(runningHours.toFixed(1)),
      estimatedWeekSequential,
      unitCount: units.length,
      status,
    });
  }

  const adjustedRemainingHours = Number((netBaseHours / paceMultiplier).toFixed(1));
  const dailyHours = dailyMinutes / 60;
  const estimatedDays = Math.max(1, Math.ceil(adjustedRemainingHours / Math.max(0.25, dailyHours)));
  const estimatedWeeks = Number((estimatedDays / 7).toFixed(1));
  const projectedDate = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);

  // Highest-Impact First (80/20 Pareto ordering): sort unmastered high-impact blocks first
  const nodesHighImpactFirst = [...nodesSequential].sort((a, b) => {
    if (a.status === "mastered" && b.status !== "mastered") return 1;
    if (b.status === "mastered" && a.status !== "mastered") return -1;
    return b.impactScore - a.impactScore;
  });

  return {
    pathway,
    dailyMinutes,
    paceMode,
    paceMultiplier,
    grossTotalHours: Number(grossTotalHours.toFixed(1)),
    priorSavedHours: Number(priorSavedHours.toFixed(1)),
    netBaseHours: Number(netBaseHours.toFixed(1)),
    adjustedRemainingHours,
    estimatedDays,
    estimatedWeeks,
    projectedCompletionDate: projectedDate.toISOString().split("T")[0],
    nodesSequential,
    nodesHighImpactFirst,
  };
}
