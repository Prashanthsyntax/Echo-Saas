"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface Agent {
  id: string;
  name: string;
  connectLabel: string;
  connectStyle: "default" | "highlight";
  imagePath: string;
  imageAlt: string;
}

const agents: Agent[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    connectLabel: "Connect via prompts",
    connectStyle: "default",
    imagePath: "/agents/claude-code.png",
    imageAlt: "Claude Code agent",
  },
  {
    id: "codex",
    name: "Codex",
    connectLabel: "Connect via prompts",
    connectStyle: "default",
    imagePath: "/agents/codex.png",
    imageAlt: "Codex agent",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    connectLabel: "Connect via prompts",
    connectStyle: "default",
    imagePath: "/agents/openclaw.png",
    imageAlt: "OpenClaw agent",
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    connectLabel: "Connect via MCP",
    connectStyle: "default",
    imagePath: "/agents/claude-desktop.png",
    imageAlt: "Claude Desktop agent",
  },
  {
    id: "cursor",
    name: "Cursor",
    connectLabel: "Connect via MCP",
    connectStyle: "default",
    imagePath: "/agents/cursor.png",
    imageAlt: "Cursor agent",
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    connectLabel: "Connect via MCP",
    connectStyle: "default",
    imagePath: "/agents/hermes.png",
    imageAlt: "Hermes Agent",
  },
  {
    id: "vscode",
    name: "VS Code",
    connectLabel: "Connect via MCP",
    connectStyle: "default",
    imagePath: "/agents/vscode.png",
    imageAlt: "VS Code agent",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    connectLabel: "Connect via MCP",
    connectStyle: "default",
    imagePath: "/agents/gemini.png",
    imageAlt: "Gemini CLI agent",
  },
  {
    id: "cline",
    name: "Cline",
    connectLabel: "Connect via MCP",
    connectStyle: "highlight",
    imagePath: "/agents/cline.png",
    imageAlt: "Cline agent",
  },
  {
    id: "api-mcp",
    name: "API / MCP",
    connectLabel: "Connect via API or MCP",
    connectStyle: "default",
    imagePath: "/agents/api-mcp.png",
    imageAlt: "API / MCP",
  },
];

export function AgentsSection() {
  return (
    <div className="mt-10 space-y-5">
      {/* section header */}
      <div>
        <h2 className="text-base font-semibold text-white">Agents</h2>
        <p className="mt-1 text-sm text-white/30">
          Connect your AI agents and coding tools to Echo for persistent memory.
        </p>
      </div>

      {/* 5-column grid matching the screenshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-white/6",
        "transition-all duration-200 hover:border-white/12 hover:bg-white/[0.03]",
        "cursor-pointer"
      )}
      style={{ backgroundColor: "rgba(255,255,255,0.02)", minHeight: "200px" }}
    >
      {/* agent name — top left */}
      <div className="p-4 pb-0">
        <p className="text-sm font-semibold text-white">{agent.name}</p>
      </div>

      {/* agent image — fills remaining space */}
      <div className="relative flex flex-1 items-end justify-center overflow-hidden px-4 pb-14">
        <div className="relative h-28 w-full">
          <Image
            src={agent.imagePath}
            alt={agent.imageAlt}
            fill
            className="object-contain object-bottom drop-shadow-lg"
            onError={(e) => {
              // hide broken image gracefully
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </div>

      {/* connect button — pinned to bottom */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5">
        <button
          type="button"
          className={cn(
            "w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            agent.connectStyle === "highlight"
              ? "bg-violet-600 text-white hover:bg-violet-500"
              : "border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
          )}
        >
          {agent.connectLabel}
        </button>
      </div>
    </div>
  );
}