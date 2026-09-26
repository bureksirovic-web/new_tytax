/**
 * Signed-in account for the sync UI: status + email, as an external store
 * for `useSyncExternalStore`. With sync off it is a constant `disabled` store
 * that never loads supabase-js; with sync on the browser client is loaded by
 * dynamic `import()` on the first subscribe only. Never logs the session.
 */
import { getSupabaseEnv } from '@/lib/supabase/env';

export type AccountStatus = 'disabled' | 'loading' | 'signed_in' | 'signed_out';

export interface AccountState {
  status: AccountStatus;
  email: string | null;
}

interface SessionLike {
  user?: { email?: string | null } | null;
}

/** The slice of supabase-js `auth` the store uses. */
export interface AuthClientLike {
  auth: {
    getSession(): Promise<{ data: { session: SessionLike | null } }>;
    onAuthStateChange(cb: (event: string, session: SessionLike | null) => void): { data: { subscription: { unsubscribe(): void } } };
    signOut(): Promise<unknown>;
  };
}

export interface AccountStore {
  getState(): AccountState;
  subscribe(listener: () => void): () => void;
  /** Resolves once signed out; never throws. */
  signOut(): Promise<void>;
}

export const DISABLED_ACCOUNT: AccountState = Object.freeze({ status: 'disabled', email: null }) as AccountState;
const LOADING: AccountState = Object.freeze({ status: 'loading', email: null }) as AccountState;
const SIGNED_OUT: AccountState = Object.freeze({ status: 'signed_out', email: null }) as AccountState;

const disabledStore: AccountStore = Object.freeze({
  getState: () => DISABLED_ACCOUNT,
  subscribe: () => () => {},
  signOut: async () => {},
});

function fromSession(session: SessionLike | null): AccountState {
  return session?.user ? { status: 'signed_in', email: session.user.email ?? null } : SIGNED_OUT;
}

export function createAccountStore(load: () => Promise<AuthClientLike>): AccountStore {
  let state: AccountState = LOADING;
  const listeners = new Set<() => void>();
  let client: Promise<AuthClientLike | null> | null = null;

  const set = (next: AccountState): void => {
    if (next.status === state.status && next.email === state.email) return;
    state = next;
    listeners.forEach((l) => l());
  };

  const start = (): Promise<AuthClientLike | null> => {
    client ??= load().then(
      async (c) => {
        c.auth.onAuthStateChange((_event, session) => set(fromSession(session)));
        try {
          set(fromSession((await c.auth.getSession()).data.session));
        } catch {
          set(SIGNED_OUT);
        }
        return c;
      },
      () => {
        set(SIGNED_OUT);
        return null;
      },
    );
    return client;
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      void start();
      return () => listeners.delete(listener);
    },
    async signOut() {
      const c = await start();
      try {
        await c?.auth.signOut();
      } catch {
        // supabase-js clears the local session even when the revoke call fails.
      }
      set(SIGNED_OUT);
    },
  };
}

let cached: AccountStore | null = null;

/** Keep the env reference literal: Next.js inlines only literal `process.env.NEXT_PUBLIC_*`. */
export function getAccountStore(): AccountStore {
  if (process.env.NEXT_PUBLIC_SYNC_ENABLED !== 'true' || getSupabaseEnv() === null) return disabledStore;
  if (typeof window === 'undefined') return disabledStore;
  cached ??= createAccountStore(async () => {
    const { createClient } = await import('@/lib/supabase/client');
    return createClient() as unknown as AuthClientLike;
  });
  return cached;
}

/** Tests only. */
export function resetAccountStoreForTests(): void {
  cached = null;
}
