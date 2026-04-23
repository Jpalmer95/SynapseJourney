import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Zap, Brain, Map, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const features = [
  {
    icon: Zap,
    title: "Nebula Feed",
    description: "Discover knowledge through an engaging, swipeable feed optimized for curiosity rather than addiction.",
  },
  {
    icon: Brain,
    title: "AI Companion",
    description: "A Socratic AI tutor that guides your learning with questions, not just answers.",
  },
  {
    icon: Map,
    title: "3D Knowledge Map",
    description: "Visualize your learning journey as a beautiful 3D constellation of connected concepts.",
  },
  {
    icon: BookOpen,
    title: "Deep Dive Mode",
    description: "When curiosity strikes, dive into structured learning paths generated just for you.",
  },
];

export function LandingPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: any = { email, password };
      if (mode === "register") {
        body.firstName = firstName;
        body.lastName = lastName;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Authentication failed");
        setLoading(false);
        return;
      }

      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Synapse</span>
          </div>
          <Button variant="outline" onClick={() => document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" })}>
            Get Started
          </Button>
        </div>
      </header>

      <main>
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-violet-500 to-purple-600 bg-clip-text text-transparent">
                Learn Without Limits
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Bridge the gap between passive scrolling and active mastery. Synapse transforms how you discover and connect knowledge.
              </p>
            </motion.div>
          </div>
        </section>

        <section id="auth-section" className="py-20 px-4 bg-muted/30">
          <div className="max-w-md mx-auto">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-center">
                {mode === "login" ? "Welcome Back" : "Create Account"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>
                {mode === "register" && (
                  <>
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Jane"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                      />
                    </div>
                  </>
                )}
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "login" ? "Log In" : "Create Account"}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                {mode === "login" ? (
                  <span>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("register")}
                      className="text-primary hover:underline"
                    >
                      Sign up
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-primary hover:underline"
                    >
                      Log in
                    </button>
                  </span>
                )}
              </div>
            </Card>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                A New Way to Learn
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Synapse combines the best of social media engagement with deep, meaningful learning experiences.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover-elevate">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <feature.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                          <p className="text-muted-foreground">{feature.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Synapse - The Open Source Learning Platform
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built with curiosity in mind
          </p>
        </div>
      </footer>
    </div>
  );
}
