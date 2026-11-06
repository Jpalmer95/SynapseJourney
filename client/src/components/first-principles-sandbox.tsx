import { useState, useMemo } from "react";
import { Sliders, Cpu, TrendingUp, Rocket, BrainCircuit, BookmarkCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FirstPrinciplesSandboxProps {
  topicId: number;
  topicTitle: string;
  unitId: number;
  unitTitle: string;
}

type SandboxDomain = "silicon" | "finance_mba" | "orbital_physics" | "ai_systems";

function detectSandboxDomain(topicTitle: string, unitTitle: string): SandboxDomain {
  const t = `${topicTitle} ${unitTitle}`.toLowerCase();
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
    return "finance_mba";
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
    t.includes("electromagnet") ||
    t.includes("optics")
  ) {
    return "silicon";
  }
  if (
    t.includes("orbital") ||
    t.includes("mechanics") ||
    t.includes("physics") ||
    t.includes("kepler") ||
    t.includes("thermodynam") ||
    t.includes("calculus") ||
    t.includes("differential")
  ) {
    return "orbital_physics";
  }
  return "ai_systems";
}

export function FirstPrinciplesSandbox({
  topicId,
  topicTitle,
  unitId,
  unitTitle,
}: FirstPrinciplesSandboxProps) {
  const defaultDomain = useMemo(
    () => detectSandboxDomain(topicTitle, unitTitle),
    [topicTitle, unitTitle],
  );
  const [domain, setDomain] = useState<SandboxDomain>(defaultDomain);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // 1. Silicon / Hardware PPA state (P_dyn = alpha * C * Vdd^2 * f)
  const [vddMv, setVddMv] = useState(750); // 500mV - 1100mV
  const [freqMhz, setFreqMhz] = useState(800); // 200MHz - 2400MHz
  const [sramTileKb, setSramTileKb] = useState(512); // 128KB - 4096KB

  // 2. Alt-MBA / Unit Economics & DCF state
  const [arpu, setArpu] = useState(120); // $20 - $1000/mo
  const [grossMarginPct, setGrossMarginPct] = useState(75); // 20% - 95%
  const [monthlyChurnPct, setMonthlyChurnPct] = useState(3.0); // 0.5% - 12%
  const [cac, setCac] = useState(600); // $50 - $5000
  const [waccPct, setWaccPct] = useState(10); // 5% - 25%

  // 3. Orbital / Physics Vis-Viva & Hohmann Transfer state
  const [r1AltKm, setR1AltKm] = useState(400); // LEO 200 - 2000km
  const [r2AltKm, setR2AltKm] = useState(35786); // Target 400 - 35786km (GEO)

  // 4. AI / Systems Roofline & Quantization state
  const [paramsBillion, setParamsBillion] = useState(8); // 1B - 70B
  const [bitsPerWeight, setBitsPerWeight] = useState(4); // 4, 8, 16
  const [memBwGbs, setMemBwGbs] = useState(400); // 60 - 2000 GB/s

  // Computed outputs
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
    // 5-year cohort DCF per 1,000 customers acquired
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
    const Re = 6378.137; // km
    const mu = 398600.4418; // km^3/s^2
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
          : domain === "orbital_physics"
          ? "derivation_proof"
          : "code_simulation";

      const summary =
        domain === "finance_mba"
          ? `Unit Economics & DCF Model on "${unitTitle}": ARPU $${arpu}, Gross Margin ${grossMarginPct}%, Monthly Churn ${monthlyChurnPct}%, CAC $${cac}, WACC ${waccPct}% → LTV $${financeMetrics.ltv}, LTV:CAC ${financeMetrics.ltvCacRatio}x, Payback ${financeMetrics.paybackMonths} mos, 5-Yr NPV/1k customers $${financeMetrics.npv5YrPer1k.toLocaleString()}.`
          : domain === "silicon"
          ? `SoC PPA Trade-Off Analysis on "${unitTitle}": Vdd=${vddMv}mV, Clock=${freqMhz}MHz, On-Chip SRAM=${sramTileKb}KB → P_dyn=${siliconMetrics.dynamicPowerW}W, P_leak=${siliconMetrics.leakagePowerW}W, Total=${siliconMetrics.totalPowerW}W, Frame Latency=${siliconMetrics.frameLatencyMs}ms (${siliconMetrics.withinXrEnvelope ? "PASSES <1.8W/<8ms XR envelope" : "Exceeds envelope"}).`
          : domain === "orbital_physics"
          ? `Hohmann Transfer & Vis-Viva Analysis on "${unitTitle}": r1=${r1AltKm}km LEO to r2=${r2AltKm}km → v1=${orbitalMetrics.v1Kms} km/s, Total Delta-v=${orbitalMetrics.totalDvKms} km/s, Transfer Time=${orbitalMetrics.transferHours} hrs.`
          : `Memory-Bandwidth Roofline Analysis on "${unitTitle}": ${paramsBillion}B model @ ${bitsPerWeight}-bit quantization on ${memBwGbs} GB/s bus → Footprint=${aiMetrics.vramGb} GB, Throughput=${aiMetrics.maxTokPerSec} tok/s (${aiMetrics.msPerToken} ms/tok).`;

      await apiRequest("POST", "/api/learn/portfolio-artifacts", {
        topicId,
        unitId,
        title: `${topicTitle}: ${unitTitle} — Quantitative Trade-Off Model`,
        artifactType,
        summary,
        metricsJson:
          domain === "finance_mba"
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="h-4 w-4 text-cyan-400" />
            Interactive First-Principles & Trade-Off Sandbox
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: "silicon", label: "Silicon PPA", icon: Cpu },
                { id: "finance_mba", label: "Alt-MBA / DCF", icon: TrendingUp },
                { id: "orbital_physics", label: "Physics / Orbital", icon: Rocket },
                { id: "ai_systems", label: "AI Roofline", icon: BrainCircuit },
              ] as const
            ).map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDomain(tab.id)}
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                    domain === tab.id
                      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400 font-medium"
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
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2 text-xs">
        {domain === "silicon" && (
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Explore CMOS power-performance-area ($P = C V_{"{dd}"}^2 f + P_{"{\\text{leak}}$"}) vs spatial frame latency for wearable XR silicon:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="flex justify-between">
                  <span>Supply $V_{"{dd}"}$:</span>
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
                      ? "border-emerald-500/40 text-emerald-400 text-[10px]"
                      : "border-red-500/40 text-red-400 text-[10px]"
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
              Alt-MBA Case & Capital Allocation Model — test how pricing power, gross margin, churn, and WACC compound cohort LTV:CAC and 5-year NPV:
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
                    financeMetrics.ltvCacRatio >= 3 ? "text-emerald-400" : "text-amber-400"
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
                    financeMetrics.npv5YrPer1k > 0 ? "text-emerald-400" : "text-red-400"
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
              Vis-Viva ($v^2 = \mu(2/r - 1/a)$) & Hohmann Orbital Transfer Explorer:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="flex justify-between">
                  <span>Initial Orbit Altitude ($r_1$):</span>
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
                  <span>Target Orbit Altitude ($r_2$):</span>
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
                <span className="text-[10px] text-muted-foreground block">Initial Circular $v_1$</span>
                <span className="text-sm font-bold">{orbitalMetrics.v1Kms} km/s</span>
              </div>
              <div className="rounded-md border border-border/70 bg-background/80 p-2">
                <span className="text-[10px] text-muted-foreground block">Total Hohmann $\Delta v$</span>
                <span className="text-sm font-bold text-cyan-400">{orbitalMetrics.totalDvKms} km/s</span>
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
              Memory-Bandwidth Roofline & Quantization Explorer for on-device / server inference:
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
                <span className="text-sm font-bold text-emerald-400">{aiMetrics.maxTokPerSec} tok/s</span>
              </div>
              <div className="rounded-md border border-border/70 bg-background/80 p-2">
                <span className="text-[10px] text-muted-foreground block">Inter-Token Latency</span>
                <span className="text-sm font-bold">{aiMetrics.msPerToken} ms/tok</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground">
            Save this model configuration as a verifiable deliverable in your Proof-of-Work Dossier.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
            disabled={saving}
            onClick={handleSaveArtifact}
            data-testid="button-save-sandbox-artifact"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkCheck className="h-3.5 w-3.5" />}
            Save to Proof-of-Work (+25 XP)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
