/** Minimal next/navigation stand-in: the query string lives in a tiny external store. */
export function createNavStore() {
  let qs = '';
  const subs = new Set<() => void>();
  return {
    get: () => qs,
    set: (next: string) => {
      qs = next;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    replaced: [] as string[],
  };
}
