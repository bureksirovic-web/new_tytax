/**
 * Exact counts the synthetic fixtures must produce. Shared by the parser tests
 * and the later AC10 repository-import test (`npm test -- legacy-import`).
 */
export interface ExpectedUser {
  logs: number;
  skippedLogs: number;
  exercises: number;
  sets: number;
  warmupSets: number;
  bodyweight: number;
  customProtocols: number;
  planSessions: number;
  sessionOrder: number;
}

export interface ExpectedFixture {
  file: string;
  format: 'app-backup' | 'localstorage-dump';
  users: Record<string, ExpectedUser>;
  sharedCustomProtocols: number;
  warnings: number;
}

export const MULTI_USER_DUMP: ExpectedFixture = {
  file: 'multi-user-dump.json',
  format: 'localstorage-dump',
  users: {
    Ana: { logs: 3, skippedLogs: 1, exercises: 6, sets: 11, warmupSets: 2, bodyweight: 2, customProtocols: 1, planSessions: 3, sessionOrder: 3 },
    'Marko Horvat': { logs: 2, skippedLogs: 1, exercises: 3, sets: 5, warmupSets: 2, bodyweight: 1, customProtocols: 0, planSessions: 3, sessionOrder: 3 },
  },
  sharedCustomProtocols: 1,
  warnings: 6,
};

export const SINGLE_USER_DUMP: ExpectedFixture = {
  file: 'single-user-dump.json',
  format: 'localstorage-dump',
  users: {
    default: { logs: 2, skippedLogs: 1, exercises: 3, sets: 5, warmupSets: 2, bodyweight: 2, customProtocols: 1, planSessions: 3, sessionOrder: 3 },
  },
  sharedCustomProtocols: 0,
  warnings: 1,
};

/** The legacy "Backup" export never contained the bodyweight log, hence 0. */
export const APP_BACKUP: ExpectedFixture = {
  file: 'app-backup.json',
  format: 'app-backup',
  users: {
    default: { logs: 2, skippedLogs: 1, exercises: 4, sets: 7, warmupSets: 3, bodyweight: 0, customProtocols: 1, planSessions: 3, sessionOrder: 3 },
  },
  sharedCustomProtocols: 0,
  warnings: 1,
};

export const ALL_FIXTURES: readonly ExpectedFixture[] = [MULTI_USER_DUMP, SINGLE_USER_DUMP, APP_BACKUP];
