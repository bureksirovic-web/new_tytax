import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Runtime zero-skip rule (PLAN §10.2, R10): fails the run when any test ends
 * `skipped` (a skip or fixme annotation, or a runtime skip() on testInfo under
 * any parameter name), or ran under an expected-failure (fail) annotation. The lint bans
 * are an early warning; this is the check a rename cannot defeat.
 *
 * Registered in playwright.config.ts. A CLI `--reporter=…` replaces the config's
 * reporters, so such commands list `./e2e/no-skips-reporter.ts` again (ci.yml).
 */
export default class NoSkipsReporter implements Reporter {
  private readonly offenders = new Map<string, string>();

  printsToStdio(): boolean {
    return false;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const title = test.titlePath().filter(Boolean).join(' › ');
    if (result.status === 'skipped') this.offenders.set(title, 'skipped');
    else if (test.expectedStatus !== 'passed') this.offenders.set(title, `expected status '${test.expectedStatus}'`);
  }

  async onEnd(result: FullResult): Promise<{ status: FullResult['status'] } | undefined> {
    if (this.offenders.size === 0) return undefined;
    const lines = [...this.offenders].map(([title, why]) => `  - ${title} (${why})`);
    console.error(
      `\nno-skips-reporter: ${this.offenders.size} test(s) skipped or marked to fail; PLAN §10.2 requires zero:\n${lines.join('\n')}\n`,
    );
    return result.status === 'passed' ? { status: 'failed' } : undefined;
  }
}
