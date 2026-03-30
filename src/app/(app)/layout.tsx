export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {children}
    </div>
  );
}
