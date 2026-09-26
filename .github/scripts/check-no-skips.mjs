#!/usr/bin/env node
// Fails unless a test report ran at least one test and skipped none (AC12: zero skips).
// Usage: node .github/scripts/check-no-skips.mjs <vitest|playwright> <report.json>
//   vitest:     `vitest run --reporter=json --outputFile.json=<file>`
//   playwright: `PLAYWRIGHT_JSON_OUTPUT_FILE=<file> playwright test --reporter=list,json`
// Reading the JSON counters (not grepping the log) means a test *named* "…skipped…" cannot
// trip it, and a run that silently collected zero tests cannot pass it.
import { readFileSync } from 'node:fs';

const [kind, file] = process.argv.slice(2);
if (!['vitest', 'playwright'].includes(kind) || !file) {
  console.error('usage: check-no-skips.mjs <vitest|playwright> <report.json>');
  process.exit(2);
}
const report = JSON.parse(readFileSync(file, 'utf8'));

let ran;
let skipped;
if (kind === 'vitest') {
  ran = report.numPassedTests + report.numFailedTests;
  skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);
} else {
  const s = report.stats ?? {};
  ran = (s.expected ?? 0) + (s.unexpected ?? 0) + (s.flaky ?? 0);
  skipped = s.skipped ?? 0;
}

console.log(`${kind}: ran=${ran} skipped=${skipped}`);
if (!Number.isFinite(ran) || ran === 0) {
  console.error(`${kind}: no tests ran (${file})`);
  process.exit(1);
}
if (skipped !== 0) {
  console.error(`${kind}: ${skipped} skipped test(s); AC12 requires zero skips`);
  process.exit(1);
}
