"use client";

import { useState, useRef, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";

export type RecordingStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "recording"
  | "paused"
  | "stopped"
  | "uploading"
  | "done"
  | "error";

export type RecordingMode = "screen" | "camera" | "both";

interface UseRecorderOptions {
  onUploadComplete?: (videoId: string) => void;
  onError?: (error: string) => void;
}

export function useRecorder(options: UseRecorderOptions = {}) {
  const { workspaceId } = useWorkspace();
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [mode, setMode] = useState<RecordingMode>("screen");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const durationRef = useRef<number>(0);

  const formattedDuration = formatDuration(duration);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((reset = false) => {
    if (reset) {
      durationRef.current = 0;
      setDuration(0);
    }
    stopTimer();
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }, [stopTimer]);

  const stopAllTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleError = useCallback(
    (message: string) => {
      setError(message);
      setStatus("error");
      stopTimer();
      stopAllTracks();
      options.onError?.(message);
    },
    [options, stopTimer, stopAllTracks],
  );

  const uploadVideo = useCallback(
    async (blob: Blob, mimeType: string, recordedDuration: number) => {
      setStatus("uploading");

      try {
        if (!workspaceId) {
          throw new Error("Select a workspace before uploading a recording.");
        }

        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const filename = `recording-${Date.now()}.${ext}`;

        // convert blob to base64
        const base64 = await blobToBase64(blob);

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            contentType: mimeType,
            fileData: base64,
            duration: recordedDuration,
            workspaceId,
          }),
        });

        let data: { videoId?: string; error?: string } = {};
        try {
          data = await res.json();
        } catch {
          throw new Error(`Server error (${res.status}) — check terminal logs`);
        }

        if (!res.ok) {
          throw new Error(
            data.error ?? `Upload failed with status ${res.status}`,
          );
        }

        if (!data.videoId) {
          throw new Error("No video ID returned from server");
        }

        setVideoId(data.videoId);
        setStatus("done");
        options.onUploadComplete?.(data.videoId);

        // fire transcription in background — don't block the redirect
        fetch(`/api/videos/${data.videoId}/transcribe`, {
          method: "POST",
        }).catch((err) => {
          console.warn("Background transcription request failed:", err);
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        handleError(msg);
      }
    },
    [options, handleError, workspaceId],
  );

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setStatus("stopped");
    }
    stopAllTracks();
  }, [stopAllTracks]);

  const requestPermissions = useCallback(async () => {
    setStatus("requesting");
    setError(null);

    try {
      let stream: MediaStream;
      const isElectron = typeof window !== "undefined" && !!window.electron;

      if (isElectron && mode === "screen") {
        // use Electron's desktopCapturer for native screen access
        const granted = await window.electron!.requestScreenPermission();
        if (!granted) {
          handleError(
            "Screen recording permission denied — grant it in System Preferences",
          );
          return;
        }

        const sources = await window.electron!.getSources();
        const screenSource =
          sources.find((s) => s.name === "Entire Screen") ?? sources[0];

        if (!screenSource) {
          handleError("No screen sources found");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-expect-error — Electron-specific constraint
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: screenSource.id,
            },
          },
        });
      } else if (mode === "screen") {
        // browser fallback
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
        });
      } else if (mode === "camera") {
        if (isElectron) {
          await window.electron!.requestCameraPermission();
          await window.electron!.requestMicPermission();
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } else {
        // both
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
        });
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        stream = new MediaStream([
          ...screenStream.getTracks(),
          ...cameraStream.getAudioTracks(),
        ]);
      }

      streamRef.current = stream;

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopRecording();
      });

      setStatus("ready");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Permission denied — please allow screen/camera access and try again."
            : err.message
          : "Failed to access recording devices.";
      handleError(msg);
    }
  }, [mode, handleError, stopRecording]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(streamRef.current, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stopTimer();
      const finalDuration = durationRef.current;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      await uploadVideo(blob, mimeType, finalDuration);
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    startTimer(true);
    setStatus("recording");
  }, [startTimer, stopTimer, uploadVideo]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      stopTimer();
      setStatus("paused");
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimer();
      setStatus("recording");
    }
  }, [startTimer]);

  const reset = useCallback(() => {
    stopTimer();
    stopAllTracks();
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    durationRef.current = 0;
    setStatus("idle");
    setDuration(0);
    setError(null);
    setVideoId(null);
  }, [stopTimer, stopAllTracks]);

  return {
    status,
    mode,
    setMode,
    duration,
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
  };
}

// ─── helpers (module-level, outside the hook) ────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getSupportedMimeType(): string {
  const types = [
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
