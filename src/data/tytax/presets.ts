import type { Program } from '@/types/program';
import { generateId } from '@/lib/utils';

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
      programId: '',
      name: 'Upper A',
      dayIndex: 0,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-flat-bench-press', exerciseName: 'Smith Flat Bench Press', modality: 'tytax', sets: 4, reps: '6-10', restSeconds: 120 },
        { exerciseId: 'tytax_back-upper-pulley_wide-grip-lat-pulldown', exerciseName: 'Wide-Grip Lat Pulldown', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'tytax_smith-machine_smith-shoulder-press', exerciseName: 'Smith Shoulder Press', modality: 'tytax', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'tytax_back-lower-pulley_standing-cable-curl', exerciseName: 'Standing Cable Curl', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_triceps-pushdown-v-bar', exerciseName: 'Triceps Pushdown (V-bar)', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_face-pull', exerciseName: 'Face Pull', modality: 'tytax', sets: 3, reps: '15-20', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-lower-a',
      programId: '',
      name: 'Lower A',
      dayIndex: 1,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-back-squat', exerciseName: 'Smith Back Squat', modality: 'tytax', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'tytax_leg-extension_leg-extension', exerciseName: 'Leg Extension', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 90 },
        { exerciseId: 'tytax_leg-curl_leg-curl', exerciseName: 'Leg Curl', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'tytax_back-lower-pulley_pull-through', exerciseName: 'Pull-Through', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'tytax_smith-machine_smith-calf-raise', exerciseName: 'Smith Calf Raise', modality: 'tytax', sets: 4, reps: '15-20', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_cable-crunch', exerciseName: 'Cable Crunch', modality: 'tytax', sets: 3, reps: '12-20', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-upper-b',
      programId: '',
      name: 'Upper B',
      dayIndex: 2,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-incline-bench-press', exerciseName: 'Smith Incline Bench Press', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'tytax_back-upper-pulley_close-grip-lat-pulldown', exerciseName: 'Close-Grip Lat Pulldown', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'tytax_back-lower-pulley_lateral-raise', exerciseName: 'Lateral Raise', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_rope-hammer-curl', exerciseName: 'Rope Hammer Curl', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_rope-pushdown', exerciseName: 'Rope Pushdown', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_rear-delt-fly', exerciseName: 'Rear Delt Fly', modality: 'tytax', sets: 3, reps: '15-20', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-lower-b',
      programId: '',
      name: 'Lower B',
      dayIndex: 3,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-front-squat', exerciseName: 'Smith Front Squat', modality: 'tytax', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'tytax_leg-extension_leg-extension', exerciseName: 'Leg Extension (Wide)', modality: 'tytax', sets: 3, reps: '12-15', restSeconds: 90 },
        { exerciseId: 'tytax_leg-curl_leg-curl', exerciseName: 'Leg Curl', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'tytax_smith-machine_smith-hip-thrust', exerciseName: 'Smith Hip Thrust', modality: 'tytax', sets: 3, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'tytax_back-lower-pulley_seated-calf-raise', exerciseName: 'Seated Calf Raise', modality: 'tytax', sets: 4, reps: '15-20', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_pallof-press', exerciseName: 'Pallof Press', modality: 'tytax', sets: 3, reps: '12-15/side', restSeconds: 60 },
      ],
    },
    {
      id: 'preset-tytax-upper-c',
      programId: '',
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
      programId: '',
      name: 'Lower C',
      dayIndex: 5,
      exercises: [
        { exerciseId: 'tytax_smith-machine_smith-hack-squat', exerciseName: 'Smith Hack Squat', modality: 'tytax', sets: 4, reps: '8-12', restSeconds: 150 },
        { exerciseId: 'tytax_back-lower-pulley_single-arm-lateral-raise', exerciseName: 'Single-Arm Lateral Raise', modality: 'tytax', sets: 3, reps: '12-15/side', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_bayesian-curl', exerciseName: 'Bayesian Curl', modality: 'tytax', sets: 3, reps: '10-15/side', restSeconds: 60 },
        { exerciseId: 'tytax_back-upper-pulley_single-arm-pushdown', exerciseName: 'Single-Arm Pushdown', modality: 'tytax', sets: 3, reps: '12-15/side', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_woodchop', exerciseName: 'Woodchop', modality: 'tytax', sets: 3, reps: '12-15/side', restSeconds: 60 },
        { exerciseId: 'tytax_back-lower-pulley_wrist-curl', exerciseName: 'Wrist Curl', modality: 'tytax', sets: 3, reps: '15-20', restSeconds: 45 },
      ],
    },
    {
      id: 'preset-tytax-rest',
      programId: '',
      name: 'Rest',
      dayIndex: 6,
      exercises: [],
    },
  ],
};

export const TYTAX_PRESETS = [TYTAX_ELITE_V3];
