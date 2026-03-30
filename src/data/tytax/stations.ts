export interface TytaxStation {
  id: string;
  name: string;
  shortName: string;
  description: string;
  exercises?: string[]; // loaded dynamically
}

export const TYTAX_STATIONS: TytaxStation[] = [
  {
    id: 'smith',
    name: 'Smith Machine',
    shortName: 'Smith',
    description: 'Fixed guided barbell for presses, squats, rows, and shoulder work',
  },
  {
    id: 'back-upper',
    name: 'Back Upper Pulley',
    shortName: 'Upper Cable',
    description: 'High cable pulley for pulldowns, pushdowns, face pulls, and overhead work',
  },
  {
    id: 'back-lower',
    name: 'Back Lower Pulley',
    shortName: 'Lower Cable',
    description: 'Low cable pulley for rows, curls, pull-throughs, and wrist work',
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    shortName: 'Leg Ext',
    description: 'Seated leg extension machine for quad isolation',
  },
  {
    id: 'leg-curl',
    name: 'Leg Curl',
    shortName: 'Leg Curl',
    description: 'Seated leg curl machine for hamstring isolation',
  },
  {
    id: 'tytax',
    name: 'Tytax (Multi-station)',
    shortName: 'Multi',
    description: 'General TYTAX T1 exercises using multiple stations',
  },
];
