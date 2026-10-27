import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Brain,
  Map,
  BookOpen,
  Layers,
  FlaskConical,
  ArrowRight,
  Network,
  GraduationCap,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Topic } from "@shared/schema";

const features = [
  {
    icon: Zap,
    title: "Rapid bootstrap",
    description:
      "Need it today? Generate a 3–5 unit run that gets a project unblocked, with the exact steps and sources you need — no filler history.",
  },
  {
    icon: Layers,
    title: "Foundational underlayment",
    description:
      "Going deep on orbital mechanics, EE, or physics? Build a 20–30 unit foundation tier by tier, anchored to real textbooks, OCW courses, and lecture series.",
  },
  {
    icon: Brain,
    title: "Cross-domain synthesis",
    description:
      "Fuse two or more fields into one course with a capstone that only makes sense with all of them — then apply it to live SOTA bottlenecks.",
  },
  {
    icon: Map,
    title: "3D knowledge graph",
    description:
      "Every unit you finish projects into your personal semantic map, so progress compounds visibly instead of disappearing into a feed.",
  },
  {
    icon: FlaskConical,
    title: "Open science commons",
    description:
      "Turn what you learn into falsifiable hypotheses against real frontier roadblocks — reviewed by peers or your own agent.",
  },
  {
    icon: BookOpen,
    title: "Agent-native",
    description:
      "Connect Hermes, Claude, or Cursor over MCP: your agent teaches you unit by unit and uploads new courses to the shared corpus.",
  },
];

const steps = [
  {
    title: "Say what you need to learn",
    body: "A goal in your own words — “deploy a Next.js app to production”, “actually understand orbital mechanics”, “fuse immunology and ML”. No catalog hunting.",
  },
  {
    title: "Learn unit by unit",
    body: "Concept, analogy, worked example, quiz, and the sources behind it. Go as deep as the tier you picked, or jump straight to what you need.",
  },
  {
    title: "Watch the network densify",
    body: "Each finished unit adds nodes and edges to your map. That growing density is the point — it is what makes the next topic faster to learn.",
  },
];

export function LandingPage() {
  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
    staleTime: 5 * 60 * 1000,
  });

  const sampleTopics = topics.slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2" aria-label="Synapse home">
            <div className="p-2 rounded-md bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold">Synapse</span>
          </a>

          <nav aria-label="Landing" className="hidden md:flex items-center gap-1">
            {[
              { href: "#how", label: "How it works" },
              { href: "#catalog", label: "Catalog" },
              { href: "#features", label: "Features" },
              { href: "/agents", label: "For agents" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href="/signin">Sign in</a>
            </Button>
            <Button asChild size="sm">
              <a href="/signup">Get started</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="pt-16 pb-12 md:pt-24 md:pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge variant="outline" className="mb-6 text-xs">
                Open source · BYOC · agent-native
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">
                Learn anything —{" "}
                <span className="bg-gradient-to-r from-primary via-violet-500 to-purple-600 bg-clip-text text-transparent">
                  breadthwise, depthwise, or laser-focused
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                Synapse builds the course you actually need: a fast route to one unblocked problem, a
                twenty-unit foundation, or a synthesis of two fields that has never been taught together.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <a href="/signup">
                    Start learning free
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <a href="#catalog">Browse the catalog</a>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Free to browse and read. AI generation runs on your own provider keys — you are never
                billed for someone else's compute.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Synaptodendrogenesis — the word the platform is named after */}
        <section className="pb-16 md:pb-24 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Card
                className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-violet-500/10"
                data-testid="synaptodendrogenesis-card"
              >
                <CardContent className="p-8 md:p-12 text-center">
                  <Network className="mx-auto mb-6 h-8 w-8 text-primary" aria-hidden="true" />
                  <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">
                    The word behind the platform
                  </p>
                  <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 break-words">
                    Synaptodendrogenesis
                  </h2>
                  <p className="text-lg md:text-xl font-medium mb-6">The essence of your journey in Synapse.</p>
                  <blockquote className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto italic leading-relaxed">
                    “The simultaneous proliferation of neural branches (dendrites) and the formation of new
                    connection points (synapses), resulting in a denser and more complex neural network.”
                  </blockquote>
                  <p className="mt-6 text-sm text-muted-foreground max-w-xl mx-auto">
                    A course is not a checklist of facts. It is new branches and new junctions — and the
                    density is what makes the next thing easier to learn.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-16 md:py-24 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">How it works</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Three steps, no onboarding maze.</p>
            </div>
            <ol className="grid md:grid-cols-3 gap-6">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <Card className="h-full">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold">
                          {index + 1}
                        </span>
                        <h3 className="text-lg font-semibold">{step.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Catalog preview */}
        <section id="catalog" className="py-16 md:py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">In the catalog right now</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {topics.length > 0
                  ? `${topics.length} courses are open — from physics foundations to open-science bottlenecks.`
                  : "Courses are open across physics, biology, engineering and open-science bottlenecks."}
              </p>
            </div>

            {sampleTopics.length > 0 && (
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10" data-testid="landing-catalog">
                {sampleTopics.map((topic) => (
                  <li key={topic.id}>
                    <a
                      href={`/signin?next=${encodeURIComponent("/explore")}`}
                      className="block h-full rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:bg-muted/40 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold leading-snug">{topic.title}</h3>
                        <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                          {topic.difficulty || "course"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">{topic.description}</p>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <div className="text-center">
              <Button asChild variant="outline" size="lg">
                <a href="/signup">
                  <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
                  Create your account to open the full catalog
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 md:py-24 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">Four ways in, one growing map</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Every course type keeps its own shape — a fast bootstrap should not read like a textbook, and a
                foundation should not read like a checklist.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card className="h-full">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <feature.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                          <p className="text-muted-foreground text-sm">{feature.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Agent-native */}
        <section id="agents" className="py-16 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border border-border bg-card/50 p-6 md:p-8">
              <Badge variant="outline" className="mb-4 text-xs gap-1">
                <Bot className="h-3 w-3" aria-hidden="true" /> Agent-native
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Bring your own agent. It teaches, the platform remembers.
              </h2>
              <p className="text-muted-foreground mb-5">
                Every course is served through an MCP server, so Claude, Cursor, or your own Hermes agent can walk you
                through it unit by unit — same content the site renders, same progress the site tracks. Agents can also
                author a course with their own model compute and upload it; the quality gate decides what enters the
                public catalogue.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="sm">
                  <a href="/agents">
                    Connect your agent
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href="/.well-known/synapse.json" target="_blank" rel="noreferrer">
                    Discovery document
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Start with one honest question</h2>
            <p className="text-lg text-muted-foreground mb-8">
              What do you need to understand next? That is the whole intake form.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <a href="/signup">
                  Create free account
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
                <a href="/signin">I already have one</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">Synapse — The Open Source Learning Platform</span>
          </div>
          <nav aria-label="Footer" className="flex items-center gap-4 text-sm text-muted-foreground">
            <a className="hover:text-foreground py-1" href="/signin">
              Sign in
            </a>
            <a className="hover:text-foreground py-1" href="/signup">
              Create account
            </a>
            <a className="hover:text-foreground py-1" href="/agents">
              For agents
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
