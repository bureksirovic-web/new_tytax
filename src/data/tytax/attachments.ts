export interface CableAttachment {
  id: string;
  name: string;
  description: string;
  commonExercises: string[];
}

export const CABLE_ATTACHMENTS_DATA: CableAttachment[] = [
  {
    id: 'rope',
    name: 'Rope',
    description: 'Tricep rope — allows neutral grip and flared-out finish',
    commonExercises: ['Triceps Pushdown (Rope)', 'Overhead Triceps Extension', 'Face Pull', 'Rope Hammer Curl'],
  },
  {
    id: 'v-bar',
    name: 'V-Bar',
    description: 'Angled V-shaped bar for close-grip pushdowns and pulldowns',
    commonExercises: ['Triceps Pushdown (V-bar)', 'Close-Grip Lat Pulldown'],
  },
  {
    id: 'straight-bar',
    name: 'Straight Bar',
    description: 'Straight pull-down bar for standard pushdowns and curls',
    commonExercises: ['Triceps Pushdown (Bar)', 'Straight Bar Curl', 'Wrist Curl'],
  },
  {
    id: 'd-handle',
    name: 'D-Handle (pair)',
    description: 'Single D-handles for unilateral work and cable flyes',
    commonExercises: ['Cable Fly', 'Single-Arm Pulldown', 'Single-Arm Row', 'Lateral Raise'],
  },
  {
    id: 'ankle-strap',
    name: 'Ankle Strap',
    description: 'Velcro ankle strap for leg work',
    commonExercises: ['Cable Kickback', 'Cable Hip Abduction', 'Lying Leg Curl'],
  },
  {
    id: 'belt',
    name: 'Dip Belt',
    description: 'Belt with chain for weighted dips and pull-ups',
    commonExercises: ['Weighted Dip', 'Weighted Pull-Up'],
  },
  {
    id: 'lat-bar',
    name: 'Lat Bar',
    description: 'Wide lat pulldown bar',
    commonExercises: ['Wide-Grip Lat Pulldown', 'Lat Pulldown'],
  },
  {
    id: 'ez-bar',
    name: 'EZ-Bar',
    description: 'Angled EZ curl bar for comfortable wrist position',
    commonExercises: ['EZ-Bar Curl', 'EZ-Bar Pushdown'],
  },
  {
    id: 'row-handle',
    name: 'Row Handle',
    description: 'Close-grip seated row handle (V-shape, parallel grip)',
    commonExercises: ['Seated Cable Row', 'Close-Grip Row'],
  },
];

// Maps exercise names (partial match) to recommended attachment
export const EXERCISE_ATTACHMENT_MAP: Record<string, string> = {
  'rope': 'rope',
  'hammer curl': 'rope',
  'face pull': 'rope',
  'overhead triceps': 'rope',
  'v-bar': 'v-bar',
  'close-grip lat': 'v-bar',
  'lat pulldown': 'lat-bar',
  'wide-grip lat': 'lat-bar',
  'cable fly': 'd-handle',
  'single-arm': 'd-handle',
  'lateral raise': 'd-handle',
  'bayesian curl': 'd-handle',
  'seated cable row': 'row-handle',
  'close-grip row': 'row-handle',
  'wrist curl': 'straight-bar',
  'straight bar curl': 'straight-bar',
  'ankle': 'ankle-strap',
  'kickback': 'ankle-strap',
  'hip abduction': 'ankle-strap',
};
