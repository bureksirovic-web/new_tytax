import type { ProgramTemplate } from '@/contracts/domain';

export const BW_FUNDAMENTALS: ProgramTemplate = {
  presetId: 'bw-fundamentals',
  name: 'BW Fundamentals',
  splitType: 'full_body',
  frequency: 3,
  periodizationType: 'linear',
  periodizationConfig: {
    type: 'linear',
    linearIncrement: 1,
    linearFrequencyWeeks: 2,
  },
  sessionOrder: ['Full Body A', 'Full Body B', 'Full Body C'],
  modalitiesUsed: ['bodyweight'],
  isPreset: true,
  currentSessionIndex: 0,
  sessions: [
    {
      id: 'bw-fundamentals-a',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Full Body A',
      dayIndex: 0,
      exercises: [
        { exerciseId: 'bw_push_standard-push-up', exerciseName: 'Push-Up', modality: 'bodyweight', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'bw_pull_pull-up', exerciseName: 'Pull-Up', modality: 'bodyweight', sets: 3, reps: '5-8', restSeconds: 120 },
        { exerciseId: 'bw_squat_air-squat', exerciseName: 'Air Squat', modality: 'bodyweight', sets: 3, reps: '15-20', restSeconds: 60 },
        { exerciseId: 'bw_hinge_glute-bridge', exerciseName: 'Glute Bridge', modality: 'bodyweight', sets: 3, reps: '15-20', restSeconds: 60 },
        { exerciseId: 'bw_plank_forearm-plank', exerciseName: 'Forearm Plank', modality: 'bodyweight', sets: 3, reps: '30-45s', restSeconds: 60 },
      ],
    },
    {
      id: 'bw-fundamentals-b',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Full Body B',
      dayIndex: 1,
      exercises: [
        { exerciseId: 'bw_hspu_pike-push-up', exerciseName: 'Pike Push-Up', modality: 'bodyweight', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'bw_row_inverted-row', exerciseName: 'Inverted Row', modality: 'bodyweight', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'bw_lunge_walking-lunge', exerciseName: 'Walking Lunge', modality: 'bodyweight', sets: 3, reps: '10/side', restSeconds: 60 },
        { exerciseId: 'bw_hinge_single-leg-glute-bridge', exerciseName: 'Single-Leg Glute Bridge', modality: 'bodyweight', sets: 3, reps: '12/side', restSeconds: 60 },
        { exerciseId: 'bw_core_hollow-body', exerciseName: 'Hollow Body Hold', modality: 'bodyweight', sets: 3, reps: '20-30s', restSeconds: 60 },
      ],
    },
    {
      id: 'bw-fundamentals-c',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Full Body C',
      dayIndex: 2,
      exercises: [
        { exerciseId: 'bw_dip_parallel-bar-dip', exerciseName: 'Parallel Bar Dip', modality: 'bodyweight', sets: 3, reps: '6-10', restSeconds: 90 },
        { exerciseId: 'bw_pull_chin-up', exerciseName: 'Chin-Up', modality: 'bodyweight', sets: 3, reps: '5-8', restSeconds: 120 },
        { exerciseId: 'bw_squat_bulgarian-split-squat', exerciseName: 'Bulgarian Split Squat', modality: 'bodyweight', sets: 3, reps: '8/side', restSeconds: 90 },
        { exerciseId: 'bw_core_leg-raise', exerciseName: 'Lying Leg Raise', modality: 'bodyweight', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'bw_side_side-plank', exerciseName: 'Side Plank', modality: 'bodyweight', sets: 3, reps: '30s/side', restSeconds: 60 },
      ],
    },
  ],
};

/** Stable preset id of the youth calisthenics starter (family-profiles plan, 2026-09-27). */
export const BW_YOUTH_DIPBAR_START_PRESET_ID = 'bw-youth-dipbar-start';

/**
 * "Calisthenics Start (dip bars, youth)": a beginner under 16 with home dip
 * bars and a TYTAX T1 (upper/lower pulley, leg extension/curl, pull-up
 * handles). 3 full-body sessions in a 7-slot rotation (A, Rest, B, Rest, C,
 * Rest, Rest — never two training days back to back, even across the wrap).
 * Technique first, no failure work: 1-3 sets of 6-15 reps or 10-30 s holds.
 * TYTAX work is light technique only, from a reviewed allow-list (never the
 * Smith machine): upper-pulley lat pulldown, lower-pulley seated cable row
 * (bench), upper-pulley face pull (rope), seated leg extension, seated leg
 * curl, all at 12-15 reps for 1-2 sets. See `youth_preset_safety` (i18n) for
 * the supervision note shown on the programs screen for this preset id.
 */
