/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Metadata } from "next";
export const metadata: Metadata = { title: "Ask Chat" };
import { useState, useRef, useEffect } from "react";
import { graphStore } from "@/lib/graph-store";
import type { KnowledgeGraph } from "@/components/knowledge/knowledge-types";
import { NODE_COLORS } from "@/components/knowledge/knowledge-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Bot,
  User,
  Send,
  Loader2,
  Network,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED: Record<string, string[]> = {
  general: [
    "What are the main themes in this document?",
    "Which concept is most central to this graph?",
    "Summarise the key relationships",
    "What are the most important entities?",
  ],
  deeper: [
    "How are the top 3 concepts connected?",
    "What processes are described?",
    "Are there any clusters of related concepts?",
    "What's the relationship between technology and process nodes?",
  ],
};

export default function ChatPage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(
    () => graphStore.get()
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestionSet, setSuggestionSet] = useState<"general" | "deeper">(
    "general"
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // subscribe to graph store changes (if user navigates to knowledge page and uploads)
  useEffect(() => {
    const unsub = graphStore.subscribe((g) => setGraph(g));
    return unsub;
  }, []);

  // scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // auto-greeting when graph first loads
  useEffect(() => {
    if (graph && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `I've loaded the knowledge graph for **"${graph.title}"** — ${graph.nodes.length} nodes and ${graph.edges.length} relationships extracted. Ask me anything about the concepts, relationships, or structure of this document.`,
        },
      ]);
    }
  }, [graph, messages.length]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading || !graph) return;

    const userMessage: Message = { role: "user", content };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setLoading(true);

    // switch to deeper suggestions after first exchange
    if (messages.length >= 2) setSuggestionSet("deeper");

    try {
      const res = await fetch("/api/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, graph }),
      });

      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.content ?? "Sorry, I couldn't generate a response.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // No graph loaded — show prompt to upload
  if (!graph) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card">
          <Network className="h-9 w-9 text-muted-foreground" />
        </div>
        <div className="max-w-sm text-center">
          <h2 className="text-lg font-semibold">No knowledge graph loaded</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload a PDF in the Knowledge section first. The graph will be
            available here automatically once extracted.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/knowledge">
            <Network className="h-4 w-4" />
            Go to Knowledge
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  // count node types for the graph summary strip
  const typeCounts = graph.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <h1 className="truncate text-sm font-semibold">
                Chat with your knowledge graph
              </h1>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {graph.title}
            </p>
          </div>
          <div className="ml-4 flex shrink-0 flex-wrap gap-1.5">
            {Object.entries(typeCounts)
              .slice(0, 4)
              .map(([type, count]) => (
                <Badge
                  key={type}
                  variant="secondary"
                  className="gap-1 text-[10px]"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        NODE_COLORS[type as keyof typeof NODE_COLORS],
                    }}
                  />
                  {count} {type}
                  {count !== 1 ? "s" : ""}
                </Badge>
              ))}
          </div>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              {/* avatar */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  msg.role === "assistant"
                    ? "bg-primary/10"
                    : "bg-secondary"
                )}
              >
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4 text-primary" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* bubble */}
              <div
                className={cn(
                  "max-w-[520px] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "assistant"
                    ? "rounded-tl-sm bg-card text-foreground border border-border"
                    : "rounded-tr-sm bg-primary text-primary-foreground"
                )}
              >
                {msg.content.split("**").map((part, j) =>
                  j % 2 === 1 ? (
                    <strong key={j}>{part}</strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </div>
            </div>
          ))}

          {/* typing indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}

          {/* suggested questions */}
          {!loading && messages.length < 6 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {suggestionSet === "general"
                  ? "Try asking:"
                  : "Dig deeper:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED[suggestionSet].map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* graph context strip */}
      <div className="border-t border-border bg-card/30 px-6 py-2">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Context: {graph.nodes.length} nodes · {graph.edges.length}{" "}
              relationships
            </p>
          </div>
          <button
            onClick={() => {
              setMessages([]);
              setSuggestionSet("general");
            }}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear chat
          </button>
        </div>
      </div>

      {/* input */}
      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your knowledge graph..."
              className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              rows={1}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Answers grounded in your uploaded document · Powered by Groq
            Llama 3.3
          </p>
        </div>
      </div>
    </div>
  );
}