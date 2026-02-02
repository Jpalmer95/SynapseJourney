import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Send, Sparkles, User, Loader2, HelpCircle, Settings, Key, Server, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { Topic } from "@shared/schema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AiChatProps {
  topic?: Topic;
  onClose: () => void;
}

const suggestions = [
  "Explain this like I'm 5",
  "What are the key concepts?",
  "How is this used in real life?",
  "What should I learn next?",
];

export function AiChat({ topic, onClose }: AiChatProps) {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: topic
        ? `Hello! I'm your AI learning companion. I see you're exploring "${topic.title}". What would you like to know? I'm here to help you understand this topic better with Socratic questioning and clear explanations.`
        : "Hello! I'm your AI learning companion. I'm here to help you explore knowledge, answer questions, and guide your learning journey. What would you like to learn about today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showProviderSetup, setShowProviderSetup] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          topicId: topic?.id,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        // Check if this is a provider setup required error
        if (response.status === 402) {
          const errorData = await response.json();
          if (errorData.error === "CHAT_PROVIDER_REQUIRED") {
            setShowProviderSetup(true);
            setIsLoading(false);
            // Remove the user message we just added since we can't process it
            setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
            return;
          }
        }
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // Check for provider required error in SSE stream
                if (data.error === "CHAT_PROVIDER_REQUIRED") {
                  setShowProviderSetup(true);
                  setIsLoading(false);
                  // Remove the messages we just added
                  setMessages((prev) => prev.filter((m) => m.id !== userMessage.id && m.id !== assistantMessage.id));
                  return;
                }
                
                if (data.content) {
                  assistantContent += data.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I apologize, but I encountered an issue. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[400px] lg:w-[480px] bg-background border-l border-border flex flex-col"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">AI Companion</h2>
            <p className="text-sm text-muted-foreground">
              {topic ? `Learning: ${topic.title}` : "Ready to help"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-chat"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      {/* Provider Setup Overlay */}
      {showProviderSetup && (
        <div className="absolute inset-0 bg-background/95 z-10 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Key className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Set Up AI Chat</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            AI chat requires your own API credentials. Course content is always free, but for unlimited personal conversations, please configure one of these providers:
          </p>
          
          <div className="space-y-3 w-full max-w-xs mb-6">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Zap className="h-5 w-5 text-amber-500" />
              <div className="text-left">
                <p className="font-medium text-sm">Hugging Face</p>
                <p className="text-xs text-muted-foreground">Free tier available</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Server className="h-5 w-5 text-green-500" />
              <div className="text-left">
                <p className="font-medium text-sm">Ollama</p>
                <p className="text-xs text-muted-foreground">Run locally for free</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Zap className="h-5 w-5 text-blue-500" />
              <div className="text-left">
                <p className="font-medium text-sm">OpenRouter</p>
                <p className="text-xs text-muted-foreground">Many models available</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowProviderSetup(false)}
              data-testid="button-cancel-setup"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onClose();
                setLocation("/settings");
              }}
              data-testid="button-go-to-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Go to Settings
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback
                  className={cn(
                    message.role === "assistant"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted"
                  )}
                >
                  {message.role === "assistant" ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>

              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </motion.div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleSuggestion(suggestion)}
                data-testid={`button-suggestion-${suggestion.slice(0, 10).toLowerCase().replace(/\s/g, "-")}`}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            data-testid="button-send-message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