export const BW_YOUTH_DIPBAR_START: ProgramTemplate = {
  presetId: BW_YOUTH_DIPBAR_START_PRESET_ID,
  name: 'Calisthenics Start (dip bars, youth)',
  splitType: 'full_body',
  frequency: 3,
  periodizationType: 'none',
  sessionOrder: ['Calisthenics A', 'Rest', 'Calisthenics B', 'Rest', 'Calisthenics C', 'Rest', 'Rest'],
  modalitiesUsed: ['bodyweight', 'tytax'],
  isPreset: true,
  currentSessionIndex: 0,
  sessions: [
    {
      id: 'bw-youth-a',
      programId: '', // presets get an id when installed
      name: 'Calisthenics A',
      dayIndex: 0,
      exercises: [
        { exerciseId: 'bw_upper_dip-support-hold', exerciseName: 'Dip Support Hold', modality: 'bodyweight', sets: 2, reps: '10-20s', restSeconds: 60 },
        { exerciseId: 'bw_push_incline-push-up', exerciseName: 'Incline Push-Up', modality: 'bodyweight', sets: 2, reps: '8-12', restSeconds: 60 },
        { exerciseId: 'bw_row_incline-row', exerciseName: 'Incline Row', modality: 'bodyweight', sets: 2, reps: '8-12', restSeconds: 60 },
        { exerciseId: 'bw_squat_air-squat', exerciseName: 'Air Squat', modality: 'bodyweight', sets: 2, reps: '12-15', restSeconds: 45 },
        { exerciseId: 'bw_core_hollow-body', exerciseName: 'Hollow Body Hold', modality: 'bodyweight', sets: 2, reps: '15-20s', restSeconds: 45 },
        { exerciseId: 'tytax_leg-extension_seated-leg-extension', exerciseName: 'Seated Leg Extension', modality: 'tytax', sets: 1, reps: '12-15', restSeconds: 45 },
      ],
    },
    {
      id: 'bw-youth-rest-1',
      programId: '',
      name: 'Rest',
      dayIndex: 1,
      exercises: [],
      isRest: true,
    },
    {
      id: 'bw-youth-b',
      programId: '', // presets get an id when installed
      name: 'Calisthenics B',
      dayIndex: 2,
      exercises: [
        { exerciseId: 'bw_dip_negative-dip', exerciseName: 'Negative Dip', modality: 'bodyweight', sets: 2, reps: '5-8', restSeconds: 60 },
        { exerciseId: 'bw_core_tuck-l-sit', exerciseName: 'Tuck L-Sit', modality: 'bodyweight', sets: 2, reps: '10-20s', restSeconds: 60 },
        { exerciseId: 'bw_core_dip-bar-knee-raise', exerciseName: 'Dip-Bar Knee Raise', modality: 'bodyweight', sets: 2, reps: '8-12', restSeconds: 45 },
        { exerciseId: 'bw_lunge_reverse-lunge', exerciseName: 'Reverse Lunge', modality: 'bodyweight', sets: 2, reps: '10-12/side', restSeconds: 45 },
        { exerciseId: 'bw_plank_forearm-plank', exerciseName: 'Forearm Plank', modality: 'bodyweight', sets: 2, reps: '20-30s', restSeconds: 45 },
        { exerciseId: 'tytax_leg-curl_seated-leg-curl', exerciseName: 'Seated Leg Curl', modality: 'tytax', sets: 1, reps: '12-15', restSeconds: 45 },
      ],
    },
    {
      id: 'bw-youth-rest-2',
      programId: '',
      name: 'Rest',
      dayIndex: 3,
      exercises: [],
      isRest: true,
    },
    {
      id: 'bw-youth-c',
      programId: '', // presets get an id when installed
      name: 'Calisthenics C',
      dayIndex: 4,
      exercises: [
        { exerciseId: 'bw_pull_dead-hang', exerciseName: 'Dead Hang', modality: 'bodyweight', sets: 2, reps: '10-20s', restSeconds: 60 },
        { exerciseId: 'bw_hinge_glute-bridge', exerciseName: 'Glute Bridge', modality: 'bodyweight', sets: 2, reps: '12-15', restSeconds: 45 },
        { exerciseId: 'bw_push_incline-push-up', exerciseName: 'Incline Push-Up', modality: 'bodyweight', sets: 2, reps: '8-12', restSeconds: 60 },
        {
          exerciseId: 'tytax_back-upper-pulley_upper-pulley-neutral-grip-lat-pulldown-v-handle',
          exerciseName: 'Upper Pulley Neutral-Grip Lat Pulldown (V-handle)',
          modality: 'tytax',
          sets: 2,
          reps: '12-15',
          restSeconds: 60,
        },
        {
          exerciseId: 'tytax_back-lower-pulley_lower-pulley-seated-cable-row-bench',
          exerciseName: 'Lower Pulley Seated Cable Row (bench)',
          modality: 'tytax',
          sets: 2,
          reps: '12-15',
          restSeconds: 60,
        },
        {
          exerciseId: 'tytax_back-upper-pulley_upper-pulley-face-pull-rope',
          exerciseName: 'Upper Pulley Face Pull (rope)',
          modality: 'tytax',
          sets: 1,
          reps: '12-15',
          restSeconds: 45,
        },
      ],
    },
    {
      id: 'bw-youth-rest-3',
      programId: '',
      name: 'Rest',
      dayIndex: 5,
      exercises: [],
      isRest: true,
    },
    {
      id: 'bw-youth-rest-4',
      programId: '',
      name: 'Rest',
      dayIndex: 6,
      exercises: [],
      isRest: true,
    },
  ],
};

export const BW_PRESETS: ProgramTemplate[] = [BW_FUNDAMENTALS, BW_YOUTH_DIPBAR_START];
