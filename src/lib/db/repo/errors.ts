/**
 * Maps storage failures to typed `RepoError`s. RepoErrors pass through;
 * IndexedDB/Dexie failures (quota, constraint, closed database, aborted
 * transaction) become `STORAGE` with the original error as `cause`;
 * anything else (a programming error) is rethrown untouched.
 */
import Dexie from 'dexie';
import { RepoError, isRepoError } from '@/contracts/repo';

/** DOMException / Dexie error names that IndexedDB raises for storage failures. */
const STORAGE_ERROR_NAMES: ReadonlySet<string> = new Set([
  'QuotaExceededError',
  'ConstraintError',
  'DataError',
  'DataCloneError',
  'InvalidStateError',
  'TransactionInactiveError',
  'ReadOnlyError',
  'VersionError',
  'AbortError',
  'TimeoutError',
  'UnknownError',
  'NotFoundError',
  'DatabaseClosedError',
  'OpenFailedError',
  'MissingAPIError',
]);

export function isStorageError(e: unknown): e is Error {
  if (e instanceof Dexie.DexieError) return true;
  const name = typeof e === 'object' && e !== null ? (e as { name?: unknown }).name : undefined;
  return typeof name === 'string' && STORAGE_ERROR_NAMES.has(name);
}

export function toRepoError(e: unknown): unknown {
  if (isRepoError(e)) return e;
  if (isStorageError(e)) {
    const message = typeof e.message === 'string' && e.message !== '' ? e.message : e.name;
    return new RepoError('STORAGE', message, e);
  }
  return e;
}

/** Runs `run` and rethrows its failure through `toRepoError`. */
export async function wrapStorage<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toRepoError(e);
  }
}

type AsyncMethod = (...args: never[]) => Promise<unknown>;

/**
 * Copy of `obj` whose async methods map storage failures to `RepoError`
 * (reads run outside `RepoContext.write`, so they need this too).
 */
export function guardMethods<T extends { [K in keyof T]: AsyncMethod }>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const fn = obj[key];
    const wrapped = async (...args: Parameters<typeof fn>) => wrapStorage(() => fn.apply(obj, args));
    out[key] = wrapped as T[keyof T];
  }
  return out;
}
