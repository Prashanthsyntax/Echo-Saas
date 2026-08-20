"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText, Edit3, Save, X, Loader2,
  ChevronDown, ChevronUp, Tag, CheckSquare,
  Lightbulb, Globe, Users, Copy, Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StructuredNotesProps {
  videoId: string;
  canEdit?: boolean;
  onTimestampClick?: (seconds: number) => void;
}

interface VideoNotes {
  structuredNotes: string | null;
  transcript: string | null;
  summary: string | null;
  keyPoints: string[];
  actionItems: string[];
  topics: string[];
  language: string | null;
  speakerCount: number | null;
  notesEditedAt: Date | null;
}

// parse [MM:SS] timestamps in markdown and make them clickable
function parseTimestamps(
  text: string,
  onTimestampClick?: (seconds: number) => void
): React.ReactNode[] {
  const parts = text.split(/(\[\d{2}:\d{2}\])/g);
  return parts.map((part, i) => {
    const match = part.match(/\[(\d{2}):(\d{2})\]/);
    if (match && onTimestampClick) {
      const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      return (
        <button
          key={i}
          onClick={() => onTimestampClick(seconds)}
          className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary/20 transition-colors"
        >
          {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// render markdown to JSX — simplified markdown renderer
function MarkdownRenderer({
  content,
  onTimestampClick,
}: {
  content: string;
  onTimestampClick?: (seconds: number) => void;
}) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let codeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // code block start/end
    if (line.startsWith("```")) {
      if (!codeBlock) {
        codeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        elements.push(
          <div key={key++} className="my-3 overflow-hidden rounded-lg border border-white/8">
            {codeLang && (
              <div className="border-b border-white/8 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-white/40">
                {codeLang}
              </div>
            )}
            <pre className="overflow-x-auto p-4 text-xs text-white/70 leading-relaxed">
              <code>{codeLines.join("\n")}</code>
            </pre>
          </div>
        );
        codeBlock = false;
        codeLines = [];
        codeLang = "";
      }
      continue;
    }

    if (codeBlock) {
      codeLines.push(line);
      continue;
    }

    // headings
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mt-5 mb-2 text-sm font-semibold text-white/80">
          {parseTimestamps(line.slice(4), onTimestampClick)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="mt-6 mb-2 border-b border-white/5 pb-1.5 text-base font-bold text-white">
          {parseTimestamps(line.slice(3), onTimestampClick)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="mb-4 text-lg font-bold text-white">
          {parseTimestamps(line.slice(2), onTimestampClick)}
        </h1>
      );
    }
    // blockquote
    else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={key++}
          className="my-2 border-l-2 border-primary/40 pl-3 text-sm italic text-white/50"
        >
          {line.slice(2)}
        </blockquote>
      );
    }
    // bullet list
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      // inline bold/code formatting
      const content = line.slice(2)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`(.*?)`/g, '<code class="rounded bg-white/8 px-1 py-0.5 font-mono text-xs text-primary/80">$1</code>');

      elements.push(
        <div key={key++} className="flex items-start gap-2 py-0.5 text-sm text-white/60">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
          <span dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      );
    }
    // numbered list
    else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)?.[1];
      const content = line.replace(/^\d+\. /, "");
      elements.push(
        <div key={key++} className="flex items-start gap-2 py-0.5 text-sm text-white/60">
          <span className="mt-0.5 shrink-0 text-[11px] font-bold text-primary/50">
            {num}.
          </span>
          <span>{content}</span>
        </div>
      );
    }
    // empty line
    else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
    }
    // regular paragraph — handle inline bold and code
    else {
      const content = line
        .replace(/\*\*(.*?)\*\*/g, "<strong class='text-white/80 font-semibold'>$1</strong>")
        .replace(/`(.*?)`/g, '<code class="rounded bg-white/8 px-1 py-0.5 font-mono text-xs text-primary/80">$1</code>');

      elements.push(
        <p
          key={key++}
          className="text-sm leading-relaxed text-white/60"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
  }

  return <div className="space-y-1">{elements}</div>;
}

