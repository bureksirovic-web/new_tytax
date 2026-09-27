import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, MAX_PUSH_BYTES, chunkRanges } from '../push';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, makeDevice } from './harness';

const utf8 = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

describe('push chunks stay under the server request-body limit (migration 005)', () => {
  it('MAX_PUSH_BYTES is half the 4 MiB request_body_limit()', () => {
    expect(MAX_PUSH_BYTES).toBe(2 * 1024 * 1024);
  });

  it('splits by bytes before rows, in order, covering every row once', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: String(i), notes: 'x'.repeat(600_000) }));
    const ranges = chunkRanges(rows, CHUNK_SIZE, MAX_PUSH_BYTES);
    expect(ranges.flatMap(([a, b]) => rows.slice(a, b).map((r) => r.id))).toEqual(rows.map((r) => r.id));
    for (const [a, b] of ranges) expect(utf8(rows.slice(a, b))).toBeLessThanOrEqual(MAX_PUSH_BYTES);
    expect(ranges.length).toBeGreaterThanOrEqual(4);
  });

  it('counts UTF-8 bytes, not UTF-16 code units', () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ id: String(i), notes: '💪'.repeat(5_000) })); // 20,000 bytes, length 10,000
    const ranges = chunkRanges(rows, CHUNK_SIZE, 50_000);
    for (const [a, b] of ranges) expect(utf8(rows.slice(a, b))).toBeLessThanOrEqual(50_000);
    expect(ranges.length).toBe(2);
  });

  it('keeps the row cap when rows are small', () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ id: String(i) }));
    expect(chunkRanges(rows, CHUNK_SIZE, MAX_PUSH_BYTES)).toEqual([[0, 100], [100, 200], [200, 250]]);
  });

  it('a single row above the budget is sent alone (the server decides)', () => {
    const rows = [{ id: 'a' }, { id: 'b', notes: 'x'.repeat(100) }, { id: 'c' }];
    expect(chunkRanges(rows, CHUNK_SIZE, 50)).toEqual([[0, 1], [1, 2], [2, 3]]);
  });

  it('the adapter sends every upsert within the byte budget and all rows arrive', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote, { maxPushBytes: 50_000 });
    const profile = await d.repo.profiles.create({ name: 'Ana' });
    for (let i = 0; i < 12; i++) await d.repo.notes.set(profile.id, `ex-${i}`, 'n'.repeat(9_000));

    const res = await d.adapter.syncNow();

    expect(res.failed).toBe(0);
    const noteCalls = remote.calls.filter((c) => c.op === 'upsert' && c.table === 'exercise_notes');
    expect(noteCalls.length).toBeGreaterThanOrEqual(3);
    for (const c of noteCalls) expect(c.bytes).toBeLessThanOrEqual(50_000);
    expect(remote.rows('exercise_notes')).toHaveLength(12);
  });
});
