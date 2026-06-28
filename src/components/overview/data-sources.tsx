"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DataSource {
  id: string;
  name: string;
  description: string;
  abbr: string;
  bgColor: string;
  textColor: string;
}

const dataSources: DataSource[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Turn channels and threads into searchable memory.",
    abbr: "Sl",
    bgColor: "#4A154B",
    textColor: "#ffffff",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Sync pages and databases into your knowledge graph.",
    abbr: "No",
    bgColor: "#000000",
    textColor: "#ffffff",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Ingest Docs, Sheets, and Slides automatically.",
    abbr: "GD",
    bgColor: "#1a73e8",
    textColor: "#ffffff",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Index issues, PRs, and repository docs.",
    abbr: "GH",
    bgColor: "#161b22",
    textColor: "#ffffff",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Bring issues and project context into memory.",
    abbr: "Li",
    bgColor: "#5E6AD2",
    textColor: "#ffffff",
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Connect spaces and wikis as a data source.",
    abbr: "Cf",
    bgColor: "#172B4D",
    textColor: "#ffffff",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Sync tickets and epics into the graph.",
    abbr: "Jr",
    bgColor: "#0052CC",
    textColor: "#ffffff",
  },
  {
    id: "sheets",
    name: "Google Drive Sheets",
    description: "Pull structured data from spreadsheets.",
    abbr: "Sh",
    bgColor: "#0F9D58",
    textColor: "#ffffff",
  },
];

export function DataSources() {
  return (
    <div className="mt-10 space-y-5">
      {/* section header */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-white">Data sources</h2>
        <Badge
          className="rounded-full border-0 px-2.5 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: "rgba(139,92,246,0.2)",
            color: "#a78bfa",
          }}
        >
          Coming soon
        </Badge>
      </div>
      <p className="text-sm text-white/30">
        Connect the tools your team already uses as data sources for your
        brains.
      </p>

      {/* grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dataSources.map((source) => (
          <DataSourceCard key={source.id} source={source} />
        ))}
      </div>
    </div>
  );
}

function DataSourceCard({ source }: { source: DataSource }) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-4 rounded-2xl border border-white/5 p-5",
        "transition-colors duration-200 hover:border-white/10",
        "cursor-default"
      )}
      style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      {/* header row — icon + name + badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* colored abbreviation icon */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
            style={{
              backgroundColor: source.bgColor,
              color: source.textColor,
            }}
          >
            {source.abbr}
          </div>
          <p className="text-sm font-semibold text-white">{source.name}</p>
        </div>

        {/* coming soon badge */}
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium"
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          Coming soon
        </span>
      </div>

      {/* description */}
      <p className="text-xs leading-relaxed text-white/35">
        {source.description}
      </p>

      {/* notify me button */}
      <button
        type="button"
        disabled
        className="w-fit rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs font-medium text-white/30 transition-colors hover:border-white/12 hover:text-white/50"
      >
        Notify me
      </button>
    </div>
  );
}