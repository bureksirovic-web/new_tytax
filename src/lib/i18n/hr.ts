import type { TranslationKey } from './types';
import { coreHr } from './modules/core.hr';
import { sharedHr } from './modules/shared.hr';
import { dashboardHr } from './modules/dashboard.hr';
import { programsHr } from './modules/programs.hr';
import { exercisesHr } from './modules/exercises.hr';
import { historyHr } from './modules/history.hr';
import { analyticsHr } from './modules/analytics.hr';
import { settingsHr } from './modules/settings.hr';
import { requestsHr } from './modules/requests.hr';
import { g3ToolsHr } from './modules/g3Tools.hr';
import { g3PickerHr } from './modules/g3Picker.hr';
import { g3WorkoutHr } from './modules/g3Workout.hr';
import { g3SessionHr } from './modules/g3Session.hr';
import { g5AuthHr } from './modules/g5Auth.hr';
import { patternsHr } from './modules/patterns.hr';
import { patterns2Hr } from './modules/patterns2.hr';

// Croatian dictionary (default locale): core + every module, same keys as en.ts
// (parity test). For server code and tests; the browser gets core.hr.ts up front
// and each module through its pack (src/lib/i18n/packs).
export const hr: Record<TranslationKey, string> = {
  ...coreHr,
  ...sharedHr,
  ...dashboardHr,
  ...programsHr,
  ...exercisesHr,
  ...historyHr,
  ...analyticsHr,
  ...settingsHr,
  ...requestsHr,
  ...g3ToolsHr,
  ...g3PickerHr,
  ...g3WorkoutHr,
  ...g3SessionHr,
  ...g5AuthHr,
  ...patternsHr,
  ...patterns2Hr,
};
