"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Circle, ArrowRight, Play } from "lucide-react";
import CursorGrid from "@/components/ui/CursorGrid";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-auto absolute inset-0 z-0">
        <CursorGrid
          className="h-full w-full"
          cellSize={70}
          color="#10B981"
          radius={140}
          falloff="smooth"
          holdTime={400}
          fadeDuration={800}
          lineWidth={1.2}
          maxOpacity={0.6}
          fillOpacity={0}
          gridOpacity={0.05}
          cellRadius={0}
          clickPulse
          pulseSpeed={600}
        />
      </div>

      <section className="pointer-events-none relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 text-center md:pt-24">
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

        <div className="pointer-events-auto mt-8 flex flex-col items-center gap-3 sm:flex-row">
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
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
          whileHover={{ y: -6, transition: { duration: 0.3, ease: "easeOut" } }}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40"
        >
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

          <Image
            src="/dashboard-preview.png"
            alt="Echo dashboard overview showing recordings, views, and workspace tools"
            width={1296}
            height={734}
            className="h-auto w-full"
            priority
          />
        </motion.div>
      </section>
    </div>
  );
}