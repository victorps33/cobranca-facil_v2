import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { ScrollToTop } from "@/components/scroll-to-top";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <TopBar />
        <main id="main-content" className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8">
          <ScrollToTop />
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
