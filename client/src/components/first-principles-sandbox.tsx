import { useState, useMemo, useEffect } from "react";
import {
  Sliders,
  Cpu,
  TrendingUp,
  Rocket,
  BrainCircuit,
  Waves,
  BookmarkCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonMarkdown } from "@/components/lesson-markdown";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FirstPrinciplesSandboxProps {
  topicId: number;
  topicTitle: string;
  unitId: number;
  unitTitle: string;
}

type SandboxDomain = "optics_photonics" | "silicon" | "finance_mba" | "orbital_physics" | "ai_systems";

function detectSandboxDomain(topicTitle: string, unitTitle: string): { domain: SandboxDomain; matched: boolean } {
  const t = `${topicTitle} ${unitTitle}`.toLowerCase();
  if (
    t.includes("optic") ||
    t.includes("photonic") ||
    t.includes("fiber") ||
    t.includes("fibre") ||
    t.includes("waveguide") ||
    t.includes("birefring") ||
    t.includes("eigenmode") ||
    t.includes("laser") ||
    t.includes("electromagnet") ||
    t.includes("maxwell") ||
    t.includes("diffract") ||
    t.includes("interferom") ||
    t.includes("polariz")
  ) {
    return { domain: "optics_photonics", matched: true };
  }
  if (
    t.includes("mba") ||
    t.includes("finance") ||
    t.includes("valuation") ||
    t.includes("dcf") ||
    t.includes("accounting") ||
    t.includes("econom") ||
    t.includes("ltv") ||
    t.includes("cac") ||
    t.includes("pricing") ||
    t.includes("strategy") ||
    t.includes("venture") ||
    t.includes("cap table")
  ) {
    return { domain: "finance_mba", matched: true };
  }
  if (
    t.includes("vlsi") ||
    t.includes("silicon") ||
    t.includes("chip") ||
    t.includes("rtl") ||
    t.includes("cmos") ||
    t.includes("asic") ||
    t.includes("soc") ||
    t.includes("display") ||
    t.includes("semiconductor") ||
    t.includes("transistor")
  ) {
    return { domain: "silicon", matched: true };
  }
  if (
    t.includes("orbital") ||
    t.includes("mechanics") ||
    t.includes("physics") ||
    t.includes("kepler") ||
    t.includes("thermodynam") ||
    t.includes("calculus") ||
    t.includes("differential") ||
    t.includes("aerospace")
  ) {
    return { domain: "orbital_physics", matched: true };
  }
  if (
    t.includes("llm") ||
    t.includes("neural") ||
    t.includes("transformer") ||
    t.includes("machine learning") ||
    t.includes("deep learning") ||
    t.includes("gpu") ||
    t.includes("quantization") ||
    t.includes("inference")
  ) {
    return { domain: "ai_systems", matched: true };
  }
  return { domain: "ai_systems", matched: false };
}

