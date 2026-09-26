import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * Git SHA the app is built from, computed once when the config loads.
 * Exposed as NEXT_PUBLIC_GIT_SHA (inlined at build/dev-compile time) so
 * `/api/health` and `window.__tytaxE2E.sha` can report it; the e2e global
 * setup asserts it equals the worktree HEAD (test isolation, PLAN §10.1 W0.2).
 */
function resolveGitSha(): string {
  const fromEnv = process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT;
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

const gitSha = resolveGitSha();

const isDev = process.env.NODE_ENV === 'development';
const scriptSrc = isDev 
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : "'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "app.tytax.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co ws://localhost:* ws://127.0.0.1:*; media-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
