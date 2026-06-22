"use client"; // ← Add this at the very top

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Circle, ArrowRight, Play } from "lucide-react";
import Lightfall from "@/components/ui/Lightfall"; // ← default import, no curly braces

export function Hero() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <Lightfall
          className="h-full w-full"
          colors={["#A6C8FF", "#5227FF", "#FF9FFC"]}
          backgroundColor="#0A29FF"
          speed={0.5}
          streakCount={2}
          streakWidth={1}
          streakLength={1}
          density={0.6}
          twinkle={1}
          glow={1}
          backgroundGlow={0.5}
          zoom={3}
          opacity={1}
          mouseInteraction
          mouseStrength={0.5}
          mouseRadius={1}
          style={{ width: "100%", height: "60%" }}
        />
      </div>

      <section className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 text-center md:pt-24">
        <Badge
          variant="secondary"
          className="gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
        >
          <Circle className="h-2 w-2 fill-accent text-accent" />
          ARK Groups
        </Badge>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Say it once.
          <br />
          <span className="text-muted-foreground">Skip the meeting.</span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
          Record your screen, share an instant link, and let your team watch on
          their own time. No calendars, no Zoom fatigue.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" className="gap-2">
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="gap-2">
            <Play className="h-4 w-4" />
            Watch how it works
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Free forever plan
        </p>
      </section>

      <section className="relative z-10 mx-auto mt-16 max-w-4xl px-6 pb-24 md:mt-20">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
              <span className="text-xs font-medium text-destructive">
                REC 00:14
              </span>
            </div>
            <div className="w-12" />
          </div>

          <div className="relative aspect-video bg-gradient-to-br from-secondary to-background p-8">
            <div className="space-y-3">
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted/70" />
              <div className="h-3 w-1/4 rounded bg-muted/50" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
