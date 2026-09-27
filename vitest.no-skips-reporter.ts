import type { Reporter, TestModule, Vitest } from 'vitest/node';

/**
 * Runtime zero-skip rule for vitest (PLAN §10.2, R10): fails the run when any
 * test ends skipped or todo (it.skip, it.todo, ctx.skip() under any parameter
 * name, a destructured `skip()`), or is declared with it.fails / test.fails
 * (R07), which reports a broken body as passing. The lint bans are an early
 * warning; this is the check a rename cannot defeat.
 *
 * Wired into vitest.config.ts and vitest.sync.config.ts next to the default
 * reporter. A CLI `--reporter=…` replaces the configured list, so such commands
 * name `--reporter=./vitest.no-skips-reporter.ts` again (ci.yml).
 *
 * A `-t` name filter marks every unmatched test skipped; with a filter active
 * outside CI the list is printed but the exit code is left alone. In CI
 * (process.env.CI set) it is always enforced.
 */
export default class NoSkipsReporter implements Reporter {
  private nameFiltered = false;

  onInit(vitest: Vitest): void {
    this.nameFiltered = vitest.config.testNamePattern != null && !process.env.CI;
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    const offenders: string[] = [];
    for (const testModule of testModules) {
      for (const test of testModule.children.allTests()) {
        const state = test.result().state;
        const where = `${testModule.moduleId.replace(`${process.cwd()}/`, '')} > ${test.fullName}`;
        if (state === 'skipped') offenders.push(`${where} (${test.options.mode === 'run' ? 'runtime skip' : test.options.mode})`);
        else if (test.options.fails) offenders.push(`${where} (fails)`);
      }
    }
    if (offenders.length === 0) return;
    const lines = offenders.map((o) => `  - ${o}`).join('\n');
    if (this.nameFiltered) {
      console.warn(`\nno-skips-reporter: ${offenders.length} test(s) skipped under a -t filter (not enforced):\n${lines}\n`);
      return;
    }
    console.error(
      `\nno-skips-reporter: ${offenders.length} test(s) skipped, todo or .fails; PLAN §10.2 requires zero:\n${lines}\n`,
    );
    process.exitCode = 1;
  }
}
