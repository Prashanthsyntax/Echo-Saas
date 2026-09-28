"use client";

import { useState, useCallback } from "react";
import {
  LayoutDashboard,
  GitBranch,
  GitCommit,
  Bug,
  GitPullRequest,
  Settings,
  ShieldCheck,
  ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OverviewPage } from "./pages/overview-page";
import { RepositoriesPage } from "./pages/repositories-page";
import { RepoDetailPage } from "./pages/repo-detail-page";
import { VulnerabilitiesPage } from "./pages/vulnerabilities-page";
import { PullRequestsPage } from "./pages/pull-requests-page";
import { SentraSettingsPage } from "./pages/sentra-settings-page";
import { AttackGraphPage } from "./pages/attack-graph-page";
import { CompliancePage } from "./pages/compliance-page";

type Page =
  | "overview"
  | "repositories"
  | "repo-detail"
  | "vulnerabilities"
  | "pull-requests"
  | "attack-graph"
  | "compliance"
  | "settings";

const NAV = [
  {
    label: "Monitor",
    items: [
      { id: "overview", label: "Overview", Icon: LayoutDashboard },
      { id: "repositories", label: "Repositories", Icon: GitBranch },
      { id: "repo-detail", label: "Commit activity", Icon: GitCommit },
    ],
  },
  {
    label: "Security",
    items: [
      { id: "vulnerabilities", label: "Vulnerabilities", Icon: Bug },
      { id: "pull-requests", label: "Pull requests", Icon: GitPullRequest },
      { id: "attack-graph", label: "Security posture", Icon: ShieldCheck },
      { id: "compliance", label: "Compliance", Icon: ClipboardCheck },
    ],
  },
  {
    label: "Workspace",
    items: [{ id: "settings", label: "Settings", Icon: Settings }],
  },
];

export function SentraCodeApp() {
  const [page, setPage] = useState<Page>("overview");

  const [pageExtra, setPageExtra] = useState<Record<string, unknown>>({});

  const go = useCallback((p: Page, extra?: Record<string, unknown>) => {
    setPage(p);
    if (extra) setPageExtra(extra);
  }, []);

  return (
    <div
      className="flex h-full overflow-hidden border border-white/5"
      style={{ backgroundColor: "var(--surface-0, #0a0a0a)" }}
    >
      {/* ── sidebar ────────────────────────────────────────────────── */}
      <aside
        className="flex w-52 shrink-0 flex-col border-r border-white/5 px-2.5 py-4"
        style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
      >
        {/* brand */}
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <span className="text-xl font-semibold text-white">
            SentraCode Tool
          </span>
        </div>

        {/* nav */}
        {NAV.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1.5 px-2 text-[9.5px] font-medium uppercase tracking-wider text-white/20">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => go(id as Page)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors",
                    page === id
                      ? "bg-primary/12 text-primary font-medium"
                      : "text-white/40 hover:bg-white/4 hover:text-white/70",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* footer */}
        <div className="mt-auto border-t border-white/5 pt-3 px-2">
          <div className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <p className="text-[11px] leading-relaxed text-white/25">
              <span className="font-medium text-white/50">
                Connected to GitHub
              </span>
            </p>
          </div>
        </div>
      </aside>

      {/* ── main ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* topbar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-5">
          <span className="text-xl font-semibold text-white">
            AI Security Code Review System
          </span>
        </div>

        {/* page content */}
        <div className="flex-1 overflow-y-auto">
          {page === "overview" && <OverviewPage onNavigate={go} />}
          {page === "repositories" && <RepositoriesPage onNavigate={go} />}
          {page === "repo-detail" && <RepoDetailPage repoId={pageExtra.repoId as string} />}
          {page === "vulnerabilities" && <VulnerabilitiesPage />}
          {page === "pull-requests" && <PullRequestsPage />}
          {page === "attack-graph" && <AttackGraphPage />}
          {page === "compliance" && <CompliancePage />}
          {page === "settings" && <SentraSettingsPage onNavigate={go} />}
        </div>
      </div>
    </div>
  );
}
