import type { Program } from '@/types/program';

// The classic Tytax Elite v3.0 - 6-day + 1 rest rotation
export const TYTAX_ELITE_V3: Omit<Program, 'id' | 'profileId' | 'createdAt' | 'updatedAt'> = {
  name: 'Tytax Elite v3.0',
  splitType: 'custom',
  frequency: 6,
  periodizationType: 'none',
  sessionOrder: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C', 'Rest'],
  modalitiesUsed: ['tytax'],
  isActive: false,
  isPreset: true,
  currentSessionIndex: 0,
  sessions: [
    {
      id: 'preset-tytax-upper-a',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Upper A',
      dayIndex: 0,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-flat-bench-press', exerciseName: 'Smith Flat Bench Press', modality: 'tytax', sets: 4, reps: '6-10', restSeconds: 120 },
        { exerciseId: 'tytax_back-upper-pulley_upper-pulley-wide-grip-lat-pulldown', exerciseName: 'Upper Pulley Wide-Grip Lat Pulldown', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'tytax_smith-machine_seated-smith-shoulder-press', exerciseName: 'Seated Smith Shoulder Press', modality: 'tytax', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'tytax_back-lower-pulley_lower-pulley-standing-cable-curl-straight-bar', exerciseName: 'Lower Pulley Standing Cable Curl (straight bar)', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_upper-pulley-triceps-pushdown-v-bar', exerciseName: 'Upper Pulley Triceps Pushdown (V-bar)', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_upper-pulley-face-pull-rope', exerciseName: 'Upper Pulley Face Pull (rope)', modality: 'tytax', sets: 3, reps: '15-20', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-lower-a',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Lower A',
      dayIndex: 1,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-back-squat', exerciseName: 'Smith Back Squat', modality: 'tytax', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'tytax_leg-extension_seated-leg-extension', exerciseName: 'Seated Leg Extension', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 90 },
        { exerciseId: 'tytax_leg-curl_seated-leg-curl', exerciseName: 'Seated Leg Curl', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'tytax_back-lower-pulley_pull-through', exerciseName: 'Pull-Through', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'tytax_smith-machine_smith-standing-calf-raise', exerciseName: 'Smith Standing Calf Raise', modality: 'tytax', sets: 4, reps: '15-20', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_cable-crunch', exerciseName: 'Cable Crunch', modality: 'tytax', sets: 3, reps: '12-20', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-upper-b',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Upper B',
      dayIndex: 2,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-incline-bench-press', exerciseName: 'Smith Incline Bench Press', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'tytax_back-upper-pulley_close-grip-lat-pulldown', exerciseName: 'Close-Grip Lat Pulldown', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'tytax_back-lower-pulley_lateral-raise', exerciseName: 'Lateral Raise', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_lower-pulley-rope-hammer-curl', exerciseName: 'Lower Pulley Rope Hammer Curl', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_upper-pulley-rope-triceps-pushdown', exerciseName: 'Upper Pulley Rope Triceps Pushdown', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'tytax_tytax_rear-delt-fly', exerciseName: 'Rear Delt Fly', modality: 'tytax', sets: 3, reps: '15-20', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-lower-b',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Lower B',
      dayIndex: 3,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-front-squat-cross-arm', exerciseName: 'Smith Front Squat (cross-arm)', modality: 'tytax', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'tytax_leg-extension_seated-leg-extension', exerciseName: 'Seated Leg Extension', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 90 },
        { exerciseId: 'tytax_leg-curl_seated-leg-curl', exerciseName: 'Seated Leg Curl', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'tytax_smith-machine_smith-hip-thrust', exerciseName: 'Smith Hip Thrust', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'tytax_back-lower-pulley_seated-calf-raise', exerciseName: 'Seated Calf Raise', modality: 'tytax', sets: 4, reps: '15-20', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_lower-pulley-pallof-press-anti-rotation-hold', exerciseName: 'Lower Pulley Pallof Press (anti-rotation hold)', modality: 'tytax', sets: 3, reps: '12-15/side', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-upper-c',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Upper C',
      dayIndex: 4,
      exercises: [
        { exerciseId: 'tytax_back-upper-pulley_cable-fly-high-to-low', exerciseName: 'Cable Fly (High-to-Low)', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 90 },
        { exerciseId: 'tytax_back-lower-pulley_seated-cable-row', exerciseName: 'Seated Cable Row', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'tytax_back-upper-pulley_overhead-triceps-extension', exerciseName: 'Overhead Triceps Extension', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_preacher-curl', exerciseName: 'Preacher Curl', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'tytax_smith-machine_smith-shrug', exerciseName: 'Smith Shrug', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_y-raise', exerciseName: 'Y-Raise', modality: 'tytax', sets: 3, reps: '15-20', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-lower-c',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Lower C',
      dayIndex: 5,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-hack-squat-feet-forward', exerciseName: 'Smith Hack Squat (feet forward)', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 150 },
        { exerciseId: 'tytax_back-lower-pulley_single-arm-lateral-raise', exerciseName: 'Single-Arm Lateral Raise', modality: 'tytax', sets: 3, reps: '12-15/side', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_bayesian-curl', exerciseName: 'Bayesian Curl', modality: 'tytax', sets: 3, reps: '10-15/side', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_upper-pulley-single-arm-triceps-pushdown', exerciseName: 'Upper Pulley Single-Arm Triceps Pushdown', modality: 'tytax', sets: 3, reps: '12-15/side', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_woodchop', exerciseName: 'Woodchop', modality: 'tytax', sets: 3, reps: '12-15/side', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_wrist-curl', exerciseName: 'Wrist Curl', modality: 'tytax', sets: 3, reps: '15-20', restSeconds: 45 },
      ],
    },
    {
      id: 'preset-tytax-rest',
      programId: '', // Intentional: presets don't have IDs until installed
      name: 'Rest',
      dayIndex: 6,
      exercises: [],
    },
  ],
};

export const TYTAX_PRESETS = [TYTAX_ELITE_V3];
