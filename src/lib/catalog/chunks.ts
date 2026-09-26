/**
 * Lazy per-modality chunk loaders. Each chunk is ONE dynamic import, so the
 * bundler emits it as its own async chunk and it never lands in first-load JS.
 * Nothing in this directory may statically import an exercise array.
 */
import type { Exercise } from '@/contracts/domain';
import type { CatalogChunkId } from '@/contracts/exercise-catalog';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** Shallow structural check of one catalog entry (the fields every consumer reads). */
export function isExercise(x: unknown): x is Exercise {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.modality === 'string' &&
    typeof x.muscleGroup === 'string' &&
    typeof x.pattern === 'string' &&
    Array.isArray(x.impact)
  );
}

function toExerciseArray(chunk: CatalogChunkId, data: unknown): readonly Exercise[] {
  if (!Array.isArray(data)) throw new Error(`catalog chunk "${chunk}" is not an array`);
  const out: Exercise[] = [];
  for (const item of data) {
    if (!isExercise(item)) throw new Error(`catalog chunk "${chunk}" has an invalid entry`);
    out.push(item);
  }
  return Object.freeze(out);
}

async function importChunk(chunk: CatalogChunkId): Promise<unknown> {
  switch (chunk) {
    case 'tytax': {
      const mod: { default: unknown } = await import('@/data/tytax/exercises.json');
      return mod.default;
    }
    case 'bodyweight': {
      const mod = await import('@/data/bodyweight/exercises');
      return mod.BODYWEIGHT_EXERCISES;
    }
    case 'kettlebell': {
      const mod = await import('@/data/kettlebell/exercises');
      return mod.KB_EXERCISES;
    }
  }
}

const chunkPromises = new Map<CatalogChunkId, Promise<readonly Exercise[]>>();

/** Memoised: one import per chunk for the lifetime of the page. A failed load is retried next call. */
export function loadChunk(chunk: CatalogChunkId): Promise<readonly Exercise[]> {
  const cached = chunkPromises.get(chunk);
  if (cached) return cached;
  const p = importChunk(chunk).then((data) => toExerciseArray(chunk, data));
  chunkPromises.set(chunk, p);
  p.catch(() => {
    if (chunkPromises.get(chunk) === p) chunkPromises.delete(chunk);
  });
  return p;
}

/** Id prefix → chunk (ids are `tytax_…`, `bw_…`, `kb_…`). Unknown prefix → undefined. */
export function chunkForId(id: string): CatalogChunkId | undefined {
  if (id.startsWith('tytax_')) return 'tytax';
  if (id.startsWith('bw_')) return 'bodyweight';
  if (id.startsWith('kb_')) return 'kettlebell';
  return undefined;
}

/** Test-only: forget memoised chunks. */
export function resetChunkCacheForTests(): void {
  chunkPromises.clear();
}
