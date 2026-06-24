import { Sidebar } from "@/components/dashboard/sidebar";
import { ElectronNav } from "@/components/shared/electron-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ElectronNav />
        {children}
      </main>
    </div>
  );
}