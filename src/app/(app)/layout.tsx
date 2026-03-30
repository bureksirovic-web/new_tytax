import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ToastContainer } from '@/components/ui/toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}
