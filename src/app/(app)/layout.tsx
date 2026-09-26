import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ToastContainer } from '@/components/ui/toast';
import { OfflineIndicator } from '@/components/layout/offline-indicator';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/layout/skip-link';
import { ProfilePrefsSync } from '@/components/layout/profile-prefs-sync';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <SkipLink />
      <ProfilePrefsSync />
      <OfflineIndicator />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 pb-16 focus:outline-none md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}
