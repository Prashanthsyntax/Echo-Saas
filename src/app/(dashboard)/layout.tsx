import { Sidebar } from "@/components/dashboard/sidebar";
import { ElectronNav } from "@/components/shared/electron-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[#0a0a0a]">

      {/* persistent grid background — covers entire dashboard */}
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="dashboard-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dashboard-grid)" />
      </svg>

      {/* sidebar sits above the grid */}
      <div className="relative z-10">
        <Sidebar />
      </div>

      {/* main content */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <ElectronNav />
        {children}
      </main>
    </div>
  );
}