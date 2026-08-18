/* eslint-disable react-hooks/purity */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bot,
  User,
  Send,
  Loader2,
  Upload,
  Link2,
  FileText,
  Trash2,
  Database,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  useChatPersistence,
  type PersistedMessage,
} from "@/hooks/use-chat-persistence";
import { RagAnalytics } from "@/components/knowledge/rag-analytics";
import { useWorkspace } from "@/lib/workspace-context";

interface Document {
  source: string;
  type: string;
  chunks: number;
}

export default function ChatPage() {
  const { workspaceId } = useWorkspace();

  // persistence hook — replaces manual useState for messages
  const {
    messages,
    setMessages,
    loading: sessionLoading,
    saving,
    saveUserMessage,
    saveAssistantMessage,
    saveFeedback,
    clearSession,
  } = useChatPersistence();

  const [input, setInput] = useState("");
  const [querying, setQuerying] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [ragStatus, setRagStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showDocPanel, setShowDocPanel] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 1 | -1>>({});
  const [userRole, setUserRole] = useState<string>("VIEWER");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!workspaceId) return;
    fetch("/api/workspaces")
      .then(r => r.json())
      .then(d => {
        const ws = d.workspaces?.find((w: any) => w.workspace.id === workspaceId);
        if (ws) setUserRole(ws.role);
      })
      .catch(() => {});
  }, [workspaceId]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/rag/documents", {
        headers: {
          "x-workspace-id": workspaceId ?? "",
        },
      });
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
    } finally {
      setDocsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, querying]);

  useEffect(() => {
    fetch("/api/rag/health")
      .then((r) => r.json())
      .then((data) => setRagStatus(data.ok ? "online" : "offline"))
      .catch(() => setRagStatus("offline"));
  }, []);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || querying) return;
    setInput("");
    setQuerying(true);

    // 1. optimistically add user message to UI
    const tempUserMsg: PersistedMessage = {
      id: `temp_user_${Date.now()}`,
      role: "user",
      content,
      sources: [],
      contextUsed: false,
      chunkIds: [],
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // 2. save user message to DB — get real ID back
    const userMsgId = await saveUserMessage(content).catch(() => null);
    if (userMsgId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempUserMsg.id ? { ...m, id: userMsgId } : m,
        ),
      );
    }

    try {
      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId ?? "",
        },
        body: JSON.stringify({
          question: content,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      // handle RAG service unavailable gracefully
      if (res.status === 503) {
        const data = await res.json();

        // remove the user message from UI since we can't answer
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempUserMsg.id && m.id !== userMsgId),
        );

        toast.warning("echo-nemo-1.0 is warming up", {
          description:
            data.reason ??
            "The RAG service is starting. Please wait 15 seconds and try again.",
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => sendMessage(content),
          },
        });

        setQuerying(false);
        setInput(content); // restore input so user doesn't lose their message
        return;
      }

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      // 3. optimistically add assistant message to UI
      const tempAssistantMsg: PersistedMessage = {
        id: `temp_assistant_${Date.now()}`,
        role: "assistant",
        content: data.answer ?? "No response.",
        sources: data.sources ?? [],
        modelUsed: data.model_used,
        contextUsed: data.context_used ?? false,
        chunkIds: data.chunk_ids ?? [],
      };
      setMessages((prev) => [...prev, tempAssistantMsg]);

      // 4. save assistant message to DB — get real ID back
      const assistantMsgId = await saveAssistantMessage(
        tempAssistantMsg.content,
        {
          sources: tempAssistantMsg.sources,
          modelUsed: tempAssistantMsg.modelUsed ?? undefined,
          contextUsed: tempAssistantMsg.contextUsed,
          chunkIds: tempAssistantMsg.chunkIds,
        },
      ).catch(() => null);

      if (assistantMsgId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantMsg.id ? { ...m, id: assistantMsgId } : m,
          ),
        );
      }
    } catch (err) {
      // remove optimistic user message on hard failure
      setMessages((prev) =>
        prev.filter((m) => m.id !== tempUserMsg.id && m.id !== userMsgId),
      );

      toast.error("Failed to get a response", {
        description:
          err instanceof Error && err.message.includes("fetch")
            ? "Network error — check your connection."
            : "Something went wrong. Please try again.",
        duration: 6000,
        action: {
          label: "Retry",
          onClick: () => sendMessage(content),
        },
      });

      setInput(content); // restore input
    } finally {
      setQuerying(false);
    }
  };

  const handleFeedback = async (msg: PersistedMessage, rating: 1 | -1) => {
    if (feedbackSent[msg.id]) return;
    setFeedbackSent((prev) => ({ ...prev, [msg.id]: rating }));

    // save to RAG feedback system
    const prevUserMsg = messages[messages.indexOf(msg) - 1];
    await fetch("/api/rag/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: prevUserMsg?.content ?? "",
        answer: msg.content,
        sources: msg.sources ?? [],
        rating,
        chunkIds: msg.chunkIds ?? [],
        modelUsed: msg.modelUsed ?? "echo-nemo-1.0",
      }),
    });

    // also persist feedback to the chat message DB record
    await saveFeedback(msg.id, rating);
  };

  const handleClear = async () => {
    if (!confirm("Clear all chat history for this workspace?")) return;
    await clearSession();
    setFeedbackSent({});
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading(`Processing ${file.name}...`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        body: formData,
        headers: { "x-workspace-id": workspaceId ?? "" },
      });

      const data = await res.json();

      if (res.status === 503) {
        toast.warning("RAG service unavailable", {
          id: toastId,
          description: data.reason ?? "Try uploading again in 15 seconds.",
          duration: 8000,
        });
        return;
      }

      if (!res.ok) {
        toast.error("Upload failed", {
          id: toastId,
          description: data.error ?? "Could not process this file.",
          duration: 6000,
        });
        return;
      }

      toast.success(`${file.name} indexed`, {
        id: toastId,
        description: `${data.ingested} chunks added to your knowledge base.`,
        duration: 4000,
      });

      await fetchDocuments();
    } catch {
      toast.error("Upload failed", {
        id: toastId,
        description: "Network error — check your connection and try again.",
        duration: 6000,
      });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleUrlIngest = async () => {
    const url = urlInput.trim();
    if (!url) return;

    setShowUrlInput(false);
    const toastId = toast.loading(`Fetching ${url}...`);

    try {
      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId ?? "",
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (res.status === 503) {
        toast.warning("RAG service unavailable", {
          id: toastId,
          description: data.reason ?? "Try again in 15 seconds.",
          duration: 8000,
        });
        setShowUrlInput(true); // restore URL input
        return;
      }

      if (!res.ok) {
        toast.error("Failed to fetch URL", {
          id: toastId,
          description: data.error ?? "The URL could not be read.",
          duration: 6000,
        });
        setShowUrlInput(true);
        return;
      }

      toast.success("URL indexed", {
        id: toastId,
        description: `${data.ingested} chunks from ${url} added to your knowledge base.`,
        duration: 4000,
      });

      setUrlInput("");
      await fetchDocuments();
    } catch {
      toast.error("Network error", {
        id: toastId,
        description: "Could not reach the RAG service.",
        duration: 6000,
      });
      setShowUrlInput(true);
    }
  };

  const handleDeleteDoc = async (source: string) => {
    if (!confirm(`Remove "${source}" from your knowledge base?`)) return;

    const toastId = toast.loading(`Removing ${source}...`);

    try {
      const res = await fetch("/api/rag/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, workspaceId }),
      });

      if (res.status === 503) {
        toast.warning("RAG service unavailable", {
          id: toastId,
          description: "Could not delete right now. Try again in 15 seconds.",
          duration: 6000,
        });
        return;
      }

      if (!res.ok) {
        toast.error("Delete failed", {
          id: toastId,
          description: "Could not remove this document.",
          duration: 6000,
        });
        return;
      }

      toast.success("Document removed", {
        id: toastId,
        duration: 3000,
      });

      setDocuments((prev) => prev.filter((d) => d.source !== source));
      await fetchDocuments();
    } catch {
      toast.error("Network error", {
        id: toastId,
        description: "Could not reach the RAG service.",
        duration: 6000,
      });
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

  // show loading skeleton while restoring session
  if (sessionLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-white/30">
            Restoring your conversation...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Document panel */}
      {showDocPanel && (
        <div
          className="flex w-72 shrink-0 flex-col border-r border-white/5"
          style={{ backgroundColor: "rgba(255,255,255,0.01)" }}
        >
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

          {ragStatus === "offline" && (
            <div
              className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 p-3"
              style={{ backgroundColor: "rgba(245,158,11,0.06)" }}
            >
              <span className="mt-0.5 text-sm">⚠️</span>
              <div>
                <p className="text-[11px] font-medium text-amber-400">
                  RAG service is warming up
                </p>
                <p className="mt-0.5 text-[10px] text-amber-400/60">
                  The knowledge base is starting on Render. Uploads and queries will work in ~15 seconds.
                </p>
              </div>
            </div>
          )}

          {ragStatus === "online" && (
            <div className="mx-3 mt-3 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-[10px] text-white/20">echo-nemo-1.0 ready</p>
            </div>
          )}

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
              disabled={isUploading}
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
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {docsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-white/20" />
              </div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-white/20">No documents yet</p>
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

          <div className="border-t border-white/5 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <p className="text-[10px] font-medium text-white/30">
                echo-nemo-1.0
              </p>
              {saving && (
                <span className="ml-auto text-[9px] text-white/20 animate-pulse">
                  saving...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
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
          {(userRole === "OWNER" || userRole === "ADMIN") && messages.length > 0 && (
            <button
              onClick={handleClear}
              className="rounded-lg border border-destructive/20 px-2.5 py-1 text-[10px] text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-colors mr-2"
            >
              Clear history
            </button>
          )}
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
            <span className="text-[10px] text-white/20">
              {messages.length} message{messages.length !== 1 ? "s" : ""} saved
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.length === 0 && !sessionLoading && (
              <div className="py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-white/3">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h2 className="mt-5 text-base font-semibold text-white">
                  echo-nemo-1.0
                </h2>
                <p className="mt-2 text-sm text-white/30">
                  {documents.length === 0
                    ? "Upload a file or add a URL to start chatting with your knowledge base."
                    : `${documents.length} source${documents.length !== 1 ? "s" : ""} ready. Ask me anything.`}
                </p>
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

            {messages.map((msg) => (
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

                  {msg.role === "assistant" && msg.contextUsed && (
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
                      >
                        <ThumbsUp className="h-3 w-3" />
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
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                      {feedbackSent[msg.id] && (
                        <span className="text-[10px] text-white/20">
                          {feedbackSent[msg.id] === 1
                            ? "Boosting these sources"
                            : "Reducing these sources"}
                        </span>
                      )}
                    </div>
                  )}

                  {msg.role === "assistant" && msg.modelUsed && (
                    <p className="px-1 text-[10px] text-white/15">
                      via {msg.modelUsed}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {querying && (
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

        <div className="border-t border-white/5 px-6 py-4">
          <div className="mx-auto max-w-2xl space-y-2">
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
                disabled={!input.trim() || querying}
              >
                {querying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/15">
                echo-nemo-1.0 · answers from your documents only
              </p>
              <button
                onClick={handleClear}
                className="text-[10px] text-white/20 transition-colors hover:text-white/50"
              >
                Clear history
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}