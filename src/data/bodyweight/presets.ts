import type { Program } from '@/types/program';

export const BW_FUNDAMENTALS: Omit<Program, 'id' | 'profileId' | 'createdAt' | 'updatedAt'> = {
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
  isActive: false,
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

export const BW_PRESETS = [BW_FUNDAMENTALS];
