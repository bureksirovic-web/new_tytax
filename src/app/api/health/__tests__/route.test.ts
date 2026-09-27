import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

interface HealthBody {
  status: string;
  sha: string;
  tree: string;
  version: string;
  timestamp: string;
}

function isHealthBody(v: unknown): v is HealthBody {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return ['status', 'sha', 'version', 'timestamp'].every((k) => typeof r[k] === 'string');
}

async function readBody(res: Response): Promise<HealthBody> {
  const json: unknown = await res.json();
  if (!isHealthBody(json)) throw new Error(`unexpected health body: ${JSON.stringify(json)}`);
  return json;
}

describe('GET /api/health', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('reports ok with the build SHA and version', async () => {
    vi.stubEnv('NEXT_PUBLIC_GIT_SHA', '0123456789abcdef0123456789abcdef01234567');
    const res = GET();
    // 200: NextResponse.json defaults to 200 when no status is given.
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.status).toBe('ok');
    expect(body.sha).toBe('0123456789abcdef0123456789abcdef01234567');
    expect(body.version).toBe('0.1.0');
  });

  it('reports the content-aware tree id, "unknown" when none was injected (S3-10)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TREE_ID', 'abc123-dirty-0123456789ab');
    expect((await readBody(GET())).tree).toBe('abc123-dirty-0123456789ab');
    vi.stubEnv('NEXT_PUBLIC_TREE_ID', undefined);
    expect((await readBody(GET())).tree).toBe('unknown');
  });

  it('falls back to "unknown" when no SHA was injected', async () => {
    vi.stubEnv('NEXT_PUBLIC_GIT_SHA', undefined);
    const body = await readBody(GET());
    expect(body.sha).toBe('unknown');
    expect(body.status).toBe('ok');
  });

  it('stamps the current time and is never cached', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T21:30:00.000Z'));
    const res = GET();
    const body = await readBody(res);
    expect(body.timestamp).toBe('2026-09-26T21:30:00.000Z');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
