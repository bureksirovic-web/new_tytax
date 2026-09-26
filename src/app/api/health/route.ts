import { NextResponse } from 'next/server';

/**
 * Liveness probe. `sha` is the git commit the server was built/started from
 * (NEXT_PUBLIC_GIT_SHA, set in next.config.ts); the e2e global setup compares
 * it with the worktree HEAD so a run never tests another worktree's server.
 */
export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      sha: process.env.NEXT_PUBLIC_GIT_SHA ?? 'unknown',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
