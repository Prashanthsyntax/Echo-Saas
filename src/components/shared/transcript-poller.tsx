"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface TranscriptPollerProps {
  videoId: string;
  initialTranscript: string | null;
  initialSummary: string | null;
  initialTitle: string;
}

export function TranscriptPoller({
  videoId,
  initialTranscript,
  initialSummary,
  initialTitle,
}: TranscriptPollerProps) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [summary, setSummary] = useState(initialSummary);
  const [title, setTitle] = useState(initialTitle);
  const [polling, setPolling] = useState(!initialTranscript);

  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        if (!res.ok) return;

        const video = await res.json();

        if (video.transcript) {
          setTranscript(video.transcript);
          setSummary(video.summary);
          setTitle(video.title);
          setPolling(false);
          clearInterval(interval);
        }
      } catch {
        // silently retry
      }
    }, 3000); // poll every 3 seconds

    return () => clearInterval(interval);
  }, [polling, videoId]);

  // add inside TranscriptPoller, after the existing useEffect
  useEffect(() => {
    if (title && title !== "Untitled Video") {
      document.title = `${title} — Echo`;
    }
  }, [title]);

  if (polling) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <div>
            <p className="font-medium text-foreground">
              Generating AI transcript...
            </p>
            <p className="text-xs mt-0.5">This usually takes 10–30 seconds</p>
          </div>
        </div>
      </div>
    );
  }

  if (!transcript && !summary) return null;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AI Summary
          </p>
          <p className="text-sm leading-relaxed">{summary}</p>
        </div>
      )}

      {transcript && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Transcript
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {transcript}
          </p>
        </div>
      )}
    </div>
  );
}
