/**
 * Migration 005 against the local Supabase stack (`npm run test:sync`): a write
 * request whose body is above `public.request_body_limit()` (4 MiB) is refused
 * with HTTP 413 by PostgREST's pre-request guard, before PostgreSQL parses the
 * body, and nothing is written. A valid batch below it still lands.
 * Missing env fails the suite in beforeAll; nothing is skipped.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, countRows, createLiveUser, requireLiveEnv, signedInClient, type LiveEnv, type LiveUser } from './live-harness';

const LIMIT = 4 * 1024 * 1024;

let env: LiveEnv;
let admin: SupabaseClient;
let user: LiveUser;
let client: SupabaseClient;
let token: string;

/** `n` bodyweight rows, each carrying `pad` bytes in `extra` (cap 64 KiB). */
function rows(n: number, pad: number, year = 2000) {
  return Array.from({ length: n }, (_, i) => ({
    id: crypto.randomUUID(),
    date: new Date(Date.UTC(year, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
    value_kg: 70,
    extra: { pad: 'p'.repeat(pad) },
  }));
}

function headers(): Record<string, string> {
  return { apikey: env.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

beforeAll(async () => {
  env = requireLiveEnv();
  admin = adminClient(env);
  user = await createLiveUser(admin, 'reqlimit');
  client = await signedInClient(env, user);
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error('no session after sign-in');
  token = data.session.access_token;
});

afterAll(async () => {
  if (user) await admin.auth.admin.deleteUser(user.id);
});

describe('request body limit (migration 005)', () => {
  it('a body above 4 MiB is refused with 413 PT413 before any row is written', async () => {
    const body = rows(150, 30_000); // ~4.5 MB, only 150 rows: the per-statement row cap is not what refuses it
    expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeGreaterThan(LIMIT);

    const res = await client.from('bodyweight_entries').upsert(body, { onConflict: 'id' }).select('id');

    expect(res.status).toBe(413);
    expect(res.error?.code).toBe('PT413');
    expect(res.error?.message).toMatch(/^request body is \d+ bytes \(max 4194304\)$/);
    expect(await countRows(client, 'bodyweight_entries')).toBe(0);
  });

  it('a chunked (no Content-Length) oversized body is refused too', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(rows(150, 30_000, 2001)));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 65_536) c.enqueue(bytes.subarray(i, i + 65_536));
        c.close();
      },
    });
    const res = await fetch(`${env.url}/rest/v1/bodyweight_entries`, {
      method: 'POST',
      headers: headers(),
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    expect(res.status).toBe(413);
    expect(((await res.json()) as { code?: string }).code).toBe('PT413');
    expect(await countRows(client, 'bodyweight_entries')).toBe(0);
  });

  it('a valid batch just under the limit (3 MB, the push budget is 2 MiB) is accepted in full', async () => {
    const body = rows(100, 30_000, 2002);
    const size = new TextEncoder().encode(JSON.stringify(body)).length;
    expect(size).toBeGreaterThan(2 * 1024 * 1024);
    expect(size).toBeLessThan(LIMIT);

    const res = await client.from('bodyweight_entries').upsert(body, { onConflict: 'id' }).select('id');

    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(100);
    expect(await countRows(client, 'bodyweight_entries')).toBe(100);
  });

  it('reads are not affected by the guard', async () => {
    const res = await fetch(`${env.url}/rest/v1/bodyweight_entries?select=id&limit=1`, { headers: headers() });
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });
});
