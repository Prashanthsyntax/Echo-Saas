"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  X,
  Send,
  Minimize2,
  Bot,
  User,
  Loader2,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "How do I record my screen?",
  "What's included in the Pro plan?",
  "How do AI transcripts work?",
  "Can I invite my team?",
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // focus input when chat opens
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    if (!hasGreeted) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hi! I'm Echo's assistant. I can help you record videos, share links, manage your workspace, and answer questions about pricing and features. What would you like to know?",
        },
      ]);
      setHasGreeted(true);
    }
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMessage: Message = { role: "user", content };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) throw new Error("Request failed");

      const data = await res.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.content ?? "Sorry, I couldn't get a response. Please try again.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again in a moment.",
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

  return (
    <>
      {/* chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 flex flex-col",
            "w-[380px] rounded-2xl border border-border",
            "bg-card shadow-2xl shadow-black/40",
            "transition-all duration-200",
            minimized ? "h-14" : "h-[520px]"
          )}
        >
          {/* header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium leading-none">
                  Echo Assistant
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Always here to help
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMinimized(!minimized)}
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2.5",
                      msg.role === "user" && "flex-row-reverse"
                    )}
                  >
                    {/* avatar */}
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
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
                        "max-w-[280px] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        msg.role === "assistant"
                          ? "rounded-tl-sm bg-secondary text-foreground"
                          : "rounded-tr-sm bg-primary text-primary-foreground"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* typing indicator */}
                {loading && (
                  <div className="flex gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-secondary px-4 py-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                )}

                {/* suggested questions — show only at start */}
                {messages.length === 1 && !loading && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground">
                      Suggested questions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* input */}
              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about Echo..."
                    className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Powered by Groq · Answers specific to Echo
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* floating trigger button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "flex h-14 w-14 items-center justify-center",
          "rounded-full bg-primary shadow-lg shadow-primary/25",
          "transition-all duration-200 hover:scale-105 hover:shadow-primary/40",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        )}
        aria-label={open ? "Close chat" : "Open Echo assistant"}
      >
        <div
          className={cn(
            "transition-all duration-200",
            open ? "rotate-90 scale-75" : "rotate-0 scale-100"
          )}
        >
          {open ? (
            <X className="h-6 w-6 text-primary-foreground" />
          ) : (
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          )}
        </div>

        {/* unread dot — shows before first open */}
        {!hasGreeted && (
          <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        )}
      </button>
    </>
  );
}