export function FirstPrinciplesSandbox({
  topicId,
  topicTitle,
  unitId,
  unitTitle,
}: FirstPrinciplesSandboxProps) {
  const detection = useMemo(
    () => detectSandboxDomain(topicTitle, unitTitle),
    [topicTitle, unitTitle],
  );
  const [domain, setDomain] = useState<SandboxDomain>(detection.domain);
  const [isExpanded, setIsExpanded] = useState<boolean>(detection.matched);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setDomain(detection.domain);
    setIsExpanded(detection.matched);
  }, [detection.domain, detection.matched, unitId]);

  // 0. Optics / Photonics Waveguide & Fiber Mode Explorer
  const [coreRadiusUm, setCoreRadiusUm] = useState(4.1); // um (SMF-28 ~ 4.1 um)
  const [wavelengthNm, setWavelengthNm] = useState(1550); // nm (C-band 1550 nm)
  const [deltaIndexPct, setDeltaIndexPct] = useState(0.36); // relative index step (%)
  const [birefringenceE4, setBirefringenceE4] = useState(3.0); // Delta n * 10^-4

  // 1. Silicon / Hardware PPA state (P_dyn = alpha * C * Vdd^2 * f)
  const [vddMv, setVddMv] = useState(750);
  const [freqMhz, setFreqMhz] = useState(800);
  const [sramTileKb, setSramTileKb] = useState(512);

  // 2. Alt-MBA / Unit Economics & DCF state
  const [arpu, setArpu] = useState(120);
  const [grossMarginPct, setGrossMarginPct] = useState(75);
  const [monthlyChurnPct, setMonthlyChurnPct] = useState(3.0);
  const [cac, setCac] = useState(600);
  const [waccPct, setWaccPct] = useState(10);

  // 3. Orbital / Physics Vis-Viva & Hohmann Transfer state
  const [r1AltKm, setR1AltKm] = useState(400);
  const [r2AltKm, setR2AltKm] = useState(35786);

  // 4. AI / Systems Roofline & Quantization state
  const [paramsBillion, setParamsBillion] = useState(8);
  const [bitsPerWeight, setBitsPerWeight] = useState(4);
  const [memBwGbs, setMemBwGbs] = useState(400);

  // Computed outputs
  const opticsMetrics = useMemo(() => {
    const n1 = 1.468; // fused silica core at 1550 nm
    const n2 = n1 * (1 - deltaIndexPct / 100);
    const na = Math.sqrt(Math.max(0, n1 * n1 - n2 * n2));
    const lambdaUm = wavelengthNm / 1000;
    const vNumber = (2 * Math.PI * coreRadiusUm * na) / lambdaUm;
    const isSingleMode = vNumber < 2.4048;
    const approxModes = isSingleMode ? 1 : Math.max(2, Math.round((vNumber * vNumber) / 2));
    const cutoffWavelengthNm = Math.round(((2 * Math.PI * coreRadiusUm * na) / 2.4048) * 1000);
    const deltaN = birefringenceE4 * 1e-4;
    const beatLengthMm = Number(((lambdaUm / Math.max(1e-7, deltaN)) / 1000).toFixed(2));
    return {
      na: Number(na.toFixed(3)),
      vNumber: Number(vNumber.toFixed(2)),
      isSingleMode,
      approxModes,
      cutoffWavelengthNm,
      beatLengthMm,
    };
  }, [coreRadiusUm, wavelengthNm, deltaIndexPct, birefringenceE4]);

  const siliconMetrics = useMemo(() => {
    const v = vddMv / 1000;
    const fGhz = freqMhz / 1000;
    const capFactor = 1.4 + sramTileKb / 2048;
    const dynamicPowerW = Number((capFactor * v * v * fGhz).toFixed(2));
    const leakagePowerW = Number((0.18 * Math.exp((v - 0.7) * 2.2) * (sramTileKb / 512)).toFixed(2));
    const totalPowerW = Number((dynamicPowerW + leakagePowerW).toFixed(2));
    const frameLatencyMs = Number((6.4 / fGhz / (1 + Math.log2(sramTileKb / 128) * 0.15)).toFixed(2));
    const withinXrEnvelope = totalPowerW <= 1.8 && frameLatencyMs <= 8.0;
    return { dynamicPowerW, leakagePowerW, totalPowerW, frameLatencyMs, withinXrEnvelope };
  }, [vddMv, freqMhz, sramTileKb]);

  const financeMetrics = useMemo(() => {
    const monthlyContribution = arpu * (grossMarginPct / 100);
    const churnRate = Math.max(0.005, monthlyChurnPct / 100);
    const ltv = Math.round(monthlyContribution / churnRate);
    const ltvCacRatio = Number((ltv / Math.max(1, cac)).toFixed(2));
    const paybackMonths = Number((cac / Math.max(1, monthlyContribution)).toFixed(1));
    const annualNetCf = (monthlyContribution * 12 * 1000) / (1 + churnRate * 6);
    const r = waccPct / 100;
    let npv5Yr = -cac * 1000;
    for (let yr = 1; yr <= 5; yr++) {
      npv5Yr += annualNetCf / Math.pow(1 + r, yr);
    }
    return {
      monthlyContribution: Math.round(monthlyContribution),
      ltv,
      ltvCacRatio,
      paybackMonths,
      npv5YrPer1k: Math.round(npv5Yr),
    };
  }, [arpu, grossMarginPct, monthlyChurnPct, cac, waccPct]);

  const orbitalMetrics = useMemo(() => {
    const Re = 6378.137;
    const mu = 398600.4418;
    const r1 = Re + r1AltKm;
    const r2 = Re + Math.max(r1AltKm, r2AltKm);
    const aTrans = (r1 + r2) / 2;
    const v1 = Math.sqrt(mu / r1);
    const v2 = Math.sqrt(mu / r2);
    const vPerigee = Math.sqrt(mu * (2 / r1 - 1 / aTrans));
    const vApogee = Math.sqrt(mu * (2 / r2 - 1 / aTrans));
    const dv1 = Math.abs(vPerigee - v1);
    const dv2 = Math.abs(v2 - vApogee);
    const totalDvKms = Number((dv1 + dv2).toFixed(3));
    const transferHours = Number(((Math.PI * Math.sqrt(Math.pow(aTrans, 3) / mu)) / 3600).toFixed(2));
    return {
      v1Kms: Number(v1.toFixed(2)),
      totalDvKms,
      transferHours,
    };
  }, [r1AltKm, r2AltKm]);

  const aiMetrics = useMemo(() => {
    const bytesPerWeight = bitsPerWeight / 8;
    const vramGb = Number((paramsBillion * bytesPerWeight * 1.15).toFixed(2));
    const maxTokPerSec = Math.round(memBwGbs / Math.max(0.2, paramsBillion * bytesPerWeight));
    const msPerToken = Number((1000 / Math.max(1, maxTokPerSec)).toFixed(1));
    return { vramGb, maxTokPerSec, msPerToken };
  }, [paramsBillion, bitsPerWeight, memBwGbs]);

  const handleSaveArtifact = async () => {
    setSaving(true);
    try {
      const artifactType =
        domain === "finance_mba"
          ? "financial_case_model"
          : domain === "silicon"
          ? "architecture_memo"
          : domain === "orbital_physics" || domain === "optics_photonics"
          ? "derivation_proof"
          : "code_simulation";

      const summary =
        domain === "optics_photonics"
          ? `Optical Waveguide & Fiber Mode Analysis on "${unitTitle}": a=${coreRadiusUm} um, lambda=${wavelengthNm} nm, Delta=${deltaIndexPct}% -> NA=${opticsMetrics.na}, V=${opticsMetrics.vNumber} (${opticsMetrics.isSingleMode ? "Single-Mode" : `Multimode ~${opticsMetrics.approxModes} modes`}), cutoff=${opticsMetrics.cutoffWavelengthNm} nm, beat length L_B=${opticsMetrics.beatLengthMm} mm.`
          : domain === "finance_mba"
          ? `Unit Economics & DCF Model on "${unitTitle}": ARPU $${arpu}, Gross Margin ${grossMarginPct}%, Monthly Churn ${monthlyChurnPct}%, CAC $${cac}, WACC ${waccPct}% -> LTV $${financeMetrics.ltv}, LTV:CAC ${financeMetrics.ltvCacRatio}x, Payback ${financeMetrics.paybackMonths} mos, 5-Yr NPV/1k customers $${financeMetrics.npv5YrPer1k.toLocaleString()}.`
          : domain === "silicon"
          ? `SoC PPA Trade-Off Analysis on "${unitTitle}": Vdd=${vddMv}mV, Clock=${freqMhz}MHz, On-Chip SRAM=${sramTileKb}KB -> P_dyn=${siliconMetrics.dynamicPowerW}W, P_leak=${siliconMetrics.leakagePowerW}W, Total=${siliconMetrics.totalPowerW}W, Frame Latency=${siliconMetrics.frameLatencyMs}ms (${siliconMetrics.withinXrEnvelope ? "PASSES <1.8W/<8ms XR envelope" : "Exceeds envelope"}).`
          : domain === "orbital_physics"
          ? `Hohmann Transfer & Vis-Viva Analysis on "${unitTitle}": r1=${r1AltKm}km LEO to r2=${r2AltKm}km -> v1=${orbitalMetrics.v1Kms} km/s, Total Delta-v=${orbitalMetrics.totalDvKms} km/s, Transfer Time=${orbitalMetrics.transferHours} hrs.`
          : `Memory-Bandwidth Roofline Analysis on "${unitTitle}": ${paramsBillion}B model @ ${bitsPerWeight}-bit quantization on ${memBwGbs} GB/s bus -> Footprint=${aiMetrics.vramGb} GB, Throughput=${aiMetrics.maxTokPerSec} tok/s (${aiMetrics.msPerToken} ms/tok).`;

      await apiRequest("POST", "/api/learn/portfolio-artifacts", {
        topicId,
        unitId,
        title: `${topicTitle}: ${unitTitle} — Quantitative Trade-Off Model`,
        artifactType,
        summary,
        metricsJson:
          domain === "optics_photonics"
            ? opticsMetrics
            : domain === "finance_mba"
            ? financeMetrics
            : domain === "silicon"
            ? siliconMetrics
            : domain === "orbital_physics"
            ? orbitalMetrics
            : aiMetrics,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/learn/portfolio-artifacts"] });
      toast({
        title: "Saved to Proof-of-Work Dossier! (+25 XP)",
        description: "Your quantitative trade-off snapshot is now recorded in your portfolio.",
      });
    } catch (err: any) {
      toast({
        title: "Sign in to save Proof-of-Work artifacts",
        description: err?.message || "Could not save artifact.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 via-background to-amber-500/5"
      data-testid="section-first-principles-sandbox"
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Sliders className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>Interactive Parameter Explorer (First-Principles Sandbox)</span>
              <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-500 dark:text-cyan-400">
                Optional Tool
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-cyan-500/80" />
              <span>
                Drag sliders below to test how governing physical or quantitative variables trade off in real time — no coding or AI key required. You can also save parameter snapshots to your Proof-of-Work portfolio.
              </span>
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((v) => !v)}
            className="h-7 text-xs gap-1 shrink-0"
            data-testid="button-toggle-sandbox"
          >
            <span>{isExpanded ? "Hide" : "Open Sandbox"}</span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {isExpanded && (
          <div className="flex flex-wrap items-center gap-1 pt-2">
            {(
              [
                { id: "optics_photonics", label: "Optics / Fiber", icon: Waves },
                { id: "silicon", label: "Silicon PPA", icon: Cpu },
                { id: "orbital_physics", label: "Physics / Orbital", icon: Rocket },
                { id: "ai_systems", label: "AI Roofline", icon: BrainCircuit },
                { id: "finance_mba", label: "Unit Econ / DCF", icon: TrendingUp },
              ] as const
            ).map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDomain(tab.id)}
                  className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    domain === tab.id
                      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-medium"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`sandbox-tab-${tab.id}`}
                >
                  <TabIcon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-2 text-xs">
          {domain === "optics_photonics" && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Explore step-index optical waveguide mode cutoff (
                <LessonMarkdown text="$V = \frac{2\pi a}{\lambda}\sqrt{n_1^2 - n_2^2}$" inline />
                ) and polarization birefringence beat length (
                <LessonMarkdown text="$L_B = \lambda / \Delta n$" inline />
                ):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Core Radius (<LessonMarkdown text="$a$" inline />):</span>
                    <strong>{coreRadiusUm.toFixed(1)} µm</strong>
                  </span>
                  <input
                    type="range"
                    min={1.5}
                    max={25}
                    step={0.1}
                    value={coreRadiusUm}
                    onChange={(e) => setCoreRadiusUm(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Wavelength (<LessonMarkdown text="$\lambda$" inline />):</span>
                    <strong>{wavelengthNm} nm</strong>
                  </span>
                  <input
                    type="range"
                    min={400}
                    max={2000}
                    step={10}
                    value={wavelengthNm}
                    onChange={(e) => setWavelengthNm(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Index Step (<LessonMarkdown text="$\Delta$" inline />):</span>
                    <strong>{deltaIndexPct.toFixed(2)}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0.1}
                    max={2.0}
                    step={0.02}
                    value={deltaIndexPct}
                    onChange={(e) => setDeltaIndexPct(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Birefringence (<LessonMarkdown text="$\Delta n$" inline />):</span>
                    <strong>{birefringenceE4.toFixed(1)}×10⁻⁴</strong>
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={birefringenceE4}
                    onChange={(e) => setBirefringenceE4(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Numerical Aperture (NA)</span>
                  <span className="text-sm font-bold">{opticsMetrics.na}</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Normalized Freq (<LessonMarkdown text="$V$" inline />)</span>
                  <span className="text-sm font-bold text-cyan-500 dark:text-cyan-400">{opticsMetrics.vNumber}</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Mode Regime (<LessonMarkdown text="$V_c = 2.405$" inline />)</span>
                  <Badge
                    variant="outline"
                    className={
                      opticsMetrics.isSingleMode
                        ? "border-emerald-500/40 text-emerald-500 text-[10px]"
                        : "border-amber-500/40 text-amber-500 text-[10px]"
                    }
                  >
                    {opticsMetrics.isSingleMode
                      ? `Single-Mode (λc ${opticsMetrics.cutoffWavelengthNm}nm)`
                      : `Multimode (~${opticsMetrics.approxModes} modes)`}
                  </Badge>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Beat Length (<LessonMarkdown text="$L_B$" inline />)</span>
                  <span className="text-sm font-bold">{opticsMetrics.beatLengthMm} mm</span>
                </div>
              </div>
            </div>
          )}

          {domain === "silicon" && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Explore CMOS power-performance-area (
                <LessonMarkdown text="$P = C V_{dd}^2 f + P_{\text{leak}}$" inline />
                ) vs spatial frame latency for low-power silicon:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Supply <LessonMarkdown text="$V_{dd}$" inline />:</span>
                    <strong>{vddMv} mV</strong>
                  </span>
                  <input
                    type="range"
                    min={500}
                    max={1100}
                    step={25}
                    value={vddMv}
                    onChange={(e) => setVddMv(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Clock Frequency:</span>
                    <strong>{freqMhz} MHz</strong>
                  </span>
                  <input
                    type="range"
                    min={200}
                    max={2400}
                    step={100}
                    value={freqMhz}
                    onChange={(e) => setFreqMhz(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>On-Die SRAM Tile:</span>
                    <strong>{sramTileKb} KB</strong>
                  </span>
                  <input
                    type="range"
                    min={128}
                    max={4096}
                    step={128}
                    value={sramTileKb}
                    onChange={(e) => setSramTileKb(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Dynamic Power</span>
                  <span className="text-sm font-bold">{siliconMetrics.dynamicPowerW} W</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Leakage Power</span>
                  <span className="text-sm font-bold">{siliconMetrics.leakagePowerW} W</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Pipeline Latency</span>
                  <span className="text-sm font-bold">{siliconMetrics.frameLatencyMs} ms</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Thermal / Latency Gate</span>
                  <Badge
                    variant="outline"
                    className={
                      siliconMetrics.withinXrEnvelope
                        ? "border-emerald-500/40 text-emerald-500 text-[10px]"
                        : "border-red-500/40 text-red-500 text-[10px]"
                    }
                  >
                    {siliconMetrics.totalPowerW}W · {siliconMetrics.withinXrEnvelope ? "PASS (<1.8W)" : "THERMAL THROTTLE"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {domain === "finance_mba" && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Unit Economics &amp; Capital Allocation Model — test how pricing power, gross margin, churn, and WACC compound cohort LTV:CAC and 5-year NPV:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>ARPU/mo:</span>
                    <strong>${arpu}</strong>
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={1000}
                    step={10}
                    value={arpu}
                    onChange={(e) => setArpu(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Gross Margin:</span>
                    <strong>{grossMarginPct}%</strong>
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={95}
                    step={5}
                    value={grossMarginPct}
                    onChange={(e) => setGrossMarginPct(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Monthly Churn:</span>
                    <strong>{monthlyChurnPct}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={monthlyChurnPct}
                    onChange={(e) => setMonthlyChurnPct(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>CAC:</span>
                    <strong>${cac}</strong>
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={3000}
                    step={50}
                    value={cac}
                    onChange={(e) => setCac(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>WACC:</span>
                    <strong>{waccPct}%</strong>
                  </span>
                  <input
                    type="range"
                    min={5}
                    max={25}
                    step={1}
                    value={waccPct}
                    onChange={(e) => setWaccPct(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Cohort LTV</span>
                  <span className="text-sm font-bold">${financeMetrics.ltv.toLocaleString()}</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">LTV : CAC Ratio</span>
                  <span
                    className={`text-sm font-bold ${
                      financeMetrics.ltvCacRatio >= 3 ? "text-emerald-500" : "text-amber-500"
                    }`}
                  >
                    {financeMetrics.ltvCacRatio}x
                  </span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">CAC Payback</span>
                  <span className="text-sm font-bold">{financeMetrics.paybackMonths} mos</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">5-Yr DCF NPV (per 1k cust)</span>
                  <span
                    className={`text-sm font-bold ${
                      financeMetrics.npv5YrPer1k > 0 ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    ${financeMetrics.npv5YrPer1k.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {domain === "orbital_physics" && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Vis-Viva (
                <LessonMarkdown text="$v^2 = \mu\left(\frac{2}{r} - \frac{1}{a}\right)$" inline />
                ) &amp; Hohmann Orbital Transfer Explorer:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Initial Orbit Altitude (<LessonMarkdown text="$r_1$" inline />):</span>
                    <strong>{r1AltKm} km</strong>
                  </span>
                  <input
                    type="range"
                    min={200}
                    max={2000}
                    step={50}
                    value={r1AltKm}
                    onChange={(e) => setR1AltKm(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Target Orbit Altitude (<LessonMarkdown text="$r_2$" inline />):</span>
                    <strong>{r2AltKm} km</strong>
                  </span>
                  <input
                    type="range"
                    min={400}
                    max={35786}
                    step={500}
                    value={r2AltKm}
                    onChange={(e) => setR2AltKm(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">
                    Initial Circular <LessonMarkdown text="$v_1$" inline />
                  </span>
                  <span className="text-sm font-bold">{orbitalMetrics.v1Kms} km/s</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">
                    Total Hohmann <LessonMarkdown text="$\Delta v$" inline />
                  </span>
                  <span className="text-sm font-bold text-cyan-500 dark:text-cyan-400">{orbitalMetrics.totalDvKms} km/s</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Transfer Coast Time</span>
                  <span className="text-sm font-bold">{orbitalMetrics.transferHours} hrs</span>
                </div>
              </div>
            </div>
          )}

          {domain === "ai_systems" && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Memory-Bandwidth Roofline &amp; Quantization Explorer for on-device / server inference:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Model Parameters:</span>
                    <strong>{paramsBillion}B</strong>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={70}
                    step={1}
                    value={paramsBillion}
                    onChange={(e) => setParamsBillion(Number(e.target.value))}
                    className="w-full accent-purple-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Quantization Precision:</span>
                    <strong>INT{bitsPerWeight} / FP{bitsPerWeight}</strong>
                  </span>
                  <input
                    type="range"
                    min={4}
                    max={16}
                    step={4}
                    value={bitsPerWeight}
                    onChange={(e) => setBitsPerWeight(Number(e.target.value))}
                    className="w-full accent-purple-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="flex justify-between">
                    <span>Memory Bandwidth:</span>
                    <strong>{memBwGbs} GB/s</strong>
                  </span>
                  <input
                    type="range"
                    min={60}
                    max={2000}
                    step={20}
                    value={memBwGbs}
                    onChange={(e) => setMemBwGbs(Number(e.target.value))}
                    className="w-full accent-purple-400"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">VRAM / Unified Memory</span>
                  <span className="text-sm font-bold">{aiMetrics.vramGb} GB</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Roofline Decode Speed</span>
                  <span className="text-sm font-bold text-emerald-500">{aiMetrics.maxTokPerSec} tok/s</span>
                </div>
                <div className="rounded-md border border-border/70 bg-background/80 p-2">
                  <span className="text-[10px] text-muted-foreground block">Inter-Token Latency</span>
                  <span className="text-sm font-bold">{aiMetrics.msPerToken} ms/tok</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
            <span className="text-[11px] text-muted-foreground">
              Save this parameter snapshot as a verifiable deliverable in your Proof-of-Work Dossier.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
              disabled={saving}
              onClick={handleSaveArtifact}
              data-testid="button-save-sandbox-artifact"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkCheck className="h-3.5 w-3.5" />}
              Save to Proof-of-Work (+25 XP)
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
