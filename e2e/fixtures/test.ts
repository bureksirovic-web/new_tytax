import { test as base, expect as baseExpect } from '@playwright/test';
import { createTytax, type TytaxFixture } from './seed';

/** Rule (PLAN §10.2): every passing e2e test makes at least this many expect() calls. */
export const MIN_EXPECTS = 3;

/** expect() calls made by the running test. Module-level: one test runs at a time per worker. */
const counter = { calls: 0 };

/**
 * Wraps a Playwright expect (or `expect.soft` / `expect.poll`) so that every
 * call is counted. `extend` and `configure` return new expects; those are
 * wrapped too, so they keep counting. Asymmetric matchers pass through.
 */
function counting<E extends object>(target: E): E {
  return new Proxy(target, {
    apply(fn, thisArg, args: unknown[]) {
      counter.calls += 1;
      return Reflect.apply(fn as (...a: unknown[]) => unknown, thisArg, args);
    },
    get(obj, prop) {
      const value: unknown = Reflect.get(obj, prop);
      if (typeof value !== 'function') return value;
      if (prop === 'soft' || prop === 'poll') return counting(value);
      if (prop === 'extend' || prop === 'configure') {
        return (...args: unknown[]) => {
          const made: unknown = Reflect.apply(value, obj, args);
          return typeof made === 'function' ? counting(made) : made;
        };
      }
      return value;
    },
  });
}

/** Playwright's expect, counting calls for the MIN_EXPECTS rule. */
export const expect = counting(baseExpect);

export const test = base.extend<{ tytax: TytaxFixture; _minExpects: void }>({
  _minExpects: [
    // Playwright reads fixture dependencies from the destructuring pattern; this one needs none.
    async ({}, use, testInfo) => {
      counter.calls = 0;
      await use();
      // A fail() annotation makes a failing body "expected", a runtime skip makes it
      // "skipped" (R07/R10). Resetting expectedStatus is what turns either red:
      // throwing alone leaves status === expectedStatus. Declaration-time skips
      // never reach this fixture; e2e/no-skips-reporter.ts fails those runs.
      if (testInfo.expectedStatus !== 'passed') {
        const was = testInfo.expectedStatus;
        testInfo.expectedStatus = 'passed';
        throw new Error(`Expected status '${was}' (fail/skip/fixme annotation) is banned (PLAN §10.2): fix the test.`);
      }
      const passed = testInfo.status === 'passed' && testInfo.expectedStatus === 'passed';
      if (passed && counter.calls < MIN_EXPECTS) {
        throw new Error(`Test made ${counter.calls} expect() calls; the rule is >= ${MIN_EXPECTS}`);
      }
    },
    { auto: true },
  ],
  tytax: async ({ page }, use) => {
    await use(createTytax(page));
  },
});
