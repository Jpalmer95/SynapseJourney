/**
 * Shared provenance, freshness, and volatility helpers for SynapseJourney courses.
 * Used across generation routes, Hermes ingest, audit scripts, and the course colophon UI.
 */

export const CURRENT_GENERATOR_VERSION = "v3.2-katex-oer";

export type DomainVolatility = "evergreen" | "evolving" | "frontier";

export const VOLATILITY_CADENCE_DAYS: Record<DomainVolatility, number> = {
  evergreen: 365, // Classical mechanics, calculus, linear algebra, music theory
  evolving: 180,  // Databases, networks, finance, optics engineering, biology
  frontier: 75,   // AI agents, CRISPR, quantum frontier, SOTA security, ML systems
};

export function inferDomainVolatility(title: string, description?: string | null): DomainVolatility {
  const text = `${title} ${description || ""}`.toLowerCase();
  if (
    /\b(frontier|sota|agentic|llm|reinforcement learning|crispr|quantum|cryptography|generative ai|transformer|harbor|atif|spatial compute|xr display|biotech)\b/.test(
      text,
    )
  ) {
    return "frontier";
  }
  if (
    /\b(calculus|linear algebra|differential equations|classical mechanics|thermodynamics|electromagnetism|orbital mechanics|probability|statistics|graph theory|logic|music theory|general chemistry|organic chemistry|ancient civilizations|microeconomics|macroeconomics|game theory|metallurgy|waves)\b/.test(
      text,
    )
  ) {
    return "evergreen";
  }
  return "evolving";
}

export function computeNextRefreshDue(fromDate: Date, volatility: DomainVolatility): Date {
  const days = VOLATILITY_CADENCE_DAYS[volatility] ?? 180;
  return new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isTechnicalStemSubject(title: string, description?: string | null): boolean {
  const text = `${title} ${description || ""}`.toLowerCase();
  return /\b(physics|optic|photonic|fiber|waveguide|quantum|math|calculus|algebra|differential|equation|electromagnet|thermodynamic|mechanic|orbital|chemistry|biolog|genetic|crispr|algorithm|data structure|machine learning|neural|ai|agentic|vlsi|silicon|rtl|cmos|fpga|distributed|database|sql|cryptograph|security|network|compiler|rust|python|c\+\+|matlab|mathematica|engineering|signal processing|dsp|control theory|robotics|finance|dcf|valuation|econometrics|operations research|statistics)\b/.test(
    text,
  );
}
