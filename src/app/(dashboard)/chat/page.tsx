/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RagAnalytics } from "@/components/knowledge/rag-analytics";
import { cn } from "@/lib/utils";
import {
  Bot,
  User,
  Send,
  Loader2,
  Upload,
  Link2,
  FileText,
  Trash2,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  context_used?: boolean;
  model_used?: string;
  chunk_ids?: string[];
  feedback?: 1 | -1 | null;
  id: string;
}

interface Document {
  source: string;
  type: string;
  chunks: number;
}

interface IngestStatus {
  state: "idle" | "loading" | "success" | "error";
  message: string;
}

export default function ChatPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>({
    state: "idle",
    message: "",
  });
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showDocPanel, setShowDocPanel] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [feedbackSent, setFeedbackSent] = useState<Record<string, 1 | -1>>({});

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/rag/documents");
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      // service may be cold-starting
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const handleFeedback = async (msg: Message, rating: 1 | -1) => {
    if (feedbackSent[msg.id]) return;

    setFeedbackSent((prev) => ({ ...prev, [msg.id]: rating }));

    await fetch("/api/rag/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: messages[messages.indexOf(msg) - 1]?.content ?? "",
        answer: msg.content,
        sources: msg.sources ?? [],
        rating,
        chunkIds: msg.chunk_ids ?? [],
        modelUsed: msg.model_used ?? "echo-nemo-1.0",
      }),
    });
  };

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    // fixed: user messages now have a unique id
    const userMsg: Message = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content,
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: content,
          history: messages.slice(-6),
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: data.answer ?? "No response.",
          sources: data.sources ?? [],
          context_used: data.context_used ?? false,
          model_used: data.model_used,
          chunk_ids: data.chunk_ids ?? [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content: "Something went wrong. Please try again.",
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIngestStatus({
      state: "loading",
      message: `Processing ${file.name}...`,
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setIngestStatus({
          state: "error",
          message: data.error ?? "Upload failed",
        });
        return;
      }

      setIngestStatus({
        state: "success",
        message: `✓ ${file.name} — ${data.ingested} chunks indexed`,
      });
      await fetchDocuments();
      setTimeout(() => setIngestStatus({ state: "idle", message: "" }), 4000);
    } catch {
      setIngestStatus({
        state: "error",
        message: "Upload failed — is the RAG service running?",
      });
    }

    e.target.value = "";
  };

  const handleUrlIngest = async () => {
    const url = urlInput.trim();
    if (!url) return;

    setIngestStatus({ state: "loading", message: `Fetching ${url}...` });
    setShowUrlInput(false);

    try {
      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setIngestStatus({
          state: "error",
          message: data.error ?? "URL fetch failed",
        });
        return;
      }

      setIngestStatus({
        state: "success",
        message: `✓ ${url} — ${data.ingested} chunks indexed`,
      });
      setUrlInput("");
      await fetchDocuments();
      setTimeout(() => setIngestStatus({ state: "idle", message: "" }), 4000);
    } catch {
      setIngestStatus({ state: "error", message: "Failed to fetch URL" });
    }
  };

  const handleDeleteDoc = async (source: string) => {
    if (!confirm(`Remove "${source}" from your knowledge base?`)) return;

    try {
      const res = await fetch("/api/rag/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Failed to delete: ${data.error ?? "Unknown error"}`);
        return;
      }

      if (data.remaining > 0) {
        alert(
          `Warning: ${data.remaining} chunks still remain for this document. Try refreshing and deleting again.`,
        );
      }

      setDocuments((prev) => prev.filter((d) => d.source !== source));
      await fetchDocuments(); // re-fetch to confirm actual state
    } catch {
      alert(
        "Could not reach the RAG service. It may be cold-starting — wait 10s and try again.",
      );
    }
  };

  const totalChunks = documents.reduce((sum, d) => sum + d.chunks, 0);

  const typeIcon: Record<string, string> = {
    pdf: "📄",
    docx: "📝",
    doc: "📝",
    csv: "📊",
    txt: "📋",
    md: "📋",
    url: "🔗",
    transcript: "🎥",
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Document panel */}
      {showDocPanel && (
        <div
          className="flex w-72 shrink-0 flex-col border-r border-white/5"
          style={{ backgroundColor: "rgba(255,255,255,0.01)" }}
        >
          {/* panel header */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-white/30" />
              <p className="text-xs font-semibold text-white">Knowledge base</p>
            </div>
            <Badge
              className="border-0 text-[10px]"
              style={{
                backgroundColor: "rgba(139,92,246,0.15)",
                color: "#a78bfa",
              }}
            >
              {totalChunks} chunks
            </Badge>
          </div>

          {/* ingest actions */}
          <div className="space-y-2 border-b border-white/5 p-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.csv,.txt,.md"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={ingestStatus.state === "loading"}
              className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 text-xs text-white/50 transition-colors hover:border-white/15 hover:text-white/80 disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              Upload file (PDF, DOCX, CSV, TXT)
            </button>

            {showUrlInput ? (
              <div className="space-y-1.5">
                <input
                  autoFocus
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlIngest()}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-primary/50 focus:outline-none"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleUrlIngest}
                    disabled={!urlInput.trim()}
                    className="flex-1 rounded-lg bg-primary/20 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 disabled:opacity-40"
                  >
                    Add URL
                  </button>
                  <button
                    onClick={() => {
                      setShowUrlInput(false);
                      setUrlInput("");
                    }}
                    className="rounded-lg px-2 py-1.5 text-xs text-white/30 hover:text-white/60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowUrlInput(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 text-xs text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                Add URL / webpage
              </button>
            )}

            {/* ingest status */}
            {ingestStatus.state !== "idle" && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                  ingestStatus.state === "loading" && "text-white/40",
                  ingestStatus.state === "success" && "text-emerald-400",
                  ingestStatus.state === "error" && "text-red-400",
                )}
                style={{
                  backgroundColor:
                    ingestStatus.state === "success"
                      ? "rgba(52,211,153,0.08)"
                      : ingestStatus.state === "error"
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(255,255,255,0.04)",
                }}
              >
                {ingestStatus.state === "loading" && (
                  <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" />
                )}
                {ingestStatus.state === "success" && (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                )}
                {ingestStatus.state === "error" && (
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                )}
                <span>{ingestStatus.message}</span>
              </div>
            )}
          </div>

          {/* document list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {docsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-white/20" />
              </div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-white/20">No documents yet</p>
                <p className="mt-1 text-[11px] text-white/10">
                  Upload files or add URLs above
                </p>
              </div>
            ) : (
              documents.map((doc, index) => (
                <div
                  key={`${doc.source}-${doc.type}-${index}`}
                  className="group flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5"
                >
                  <span className="mt-0.5 text-sm shrink-0">
                    {typeIcon[doc.type] ?? "📄"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-white/60">
                      {doc.source.length > 30
                        ? doc.source.slice(0, 27) + "..."
                        : doc.source}
                    </p>
                    <p className="text-[10px] text-white/25">
                      {doc.chunks} chunks
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteDoc(doc.source)}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-white/10 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="px-3 pb-3">
            <RagAnalytics />
          </div>

          {/* model badge */}
          <div className="border-t border-white/5 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <p className="text-[10px] font-medium text-white/30">
                echo-nemo-1.0
              </p>
              <span className="text-[10px] text-white/15">·</span>
              <p className="text-[10px] text-white/15">
                Groq Llama 3.3 70B + Chroma RAG
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* chat header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDocPanel(!showDocPanel)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                showDocPanel
                  ? "bg-white/8 text-white/60"
                  : "text-white/30 hover:bg-white/5 hover:text-white/60",
              )}
            >
              <Database className="h-3.5 w-3.5" />
              {showDocPanel ? "Hide" : "Show"} knowledge base
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className="gap-1 border-0 text-[10px]"
              style={{
                backgroundColor: "rgba(139,92,246,0.12)",
                color: "#a78bfa",
              }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              echo-nemo-1.0
            </Badge>
            {documents.length > 0 && (
              <Badge
                className="border-0 text-[10px]"
                style={{
                  backgroundColor: "rgba(52,211,153,0.1)",
                  color: "#34d399",
                }}
              >
                {documents.length} source{documents.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.length === 0 && (
              <div className="py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-white/3">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h2 className="mt-5 text-base font-semibold text-white">
                  echo-nemo-1.0
                </h2>
                <p className="mt-2 text-sm text-white/30">
                  Ask me anything about your uploaded documents.
                  <br />
                  {documents.length === 0
                    ? "Start by uploading a file or adding a URL on the left."
                    : `${documents.length} source${documents.length !== 1 ? "s" : ""} in your knowledge base.`}
                </p>

                {documents.length === 0 && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
                    >
                      <Upload className="h-4 w-4" />
                      Upload your first document
                    </button>
                    <button
                      onClick={() => setShowUrlInput(true)}
                      className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
                    >
                      <Link2 className="h-4 w-4" />
                      Add a URL
                    </button>
                  </div>
                )}

                {documents.length > 0 && (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {[
                      "What are the main topics covered?",
                      "Summarise the key points",
                      "What does this document say about...",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="rounded-full border border-white/8 bg-white/3 px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/15 hover:text-white/70"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" && "flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    msg.role === "assistant" ? "bg-primary/10" : "bg-white/8",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-white/40" />
                  )}
                </div>

                <div className="max-w-[520px] space-y-2">
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "assistant"
                        ? "rounded-tl-sm border border-white/5 text-white/80"
                        : "rounded-tr-sm bg-primary text-white",
                    )}
                    style={
                      msg.role === "assistant"
                        ? { backgroundColor: "rgba(255,255,255,0.04)" }
                        : undefined
                    }
                  >
                    {msg.content}
                  </div>

                  {/* sources */}
                  {msg.role === "assistant" &&
                    msg.sources &&
                    msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {msg.sources.map((src) => (
                          <span
                            key={src}
                            className="flex items-center gap-1 rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-white/25"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            {src.length > 30 ? src.slice(0, 27) + "..." : src}
                          </span>
                        ))}
                      </div>
                    )}

                  {/* feedback buttons — only on assistant messages with context */}
                  {msg.role === "assistant" && msg.context_used && (
                    <div className="flex items-center gap-2 px-1">
                      <p className="text-[10px] text-white/15">
                        Was this helpful?
                      </p>
                      <button
                        onClick={() => handleFeedback(msg, 1)}
                        disabled={!!feedbackSent[msg.id]}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs transition-colors",
                          feedbackSent[msg.id] === 1
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "text-white/20 hover:bg-white/5 hover:text-white/50 disabled:opacity-30",
                        )}
                        title="Good answer"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleFeedback(msg, -1)}
                        disabled={!!feedbackSent[msg.id]}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs transition-colors",
                          feedbackSent[msg.id] === -1
                            ? "bg-red-500/20 text-red-400"
                            : "text-white/20 hover:bg-white/5 hover:text-white/50 disabled:opacity-30",
                        )}
                        title="Bad answer"
                      >
                        👎
                      </button>
                      {feedbackSent[msg.id] && (
                        <span className="text-[10px] text-white/20">
                          {feedbackSent[msg.id] === 1
                            ? "Thanks — boosting these sources"
                            : "Got it — reducing these sources"}
                        </span>
                      )}
                    </div>
                  )}

                  {msg.role === "assistant" && msg.model_used && (
                    <p className="px-1 text-[10px] text-white/15">
                      via {msg.model_used}
                    </p>
                  )}

                  {/* no context indicator */}
                  {msg.role === "assistant" && msg.context_used === false && (
                    <p className="px-1 text-[10px] text-white/20">
                      ⚠ No relevant context found in your knowledge base
                    </p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div
                  className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/5 px-4 py-3"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                >
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/30 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/30 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/30" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* input */}
        <div className="border-t border-white/5 px-6 py-4">
          <div className="mx-auto max-w-2xl">
            <div
              className="flex items-end gap-3 rounded-xl border border-white/8 px-4 py-3"
              style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask anything about your documents..."
                className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm text-white shadow-none placeholder:text-white/20 focus-visible:ring-0"
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
            <p className="mt-2 text-center text-[10px] text-white/15">
              echo-nemo-1.0 answers only from your documents · Powered by Groq
              Llama 3.3 70B + Chroma RAG
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
