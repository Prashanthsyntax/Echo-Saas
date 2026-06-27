import { Sidebar } from "@/components/dashboard/sidebar";
import { ElectronNav } from "@/components/shared/electron-nav";
import { WorkspaceProvider } from "@/lib/workspace-context";

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

        <main className="relative z-10 flex-1 overflow-y-auto">
          <ElectronNav />
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  );
}