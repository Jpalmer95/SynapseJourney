import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ArrowRight, Compass, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import type { Topic } from "@shared/schema";

// Shape the /api/search endpoint returns per topic (flat topic + relations).
interface SearchTopic extends Topic {
  coordinate?: { x: number; y: number; z: number };
  neighbors?: { id: number; title: string; distance: number }[];
  category?: { name?: string };
}

interface SearchResponse {
  topics: SearchTopic[];
  lessons: unknown[];
  axes?: { x: string; y: string; z: string };
  mode: string;
}

interface HomeSearchProps {
  onDive: (topic: Topic) => void;
}

// Interpret the fixed semantic-axis labels (e.g. "Applied ↔ Theoretical") with
// the sign of the topic's projected coordinate, yielding a short orientation
// like "Applied · Synthetic · Macro". Unknown/faint signals fall back cleanly.
function interpretPosition(
  coord: { x: number; y: number; z: number },
  axes: { x: string; y: string; z: string }
): string {
  const splits = (label: string): [string, string] => {
    // Axis labels are authored with either a unicode ↔ or ASCII "<->"
    // separator (the seed/DB uses "<->"); accept both.
    const parts = label.split(/↔|<->/).map((s) => s.trim());
    return parts[1] ? [parts[0], parts[1]] : [label, label];
  };
  const pick = (val: number, label: string) => {
    const [pos, neg] = splits(label);
    return val >= 0 ? pos : neg;
  };
  return [pick(coord.x, axes.x), pick(coord.y, axes.y), pick(coord.z, axes.z)].join(" · ");
}

export function HomeSearch({ onDive }: HomeSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(trimmed)}`);
      const data: SearchResponse = await res.json();
      setResults(data);
      setOpen(true);
    } catch {
      setError(true);
      setResults(null);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 250);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  };

  const clear = () => {
    setQuery("");
    setResults(null);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const hasTopics = (results?.topics?.length ?? 0) > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <form onSubmit={onSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search any topic — e.g. 'how do neural networks learn'"
          className="pl-9 pr-9 h-11 bg-background/80 backdrop-blur border-border"
          data-testid="home-search-input"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl max-h-[70vh] overflow-y-auto"
          >
            {loading && (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            )}

            {!loading && error && (
              <div className="p-4 text-sm text-muted-foreground">
                Search is unavailable right now. Please try again.
              </div>
            )}

            {!loading && !error && !hasTopics && results && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No matches for “{query.trim()}”. Try a broader phrase.
              </div>
            )}

            {!loading && !error && hasTopics && (
              <ul className="py-1">
                {results!.topics.map((topic) => {
                  const neighbors = (topic.neighbors || [])
                    .filter((n) => n.title)
                    .slice(0, 2);
                  const orientation =
                    topic.coordinate && results!.axes
                      ? interpretPosition(topic.coordinate, results!.axes)
                      : null;
                  return (
                    <li key={topic.id}>
                      <button
                        onClick={() => {
                          onDive(topic);
                          clear();
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-start gap-3"
                        data-testid={`search-result-${topic.id}`}
                      >
                        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Compass className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{topic.title}</span>
                            <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                              {topic.difficulty}
                            </Badge>
                          </div>
                          {neighbors.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              Similar to {neighbors.map((n) => n.title).join(", ")}
                            </p>
                          )}
                          {orientation && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">
                              {orientation}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 mt-1 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && !error && (results?.lessons?.length ?? 0) > 0 && !hasTopics && (
              <div className="p-4 text-sm border-t border-border text-muted-foreground">
                Also found matching lessons — open a topic above to explore.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}