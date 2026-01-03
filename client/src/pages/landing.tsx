import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Zap, Brain, Map, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
          <a href="/api/login">
            <Button data-testid="button-login">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
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
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="/api/login">
                  <Button size="lg" className="gap-2" data-testid="button-start-learning">
                    Start Learning
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </a>
                <Button variant="outline" size="lg" data-testid="button-learn-more">
                  Learn More
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-20 px-4 bg-muted/30">
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

        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Ready to Transform Your Learning?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of curious minds already exploring with Synapse.
              </p>
              <a href="/api/login">
                <Button size="lg" className="gap-2" data-testid="button-get-started-bottom">
                  Get Started Free
                  <Sparkles className="h-5 w-5" />
                </Button>
              </a>
            </motion.div>
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
