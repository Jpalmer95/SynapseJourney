import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wallet,
  Sparkles,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Receipt,
  ChevronDown,
  ChevronUp,
  Cpu,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CreditStatusResponse {
  creditsInferenceConfigured: boolean;
  stripeConfigured: boolean;
  markupMultiplier: number;
  packs: {
    id: "starter_5" | "scholar_15" | "research_40";
    name: string;
    priceCents: number;
    priceUsd: number;
    creditMicros: number;
    badge?: string;
    tagline: string;
    estimates: string[];
  }[];
  modeRouting: {
    mode: string;
    label: string;
    model: string;
    fallbackModel: string;
    maxTokensCap: number;
    description: string;
    estTypicalCallUsd: number;
  }[];
  balance: {
    balanceMicros: number;
    balanceUsd: number;
    reservedMicros: number;
    lifetimePurchasedMicros: number;
    lifetimeSpentMicros: number;
    creditTierPreference: "economy" | "balanced" | "frontier";
  } | null;
  transactions: {
    id: number;
    kind: string;
    amountMicros: number;
    amountUsd: number;
    balanceAfterUsd: number;
    mode: string | null;
    modelUsed: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    description: string | null;
    createdAt: string;
  }[];
}

export function CreditsWalletCard() {
  const { toast } = useToast();
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showRouting, setShowRouting] = useState(true);

  const { data, isLoading } = useQuery<CreditStatusResponse>({
    queryKey: ["/api/credits/status"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("credits_purchase");
    if (status === "success") {
      toast({
        title: "Prepaid Credits Added!",
        description: "Your Stripe payment succeeded and your credit balance has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/status"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (status === "cancelled") {
      toast({
        title: "Checkout Cancelled",
        description: "No charge was made. Remember: reading & BYOC/BYOS remain 100% free.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const tierMutation = useMutation({
    mutationFn: async (tier: "economy" | "balanced" | "frontier") => {
      const res = await apiRequest("PUT", "/api/credits/tier", { tier });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits/status"] });
      toast({ title: "Credit model tier updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Could not update tier",
        description: err?.message || "Please sign in first.",
        variant: "destructive",
      });
    },
  });

  const handleBuyPack = async (packId: string) => {
    setBuyingPackId(packId);
    try {
      const res = await apiRequest("POST", "/api/credits/checkout", { packId });
      const payload = await res.json();
      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
      }
    } catch (err: any) {
      toast({
        title: "Checkout unavailable",
        description:
          err?.message ||
          "Stripe prepaid checkout is not activated yet. You can connect your own free/BYOC key above for $0 platform cost.",
        variant: "destructive",
      });
    } finally {
      setBuyingPackId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Prepaid Credits wallet…
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;
  const activeTier = data.balance?.creditTierPreference || "balanced";

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-background to-cyan-500/5" data-testid="card-prepaid-credits">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 flex-wrap">
              <Wallet className="h-5 w-5 text-emerald-500" />
              <span>Optional Prepaid AI Credits (Zero-Setup Pay-As-You-Go)</span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">
                No Subscription · Never Expires
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Reading all courses and connecting your own AI key/subscription (BYOC/BYOS above) is <strong>always 100% free</strong>. Prepaid Credits are purely optional for learners who want instant Socratic/Feynman tutoring, MATLAB/Mathematica translation, and custom STEM course creation without setting up external API keys.
            </CardDescription>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-background/90 px-3.5 py-2 text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              Current Balance
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-credit-balance">
              ${(data.balance?.balanceUsd ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Priority Guarantee */}
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            <strong>Zero-Surprise Billing:</strong> Your own connected BYOC/BYOS provider above is always used first ($0 credits spent) unless you choose <em>Synapse Credits</em>. Credits deduct exact per-call token usage automatically, never auto-renew, and refund 100% if an upstream call errors.
          </span>
        </div>

        {/* Prepaid Packs */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              One-Time Prepaid Packs (via Stripe)
            </h4>
            {!data.stripeConfigured && (
              <Badge variant="secondary" className="text-[10px]">
                Checkout activating soon — BYOC / Free AI Studio active now
              </Badge>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.packs.map((pack) => (
              <div
                key={pack.id}
                className={cn(
                  "rounded-lg border p-3.5 flex flex-col justify-between gap-3 bg-background/80",
                  pack.badge ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : "border-border/80",
                )}
                data-testid={`credit-pack-${pack.id}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{pack.name}</span>
                    {pack.badge && (
                      <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        {pack.badge}
                      </Badge>
                    )}
                  </div>
                  <div className="text-2xl font-bold">${pack.priceUsd.toFixed(0)}</div>
                  <p className="text-[11px] text-muted-foreground">{pack.tagline}</p>
                  <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                    {pack.estimates.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
                <Button
                  size="sm"
                  variant={pack.badge ? "default" : "outline"}
                  disabled={!data.stripeConfigured || buyingPackId === pack.id}
                  onClick={() => handleBuyPack(pack.id)}
                  className="w-full h-8 text-xs gap-1.5"
                  data-testid={`button-buy-${pack.id}`}
                >
                  {buyingPackId === pack.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  <span>{data.stripeConfigured ? `Buy $${pack.priceUsd} Pack` : "Stripe Setup Pending"}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Mode-Based OpenRouter Model Routing Table */}
        <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowRouting((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
            >
              <Cpu className="h-3.5 w-3.5 text-primary" />
              <span>Preselected Mode-Based Models (OpenRouter)</span>
              {showRouting ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">Tutor Quality:</span>
              {(["economy", "balanced", "frontier"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  disabled={tierMutation.isPending}
                  onClick={() => tierMutation.mutate(tier)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border capitalize transition-colors",
                    activeTier === tier
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`button-credit-tier-${tier}`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {showRouting && (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.modeRouting.map((m) => (
                <div key={m.mode} className="rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{m.label}</span>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      ~${m.estTypicalCallUsd.toFixed(4)}/call
                    </Badge>
                  </div>
                  <div className="font-mono text-[11px] text-primary flex items-center gap-1">
                    <Sparkles className="h-3 w-3 shrink-0" />
                    <span className="truncate">{m.model}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{m.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transparent Usage Ledger */}
        {data.transactions && data.transactions.length > 0 && (
          <div className="border-t border-border/60 pt-2">
            <button
              type="button"
              onClick={() => setShowLedger((v) => !v)}
              className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1"
              data-testid="button-toggle-credit-ledger"
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Recent Credit Activity ({data.transactions.length})
              </span>
              {showLedger ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showLedger && (
              <div className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {data.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate">
                        {tx.description || tx.mode || tx.kind}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {tx.modelUsed ? `${tx.modelUsed} · ` : ""}
                        {tx.promptTokens != null && tx.completionTokens != null
                          ? `${tx.promptTokens + tx.completionTokens} tok · `
                          : ""}
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span
                        className={
                          tx.amountMicros >= 0 ? "text-emerald-500 font-semibold" : "text-muted-foreground"
                        }
                      >
                        {tx.amountMicros >= 0 ? "+" : ""}${tx.amountUsd.toFixed(4)}
                      </span>
                      <div className="text-[10px] text-muted-foreground">
                        bal ${tx.balanceAfterUsd.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
