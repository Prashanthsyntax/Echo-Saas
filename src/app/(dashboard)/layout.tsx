import { Sidebar } from "@/components/dashboard/sidebar";
import { ElectronNav } from "@/components/shared/electron-nav";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { PresenceAvatars } from "@/components/shared/presence-avatars";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <div
        className="relative flex h-screen overflow-hidden"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        {/* grid background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex-shrink-0">
          <Sidebar />
        </div>

        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          {/* top bar with presence */}
          <div className="flex h-10 shrink-0 items-center justify-end border-b border-white/5 px-4">
            <PresenceAvatars />
          </div>

          <main className="flex-1 overflow-y-auto">
            <ElectronNav />
            {children}
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}