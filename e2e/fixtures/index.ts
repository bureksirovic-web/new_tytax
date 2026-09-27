/**
 * e2e fixture API. Specs import `test` and `expect` from here, never from
 * '@playwright/test' (lint-enforced): `expect` counts calls for the
 * ≥3-expects rule and `test` provides the `tytax` seeding fixture.
 */
export { test, expect, MIN_EXPECTS } from './test';
export type { TytaxFixture } from './seed';
export type {
  E2EHooks,
  E2EStateSnapshot,
  SeedExerciseInput,
  SeedLogInput,
  SeedProfileInput,
  SeedProgramInput,
  SeedSetInput,
} from '../../src/contracts/fixtures';
export type { Profile, Program, WorkoutLog } from '../../src/contracts/domain';
export type { FullConfig, Locator, Page } from '@playwright/test';
export { createTytax, waitForApp } from './seed';
