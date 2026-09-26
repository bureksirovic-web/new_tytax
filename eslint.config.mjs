import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import i18next from "eslint-plugin-i18next";

// ─── Test-suite guards (PLAN §10.1 W0.5, §10.2) ─────────────────────────────
// ESLint flat config replaces a rule's options wholesale when a later block
// sets the same rule, so the e2e block below repeats SKIP_SELECTORS.

const RUNNERS = "/^(test|it|describe|suite|bench)$/";
// fail/fails: an expected-failure annotation turns a broken body into a green result (R07).
const SKIPPERS = "/^(skip|only|fixme|todo|skipIf|runIf|fail|fails)$/";
const SKIP_MESSAGE =
  "No skipped, focused, todo or expected-failure tests (.skip/.only/.fixme/.todo/.skipIf/.runIf/.fail/.fails): fix the test or delete it.";

/** test.skip, it.only, describe.todo, test.fail, it.fails, test.describe.skip, it.concurrent.fails, … */
const SKIP_SELECTORS = [
  `MemberExpression[object.name=${RUNNERS}][property.name=${SKIPPERS}]`,
  `MemberExpression[object.object.name=${RUNNERS}][property.name=${SKIPPERS}]`,
  `MemberExpression[object.object.object.name=${RUNNERS}][property.name=${SKIPPERS}]`,
  // Runtime skips from inside a test: testInfo.skip(), test.info().fail(), vitest ctx.skip().
  // Early warning only: a renamed parameter gets past it; the no-skips reporters
  // (e2e/no-skips-reporter.ts, vitest.no-skips-reporter.ts) fail the run itself.
  "CallExpression[callee.object.name=/^(testInfo|ctx|context|task)$/][callee.property.name=/^(skip|fixme|fail)$/]",
  "CallExpression[callee.object.callee.property.name='info'][callee.property.name=/^(skip|fixme|fail)$/]",
  "CallExpression[callee.name=/^(xit|xtest|xdescribe|fit|fdescribe)$/]",
].map((selector) => ({ selector, message: SKIP_MESSAGE }));

/**
 * e2e reads UI state only through web-first assertions (R08). A state query
 * (isVisible(), count(), …) is banned outright, not only inside an if/loop
 * test: hoisting it into a variable, a .then callback or a switch defeated a
 * position-based ban. Each has a web-first twin: toBeVisible, toBeHidden,
 * toHaveCount, toBeEnabled, toBeDisabled, toBeChecked, toBeEditable.
 * Swallowing a failure (try/catch, .catch()) is banned too; try/finally is fine.
 */
const GUARD_MESSAGE =
  "No reading UI state into logic (isVisible/count/isEnabled/…): use a web-first assertion such as await expect(locator).toBeVisible() or .toHaveCount(n).";
const CATCH_MESSAGE =
  "No swallowed failures in e2e (try/catch, .catch()): let the assertion fail. try/finally for cleanup is allowed.";
const TESTED = ":matches(IfStatement, ConditionalExpression, WhileStatement, DoWhileStatement, ForStatement)";
const TEXT_QUERY =
  "CallExpression[callee.property.name=/^(textContent|innerText|innerHTML|inputValue|getAttribute|allTextContents|allInnerTexts)$/]";
const TEXT_MESSAGE =
  "No branching on page text (textContent/inputValue/getAttribute/…): assert it with toHaveText / toHaveValue / toHaveAttribute.";
const GUARD_SELECTORS = [
  {
    selector:
      "CallExpression[callee.property.name=/^(isVisible|isHidden|count|isEnabled|isDisabled|isChecked|isEditable)$/]",
    message: GUARD_MESSAGE,
  },
  { selector: "TryStatement[handler]", message: CATCH_MESSAGE },
  { selector: "CallExpression[callee.property.name='catch']", message: CATCH_MESSAGE },
  ...[
    `${TESTED} > .test ${TEXT_QUERY}`,
    `${TESTED} > ${TEXT_QUERY}.test`,
    `LogicalExpression > .left ${TEXT_QUERY}`,
    `LogicalExpression > ${TEXT_QUERY}.left`,
    `SwitchStatement > .discriminant ${TEXT_QUERY}`,
    `SwitchStatement > ${TEXT_QUERY}.discriminant`,
  ].map((selector) => ({ selector, message: TEXT_MESSAGE })),
];

const WAIT_FOR_TIMEOUT = {
  selector: "CallExpression[callee.property.name='waitForTimeout']",
  message: "No waitForTimeout: wait for a condition with a web-first assertion or expect.poll().",
};

/**
 * No per-spec retries (S3-08): CI sets failOnFlakyTests, and a retry hides a
 * flaky test locally. test.describe.configure may set only `mode` and `timeout`,
 * written as an object literal.
 */
