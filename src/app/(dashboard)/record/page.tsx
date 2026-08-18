"use client";

import { useRouter } from "next/navigation";
import { useRecorder } from "@/hooks/use-recorder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Monitor,
  Camera,
  MonitorSmartphone,
  Circle,
  Square,
  Pause,
  Play,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

const modes = [
  { value: "screen" as const, label: "Screen", icon: Monitor },
  { value: "camera" as const, label: "Camera", icon: Camera },
  { value: "both" as const, label: "Both", icon: MonitorSmartphone },
];

export default function RecordPage() {
  const router = useRouter();

  const {
    status,
    mode,
    setMode,
    formattedDuration,
    error,
    videoId,
    previewVideoRef,
    requestPermissions,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    reset,
  } = useRecorder({
    onUploadComplete: (id) => {
      router.push(`/v/${id}`);
    },
  });

  return (
    <div className="flex h-full min-h-[calc(100vh-0px)] flex-col p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">New recording</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what to record, then hit start.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        {/* mode picker */}
        {status === "idle" && (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="mb-3 text-sm font-medium">What do you want to record?</p>
            <div className="grid grid-cols-3 gap-3">
              {modes.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                    mode === m.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  <m.icon className="h-6 w-6" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* preview window */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card">
          {/* window chrome */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-muted" />
              <div className="h-2.5 w-2.5 rounded-full bg-muted" />
              <div className="h-2.5 w-2.5 rounded-full bg-muted" />
            </div>
            {status === "recording" && (
              <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                <span className="font-mono text-xs font-medium text-destructive">
                  REC {formattedDuration}
                </span>
              </div>
            )}
            {status === "paused" && (
              <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1">
                <Pause className="h-3 w-3 text-yellow-500" />
                <span className="font-mono text-xs font-medium text-yellow-500">
                  PAUSED {formattedDuration}
                </span>
              </div>
            )}
            <div className="w-12" />
          </div>

          {/* video preview */}
          <div className="relative aspect-video bg-secondary/20">
            <video
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            {(status === "idle" || status === "requesting") && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {status === "requesting"
                    ? "Requesting permissions..."
                    : "Preview will appear here"}
                </p>
              </div>
            )}
            {(status === "uploading" || status === "done") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                {status === "uploading" ? (
                  <>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm font-medium">Uploading your video...</p>
                    <p className="text-xs text-muted-foreground">
                      This wont take long
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Upload complete!</p>
                    <p className="text-xs text-muted-foreground">
                      Redirecting to your video...
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* error */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* controls */}
        <div className="flex items-center justify-center gap-3">
          {status === "idle" && (
            <Button onClick={requestPermissions} size="lg" className="gap-2 px-8">
              <Circle className="h-4 w-4" />
              Start recording
            </Button>
          )}

          {status === "requesting" && (
            <Button disabled size="lg">
              Waiting for permission...
            </Button>
          )}

          {status === "ready" && (
            <Button onClick={startRecording} size="lg" className="gap-2 px-8">
              <Circle className="h-4 w-4 fill-current" />
              Begin recording
            </Button>
          )}

          {status === "recording" && (
            <>
              <Button
                onClick={pauseRecording}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Pause className="h-4 w-4" />
                Pause
              </Button>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="gap-2"
              >
                <Square className="h-4 w-4 fill-current" />
                Stop & upload
              </Button>
            </>
          )}

          {status === "paused" && (
            <>
              <Button
                onClick={resumeRecording}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Resume
              </Button>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="gap-2"
              >
                <Square className="h-4 w-4 fill-current" />
                Stop & upload
              </Button>
            </>
          )}

          {(status === "error") && (
            <Button onClick={reset} variant="outline" size="lg" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}