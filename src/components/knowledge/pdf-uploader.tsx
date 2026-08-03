/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeGraph } from "./knowledge-types";

interface PdfUploaderProps {
  onGraphReady: (graph: KnowledgeGraph, sourceFile: string) => void;
}

export function PdfUploader({ onGraphReady }: PdfUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "extracting-text" | "building-graph" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a PDF file");
        setStatus("error");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File too large — max 10 MB");
        setStatus("error");
        return;
      }

      setFilename(file.name);
      setError(null);
      setStatus("extracting-text");

      try {
        // extract text from PDF using pdfjs-dist
        const pdfjsLib = await import("pdfjs-dist");

        // set worker — use CDN to avoid bundling issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = "";
        const maxPages = Math.min(pdf.numPages, 15); // cap at 15 pages

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => ("str" in item ? item.str : ""))
            .join(" ");
          fullText += pageText + "\n";
        }

        if (fullText.trim().length < 50) {
          throw new Error(
            "Could not extract readable text from this PDF. It may be a scanned image."
          );
        }

        setStatus("building-graph");

        // send to our API for knowledge graph extraction
        const res = await fetch("/api/knowledge/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: fullText,
            filename: file.name.replace(".pdf", ""),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Extraction failed");
        }

        const graph: KnowledgeGraph = await res.json();
        onGraphReady(graph, file.name);
        setStatus("idle");
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setStatus("error");
      }
    },
    [onGraphReady]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const isProcessing =
    status === "extracting-text" || status === "building-graph";

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Upload a document</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a PDF and Groq AI will extract a visual knowledge graph
            showing concepts and their relationships
          </p>
        </div>

        {/* drop zone */}
        <label
          className={cn(
            "relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-4",
            "rounded-2xl border-2 border-dashed transition-all duration-200",
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border bg-card/50 hover:border-primary/50 hover:bg-card",
            isProcessing && "pointer-events-none opacity-75"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept=".pdf"
            className="sr-only"
            onChange={onFileChange}
            disabled={isProcessing}
          />

          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {status === "extracting-text"
                    ? "Extracting text from PDF..."
                    : "Building knowledge graph with Groq AI..."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status === "extracting-text"
                    ? "Reading document pages"
                    : "This takes 10–20 seconds for large documents"}
                </p>
              </div>
              {filename && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {filename}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drop your PDF here, or click to browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports PDF up to 10 MB · First 15 pages analysed
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                Choose PDF
              </Button>
            </div>
          )}
        </label>

        {/* error state */}
        {status === "error" && error && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Extraction failed
              </p>
              <p className="mt-0.5 text-xs text-destructive/80">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => { setStatus("idle"); setError(null); }}
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* sample hint */}
        <div className="rounded-xl border border-border bg-card/30 p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Works best with:
          </p>
          <ul className="mt-2 space-y-1">
            {[
              "Research papers and academic documents",
              "Technical documentation and specs",
              "Business reports and whitepapers",
              "Process documentation and SOPs",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}