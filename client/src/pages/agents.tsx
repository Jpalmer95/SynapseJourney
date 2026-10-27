import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bot, KeyRound, Plug, BookOpenCheck, Terminal, Check, ArrowRight, ShieldCheck, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(code)}
          className="text-xs text-primary hover:underline"
        >
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-xs leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const hermesConfig = `# 1) create a token at /settings, then:
echo 'SYNAPSE_PAT=sj_your_token' >> ~/.hermes/.env
export SYNAPSE_BASE_URL=https://synapsejourney.org

# 2) verify
curl -sS -H "Authorization: Bearer $SYNAPSE_PAT" \\
  $SYNAPSE_BASE_URL/api/auth/user`;

const mcpConfig = `{
  "mcpServers": {
    "synapse": {
      "type": "http",
      "url": "https://synapsejourney.org/api/mcp",
      "headers": { "Authorization": "Bearer sj_your_token" }
    }
  }
}`;

const teachPrompt = `Using the synapse MCP server:
1. synapse.list_courses — show me what is published.
2. Pick the one matching "<my goal>" and call synapse.get_course.
3. Teach it to me one unit at a time, Socratic, and quiz me
   with that unit's questions before moving on.
4. At the end, log what I found to synapse.submit_hypothesis.`;

export default function AgentsPage() {
  const { data: topics } = useQuery<any[]>({ queryKey: ["/api/topics"] });
  const count = Array.isArray(topics) ? topics.length : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="mb-10">
          <Badge variant="outline" className="mb-4 gap-1">
            <Bot className="h-3 w-3" /> Agent-native
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">Teach it to me</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            SynapseJourney is built so an agent can be your tutor against a real curriculum. Your model does the
            teaching and authoring; the platform stores the courses, tracks what you actually finished, and keeps a 3D
            map of everything you have touched. No platform AI credits are spent on you.
          </p>
          {count > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {count} published course{count === 1 ? "" : "s"} in the commons right now.
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: KeyRound,
              title: "1. Get a token",
              body: "Sign in, open Settings, create a personal access token (sj_…). It is shown once.",
            },
            {
              icon: Plug,
              title: "2. Point your agent at MCP",
              body: "One HTTP endpoint, eight tools: list, search, read, ingest, bottlenecks, hypotheses, map.",
            },
            {
              icon: BookOpenCheck,
              title: "3. Learn unit by unit",
              body: "The agent reads the course plan and teaches from the same rows the site renders — one source of truth.",
            },
          ].map((s) => (
            <Card key={s.title} className="border-border/70 bg-card/50">
              <CardContent className="p-5">
                <s.icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 space-y-6">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
              <Terminal className="h-5 w-5" /> Hermes Agent
            </h2>
            <CodeBlock title="shell" code={hermesConfig} />
            <p className="mt-2 text-sm text-muted-foreground">
              Install the companion skill so your agent knows the archetype contract and the upload rules:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">git clone https://github.com/Jpalmer95/synapse-learn ~/.hermes/skills/synapse-learn</code>
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-xl font-semibold">Any MCP client (Claude Desktop, Cursor, custom)</h2>
            <CodeBlock title="mcp config" code={mcpConfig} />
            <p className="mt-2 text-sm text-muted-foreground">
              Remote servers that need custom headers can be bridged with{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">npx mcp-remote</code> if your client does not
              support header auth directly.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-xl font-semibold">What to ask for</h2>
            <CodeBlock title="prompt" code={teachPrompt} />
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Card className="border-border/70 bg-card/50">
            <CardContent className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Quality gate</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Every uploaded course is scored before it lands: template prose, repeated quiz questions, placeholder
                resource links, and prose outside the archetype band are rejected. Published courses are reviewed;
                your own courses stay private until they pass.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/50">
            <CardContent className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <Map className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">One corpus, no regeneration</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                A course published by anyone is available to everyone — take it, extend it with your own units, or
                fork a niche variant. Course text is CC BY-SA 4.0; the platform is Apache-2.0.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/explore">
            <Button className="gap-2">
              Browse the catalogue <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline">Create a token</Button>
          </Link>
          <a href="/.well-known/synapse.json" target="_blank" rel="noreferrer">
            <Button variant="ghost" className="gap-2">
              <Check className="h-4 w-4" /> Discovery document
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
