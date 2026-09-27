/**
 * Request G5-02: CSP connect-src allows the configured Supabase origin (local
 * stack, self-hosted, custom domain) next to https://*.supabase.co, and keeps
 * every other directive unchanged.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

async function cspWith(url: string | undefined): Promise<string> {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
  const config = (await import('../../next.config')).default;
  const rules = await config.headers!();
  const all = rules.find((r) => r.source === '/:path*');
  const csp = all?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
  if (typeof csp !== 'string') throw new Error('no CSP header on /:path*');
  return csp;
}

function directive(csp: string, name: string): string {
  const hit = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  if (hit === undefined) throw new Error(`no ${name} directive`);
  return hit;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('next.config CSP connect-src (G5-02)', () => {
  it('allows the local Supabase origin and its websocket origin', async () => {
    const csp = await cspWith('http://127.0.0.1:54421');
    expect(directive(csp, 'connect-src')).toBe(
      "connect-src 'self' https://*.supabase.co http://127.0.0.1:54421 ws://127.0.0.1:54421 ws://localhost:* ws://127.0.0.1:*",
    );
  });

  it('uses wss for an https custom domain and drops any path', async () => {
    const csp = await cspWith(' https://db.example.com/some/path ');
    expect(directive(csp, 'connect-src')).toContain('https://db.example.com wss://db.example.com ');
    expect(csp).not.toContain('/some/path');
  });

  it('keeps the production value when the URL is unset, malformed or not http(s)', async () => {
    const base = "connect-src 'self' https://*.supabase.co ws://localhost:* ws://127.0.0.1:*";
    expect(directive(await cspWith(undefined), 'connect-src')).toBe(base);
    expect(directive(await cspWith('not a url'), 'connect-src')).toBe(base);
    expect(directive(await cspWith('javascript:alert(1)'), 'connect-src')).toBe(base);
  });

  it('leaves the other directives intact', async () => {
    const csp = await cspWith('http://127.0.0.1:54421');
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });
});
