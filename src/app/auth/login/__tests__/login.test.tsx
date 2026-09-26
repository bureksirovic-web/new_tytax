// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_LOCALE } from '@/components/providers/locale-core';
import { AUTH_STRINGS } from '@/lib/auth/i18n';

const push = vi.fn();
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => search,
}));

const signInWithMagicLink = vi.fn();
vi.mock('@/lib/auth/helpers', () => ({
  signInWithMagicLink: (...args: unknown[]) => signInWithMagicLink(...args),
}));

import LoginPage from '../page';

/** Outside a LocaleProvider the UI renders DEFAULT_LOCALE ('en' in this worktree, 'hr' once G4's i18n is merged). */
const ui = AUTH_STRINGS[DEFAULT_LOCALE];

function configure() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
}

function submitButton() {
  return screen.getByRole('button', { name: ui['auth.login.submit'] });
}

beforeEach(() => {
  search = new URLSearchParams();
  push.mockReset();
  signInWithMagicLink.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('LoginPage', () => {
  it('renders the heading and the mapped error from ?error=', () => {
    configure();
    search = new URLSearchParams('error=otp_expired');
    render(<LoginPage />);
    expect(screen.getByTestId('auth-login-heading')).toHaveTextContent(ui['auth.login.title']);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'auth-error');
    expect(alert).toHaveTextContent(ui['auth.error.otp_expired']);
  });

  it('maps an unknown ?error= code to auth_failed and never echoes it', () => {
    configure();
    search = new URLSearchParams('error=<b>pwned</b>');
    render(<LoginPage />);
    const alert = screen.getByTestId('auth-error');
    expect(alert).toHaveTextContent(ui['auth.error.auth_failed']);
    expect(alert.textContent).not.toContain('pwned');
    expect(submitButton()).toBeInTheDocument();
  });

  it('shows no alert without ?error= when configured', () => {
    configure();
    render(<LoginPage />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(ui['auth.login.email_label'])).toBeEnabled();
    expect(submitButton()).toBeDisabled(); // empty email
  });

  it('not configured: shows the error immediately, disables the form, keeps "continue without account"', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    search = new URLSearchParams('next=/workout');
    render(<LoginPage />);
    expect(screen.getByTestId('auth-error')).toHaveTextContent(ui['auth.error.auth_not_configured']);
    const input = screen.getByLabelText(ui['auth.login.email_label']);
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: 'a@b.co' } });
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(ui['auth.login.continue_without_account']) }));
    expect(push).toHaveBeenCalledWith('/workout');
    expect(signInWithMagicLink).not.toHaveBeenCalled();
  });

  it('not configured + ?error=: shows exactly one banner, the not-configured one', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    search = new URLSearchParams('error=otp_expired');
    render(<LoginPage />);
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(ui['auth.error.auth_not_configured']);
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com'])(
    '"continue without account" never follows an unsafe next (%s) off-site',
    (unsafe) => {
      configure();
      search = new URLSearchParams({ next: unsafe });
      render(<LoginPage />);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(ui['auth.login.continue_without_account']) }));
      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith('/dashboard');
    }
  );

  it('resets loading after a failed send and shows the mapped error', async () => {
    configure();
    search = new URLSearchParams('next=/settings');
    let resolve!: (v: unknown) => void;
    signInWithMagicLink.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(ui['auth.login.email_label']), { target: { value: 'a@b.co' } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(screen.getByRole('button', { name: ui['auth.login.submit'] }).closest('form')).toHaveAttribute('aria-busy', 'true');
    expect(signInWithMagicLink).toHaveBeenCalledWith('a@b.co', '/settings');

    await act(async () => resolve({ error: { code: 'send_failed', message: 'x' } }));
    expect(screen.getByTestId('auth-error')).toHaveTextContent(ui['auth.error.send_failed']);
    expect(submitButton()).toBeEnabled();
    expect(submitButton().closest('form')).toHaveAttribute('aria-busy', 'false');
  });

  it('resets loading even if the helper throws', async () => {
    configure();
    signInWithMagicLink.mockRejectedValue(new Error('boom'));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(ui['auth.login.email_label']), { target: { value: 'a@b.co' } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent(ui['auth.error.send_failed']));
    expect(submitButton()).toBeEnabled();
    expect(signInWithMagicLink).toHaveBeenCalledTimes(1);
  });

  it('shows the sent state on success', async () => {
    configure();
    signInWithMagicLink.mockResolvedValue({ error: null });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(ui['auth.login.email_label']), { target: { value: 'a@b.co' } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(ui['auth.login.sent_title']));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(signInWithMagicLink).toHaveBeenCalledWith('a@b.co', null);
  });
});
