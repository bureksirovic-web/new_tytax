import { coreEn } from './modules/core.en';
import { sharedEn } from './modules/shared.en';
import { dashboardEn } from './modules/dashboard.en';
import { programsEn } from './modules/programs.en';
import { exercisesEn } from './modules/exercises.en';
import { historyEn } from './modules/history.en';
import { analyticsEn } from './modules/analytics.en';
import { settingsEn } from './modules/settings.en';
import { requestsEn } from './modules/requests.en';
import { g3ToolsEn } from './modules/g3Tools.en';
import { g3PickerEn } from './modules/g3Picker.en';
import { g3WorkoutEn } from './modules/g3Workout.en';
import { g3SessionEn } from './modules/g3Session.en';
import { g5AuthEn } from './modules/g5Auth.en';
import { patternsEn } from './modules/patterns.en';
import { patterns2En } from './modules/patterns2.en';
import { youthEn } from './modules/youth.en';
import { progressionEn } from './modules/progression.en';

// English dictionary: core + every module. hr.ts must carry exactly the same keys
// (parity test). Loaded lazily in the browser (`loadLocale('en')` in ./index.ts).
export const coreKeys = Object.keys(coreEn);

export const en = {
  ...coreEn,
  ...sharedEn,
  ...dashboardEn,
  ...programsEn,
  ...exercisesEn,
  ...historyEn,
  ...analyticsEn,
  ...settingsEn,
  ...requestsEn,
  ...g3ToolsEn,
  ...g3PickerEn,
  ...g3WorkoutEn,
  ...g3SessionEn,
  ...g5AuthEn,
  ...patternsEn,
  ...patterns2En,
  ...youthEn,
  ...progressionEn,
} as const;