const DESCRIBE_CONFIGURE = "CallExpression[callee.property.name='configure'][callee.object.property.name='describe']";
const RETRIES_MESSAGE =
  "No retries in specs: test.describe.configure takes only { mode, timeout } (retries live in playwright.config.ts).";
const RETRY_SELECTORS = [
  `${DESCRIBE_CONFIGURE} > ObjectExpression > Property[key.name!=/^(mode|timeout)$/]`,
  `${DESCRIBE_CONFIGURE} > ObjectExpression > Property[computed=true]`,
  `${DESCRIBE_CONFIGURE} > ObjectExpression > SpreadElement`,
  `${DESCRIBE_CONFIGURE}[arguments.0.type!='ObjectExpression']`,
].map((selector) => ({ selector, message: RETRIES_MESSAGE }));

/**
 * The runners collect only e2e/**\/*.spec.ts (playwright testMatch) and
 * src/**\/*.test.{ts,tsx} + scripts/**\/*.test.ts (vitest include). A test file
 * under any other name would be silently ignored, so it is an error (R09).
 */
const MISNAMED_TEST_FILES = [
  "e2e/**/*.test.*",
  "e2e/**/*.spec.{tsx,mts,cts,js,jsx,mjs,cjs}",
  "src/**/*.spec.*",
  "src/**/*.test.{mts,cts,js,jsx,mjs,cjs}",
  "scripts/**/*.spec.*",
  "scripts/**/*.test.{tsx,mts,cts,js,jsx,mjs,cjs}",
];

const PLAYWRIGHT_IMPORT_MESSAGE = "Import { test, expect } (and types) from './fixtures' in specs.";

// ─── i18n (PLAN §10.1 W0.5, AC14) ────────────────────────────────────────────
// Mode "jsx-only" + an attribute *include* list: flags JSX text and string
// literals rendered as JSX children ({cond && 'Save'}), plus the listed
// user-facing attributes on any element or component. Every other attribute
// (className, data-testid, href, type, id, key, role, event handlers, …) is
// skipped because the include list is exhaustive. "jsx-text-only" would miss
// placeholder/aria-label/title/alt; "all" would flag every string in logic.
// "should-validate-template" also checks template literals (aria-label={`… ${n}`});
// <Script>/<Trans> children are excluded. Severity "warn" until integration,
// when it becomes "error".
const USER_FACING_ATTRIBUTES = [
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "title",
  "alt",
  "label",
  // Text-carrying props of our own components; add each new one as it appears.
  "heading",
  "description",
  "emptyText",
  "message",
  "subtitle",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated by Playwright:
    "playwright-report/**",
    "test-results/**",
  ]),
  // Test files: allow `any` for mocks and test utilities
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Every test file: no skipped/focused/todo tests.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "e2e/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...SKIP_SELECTORS],
    },
  },
  // e2e: no UI-state reads, no swallowed failures, no fixed sleeps, no spec
  // retries (plus the skip ban, repeated).
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SKIP_SELECTORS,
        ...GUARD_SELECTORS,
        WAIT_FOR_TIMEOUT,
        ...RETRY_SELECTORS,
      ],
      // No React in e2e: Playwright fixtures call `use(value)`, which is not a hook.
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // e2e specs take test/expect from ./fixtures (counting expect, tytax fixture).
  {
    files: ["e2e/**/*.spec.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@playwright/test", message: PLAYWRIGHT_IMPORT_MESSAGE },
            { name: "playwright/test", message: PLAYWRIGHT_IMPORT_MESSAGE },
          ],
          patterns: [{ group: ["@playwright/test/*", "playwright/test/*"], message: PLAYWRIGHT_IMPORT_MESSAGE }],
        },
      ],
    },
  },
  {
    files: ["src/**/*.tsx"],
    ignores: ["**/*.test.tsx", "**/__tests__/**"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "warn",
        {
          mode: "jsx-only",
          "jsx-attributes": { include: USER_FACING_ATTRIBUTES },
          // <Script> holds inline JS (the SW register in layout.tsx), not UI text.
          "jsx-components": { exclude: ["Trans", "Script"] },
          // aria-label={`Decrease by ${step}`} is UI text too (R11).
          "should-validate-template": true,
        },
      ],
    },
  },
  // Last, so it wins over the blocks above for these files: a test file the
  // runners would not collect is an error, whatever it contains (R09).
  {
    files: MISNAMED_TEST_FILES,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program",
          message:
            "Test file not collected by any runner: e2e specs are e2e/**/*.spec.ts, unit tests src/**/*.test.{ts,tsx} or scripts/**/*.test.ts.",
        },
      ],
    },
  },
]);

export default eslintConfig;
