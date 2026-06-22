"use client";

import { useState, useRef, useCallback } from "react";

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

  // Format seconds → "MM:SS"
  const formattedDuration = formatDuration(duration);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

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

  const uploadVideo = useCallback(
    async (blob: Blob, mimeType: string) => {
      setStatus("uploading");

      try {
        if (blob.size === 0) {
          throw new Error("Recording is empty. Please try recording again.");
        }

        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const filename = `recording-${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("contentType", mimeType);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Upload failed");
        }

        const { videoId: newVideoId } = await res.json();

        setVideoId(newVideoId);
        setStatus("done");
        options.onUploadComplete?.(newVideoId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        handleError(msg);
      }
    },
    [handleError, options],
  );

  const requestPermissions = useCallback(async () => {
    setStatus("requesting");
    setError(null);

    try {
      let stream: MediaStream;

      if (mode === "screen") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
        });
      } else if (mode === "camera") {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } else {
        // both: composite screen + camera tracks
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
        });
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        const tracks = [
          ...screenStream.getTracks(),
          ...cameraStream.getAudioTracks(),
        ];
        stream = new MediaStream(tracks);
      }

      streamRef.current = stream;

      // attach to preview element if available
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      // stop recording if user ends screen share natively
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
      const blob = new Blob(chunksRef.current, { type: mimeType });
      await uploadVideo(blob, mimeType);
    };

    recorder.start(1000); // collect a chunk every second
    mediaRecorderRef.current = recorder;
    startTimer();
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