export function StructuredNotes({
  videoId,
  canEdit = false,
  onTimestampClick,
}: StructuredNotesProps) {
  const [notes, setNotes] = useState<VideoNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"notes" | "transcript" | "raw">(
    "notes"
  );
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(true);
  const [showActions, setShowActions] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/notes`);
      const data = await res.json();
      setNotes(data.video);
      setEditContent(data.video?.structuredNotes ?? "");
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotes();
  }, [fetchNotes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/videos/${videoId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredNotes: editContent }),
      });
      setNotes((prev) =>
        prev ? { ...prev, structuredNotes: editContent } : prev
      );
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(
      activeTab === "notes"
        ? (notes?.structuredNotes ?? "")
        : (notes?.transcript ?? "")
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-xs text-white/30">Loading notes...</p>
        </div>
      </div>
    );
  }

  if (!notes?.structuredNotes && !notes?.transcript) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
          <FileText className="h-5 w-5 text-white/20" />
        </div>
        <div>
          <p className="text-sm text-white/30">Notes not generated yet</p>
          <p className="mt-0.5 text-xs text-white/15">
            Processing usually takes 30-60 seconds after recording
          </p>
        </div>
        <button
          onClick={fetchNotes}
          className="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Check again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* meta info strip */}
      <div className="flex flex-wrap items-center gap-2">
        {notes.language && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Globe className="h-2.5 w-2.5" />
            {notes.language}
          </Badge>
        )}
        {notes.speakerCount && notes.speakerCount > 1 && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Users className="h-2.5 w-2.5" />
            {notes.speakerCount} speakers
          </Badge>
        )}
        {notes.topics?.map((topic) => (
          <Badge
            key={topic}
            variant="outline"
            className="border-primary/20 text-[10px] text-primary/60"
          >
            <Tag className="mr-1 h-2 w-2" />
            {topic}
          </Badge>
        ))}
        {notes.notesEditedAt && (
          <span className="text-[10px] text-white/20">
            Edited{" "}
            {new Date(notes.notesEditedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      {/* key points */}
      {notes.keyPoints && notes.keyPoints.length > 0 && (
        <div
          className="rounded-xl border border-white/5 p-4"
          style={{ backgroundColor: "rgba(139,92,246,0.04)" }}
        >
          <button
            onClick={() => setShowKeyPoints(!showKeyPoints)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-white/70">
                Key Points ({notes.keyPoints.length})
              </span>
            </div>
            {showKeyPoints ? (
              <ChevronUp className="h-4 w-4 text-white/20" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/20" />
            )}
          </button>
          {showKeyPoints && (
            <ul className="mt-3 space-y-2">
              {notes.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/50" />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* action items */}
      {notes.actionItems && notes.actionItems.length > 0 && (
        <div
          className="rounded-xl border border-emerald-500/15 p-4"
          style={{ backgroundColor: "rgba(52,211,153,0.04)" }}
        >
          <button
            onClick={() => setShowActions(!showActions)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white/70">
                Action Items ({notes.actionItems.length})
              </span>
            </div>
            {showActions ? (
              <ChevronUp className="h-4 w-4 text-white/20" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/20" />
            )}
          </button>
          {showActions && (
            <ul className="mt-3 space-y-2">
              {notes.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                  <CheckSquare className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/50" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* tabs */}
      <div className="flex items-center justify-between">
        <div className="flex border-b border-white/8">
          {(["notes", "transcript"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-xs font-medium capitalize transition-colors",
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-white/30 hover:text-white/60"
              )}
            >
              {tab === "notes" ? "Structured Notes" : "Raw Transcript"}
            </button>
          ))}
        </div>

        {/* actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>

          {canEdit && activeTab === "notes" && !editing && (
            <button
              onClick={() => {
                setEditing(true);
                setEditContent(notes?.structuredNotes ?? "");
                setTimeout(() => textareaRef.current?.focus(), 100);
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </button>
          )}

          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/25"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saved ? "Saved ✓" : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/30 hover:text-white/60"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* content area */}
      <div
        className="min-h-[300px] rounded-xl border border-white/5 p-5"
        style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
      >
        {activeTab === "notes" ? (
          editing ? (
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="h-full min-h-[400px] w-full resize-none border-0 bg-transparent font-mono text-sm text-white/70 outline-none placeholder:text-white/20"
              placeholder="# Video Notes&#10;&#10;## Overview&#10;..."
            />
          ) : notes.structuredNotes ? (
            <MarkdownRenderer
              content={notes.structuredNotes}
              onTimestampClick={onTimestampClick}
            />
          ) : (
            <p className="text-sm text-white/20">No structured notes available.</p>
          )
        ) : (
          <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/50">
            {notes.transcript ?? "No transcript available."}
          </p>
        )}
      </div>
    </div>
  );
}