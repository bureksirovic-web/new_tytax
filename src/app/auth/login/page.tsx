'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { signInWithMagicLink } from '@/lib/auth/helpers';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error: err } = await signInWithMagicLink(email.trim());
    setLoading(false);
    if (err) {
      setError({ message: err.message || 'Failed to send magic link' });
    } else {
      setSent(true);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-8 space-y-6"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        {/* Logo / Title */}
        <div className="text-center space-y-1">
          <h1
            className="text-3xl font-semibold tracking-widest uppercase font-['Oswald']"
            style={{ color: 'var(--text-primary)' }}
          >
            TYTAX
          </h1>
          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Training Companion
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">&#9993;</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Check your email for a magic link
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Click the link in the email to sign in. You can close this tab.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error?.message ?? undefined}
              required
              autoFocus
            />
            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={!email.trim()}
            >
              Continue with Email
            </Button>
          </form>
        )}

        {/* Offline / skip */}
        {!sent && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-xs underline underline-offset-2 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              Continue without account &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
