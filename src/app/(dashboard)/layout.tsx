import { Sidebar } from "@/components/dashboard/sidebar";
import { ElectronNav } from "@/components/shared/electron-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex h-screen overflow-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* grid — rendered as background on the root div directly */}
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

      {/* sidebar */}
      <div className="relative z-10 flex-shrink-0">
        <Sidebar />
      </div>

      {/* main */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <ElectronNav />
        {children}
      </main>
    </div>
  );
}