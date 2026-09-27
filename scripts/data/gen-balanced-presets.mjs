// Recovery-balanced TYTAX presets. Run: node scripts/data/gen-balanced-presets.mjs (writes src/data/tytax/presets-balanced.ts).
import fs from 'node:fs';
const cat = JSON.parse(fs.readFileSync('src/data/tytax/exercises.json', 'utf8'));
const byId = new Map(cat.map(e => [e.id, e]));
const T = s => 'tytax_' + s;
// [id, sets, reps, restSeconds]
const BAL = {
  'Upper A': [ // heavy: strength range, long rests
    [T('smith-machine_smith-flat-bench-press'), 4, '5-8', 150],
    [T('back-upper-pulley_upper-pulley-underhand-lat-pulldown'), 3, '6-10', 120],
    [T('back-lower-pulley_lower-pulley-chest-supported-row-bench-incline'), 3, '8-10', 120],
    [T('smith-machine_smith-seated-shoulder-press'), 3, '6-10', 120],
    [T('back-lower-pulley_lower-pulley-lean-away-lateral-raise'), 3, '12-15/side', 60],
    [T('back-upper-pulley_upper-pulley-face-pull-rope'), 2, '15-20', 60],
  ],
  'Lower A': [ // heavy squat day (the week's only heavy axial squat)
    [T('smith-machine_smith-back-squat'), 4, '5-8', 180],
    [T('leg-curl_seated-leg-curl'), 3, '8-12', 90],
    [T('smith-machine_smith-hip-thrust'), 3, '8-12', 120],
    [T('smith-machine_smith-standing-calf-raise'), 3, '10-15', 60],
    [T('back-upper-pulley_upper-pulley-kneeling-cable-crunch'), 3, '10-15', 60],
  ],
  'Upper B': [ // moderate: hypertrophy range
    [T('smith-machine_smith-incline-bench-press'), 3, '8-12', 120],
    [T('back-upper-pulley_upper-pulley-neutral-grip-lat-pulldown-v-handle'), 3, '8-12', 90],
    [T('back-lower-pulley_lower-pulley-wide-grip-seated-cable-row'), 3, '8-12', 90],
    [T('back-lower-pulley_lower-pulley-single-arm-lateral-raise'), 3, '12-15/side', 60],
    [T('back-lower-pulley_lower-pulley-bayesian-curl-cable-behind-body'), 3, '10-15/side', 60],
    [T('back-upper-pulley_upper-pulley-overhead-triceps-extension-rope'), 3, '10-15', 60],
  ],
  'Lower B': [ // hinge day (the week's only heavy hinge), 48 h after the squat
    [T('smith-machine_smith-romanian-deadlift-rdl'), 3, '6-10', 150],
    [T('smith-machine_smith-lying-leg-press-bench-setup'), 3, '10-12', 120],
    [T('leg-extension_seated-leg-extension'), 3, '12-15', 60],
    [T('smith-machine_smith-seated-calf-raise-bench-setup'), 3, '12-20', 60],
    [T('back-lower-pulley_lower-pulley-pallof-press-anti-rotation-hold'), 2, '10-12/side', 60],
  ],
  'Upper C': [ // light: pump range, short rests, no heavy pressing
    [T('back-lower-pulley_lower-pulley-low-to-high-single-arm-cable-fly'), 3, '12-15/side', 60],
    [T('back-upper-pulley_upper-pulley-single-arm-kneeling-lat-pulldown'), 3, '10-15/side', 60],
    [T('back-lower-pulley_lower-pulley-rope-row-elbows-high-for-rear-delts'), 3, '12-15', 60],
    [T('back-lower-pulley_lower-pulley-single-arm-lateral-raise'), 3, '15-20/side', 45],
    [T('back-lower-pulley_lower-pulley-preacher-curl-bench-support'), 3, '12-15', 60],
    [T('back-upper-pulley_upper-pulley-rope-triceps-pushdown'), 2, '12-15', 60],
  ],
  'Lower C': [ // light, unilateral, low spinal load, before the rest day
    [T('smith-machine_smith-bulgarian-split-squat'), 2, '10-12/leg', 90],
    [T('back-lower-pulley_lower-pulley-kneeling-hamstring-curl-ankle-strap'), 3, '10-15/leg', 60],
    [T('smith-machine_smith-single-leg-hip-thrust'), 2, '10-15/leg', 60],
    [T('smith-machine_smith-single-leg-standing-calf-raise'), 2, '12-20/leg', 60],
    [T('back-upper-pulley_upper-pulley-high-to-low-woodchop'), 2, '10-15/side', 60],
  ],
};
// Elite v3.1: same recovery skeleton, top-of-range volume (+1 set on main lifts, one extra accessory per session).
const ELITE = JSON.parse(JSON.stringify(BAL));
const bump = (s, i, n = 1) => { ELITE[s][i][1] += n; };
bump('Upper B', 0); bump('Upper B', 1); bump('Lower B', 0); bump('Lower B', 1);
bump('Upper A', 1); bump('Upper A', 5);
ELITE['Lower A'].push([T('leg-extension_seated-leg-extension'), 2, '12-15', 60]);
ELITE['Lower B'].push([T('leg-curl_seated-leg-curl-2s-squeeze-slow-eccentric'), 2, '10-12', 60]);
ELITE['Upper C'][5][1] = 3;
ELITE['Lower C'][0][1] = 3;

const ORDER = ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C'];
function tpl(constName, presetId, name, idPrefix, spec) {
  const sessions = ORDER.map((n, i) => {
    const ex = spec[n].map(([id, sets, reps, rest]) => { const e = byId.get(id); if (!e) throw new Error('missing ' + id);
      return `        { exerciseId: '${id}', exerciseName: ${JSON.stringify(e.name)}, modality: 'tytax', sets: ${sets}, reps: '${reps}', restSeconds: ${rest} },`; });
    return `    {\n      id: '${idPrefix}-${n.toLowerCase().replace(' ', '-')}',\n      programId: '', // presets get an id when installed\n      name: '${n}',\n      dayIndex: ${i},\n      exercises: [\n${ex.join('\n')}\n      ],\n    },`;
  });
  sessions.push(`    {\n      id: '${idPrefix}-rest',\n      programId: '',\n      name: 'Rest',\n      dayIndex: 6,\n      exercises: [],\n      isRest: true,\n    },`);
  return `export const ${constName}: ProgramTemplate = {\n  presetId: '${presetId}',\n  name: '${name}',\n  splitType: 'upper_lower',\n  frequency: 6,\n  periodizationType: 'none',\n  sessionOrder: [${[...ORDER, 'Rest'].map(s => `'${s}'`).join(', ')}],\n  modalitiesUsed: ['tytax'],\n  isPreset: true,\n  currentSessionIndex: 0,\n  sessions: [\n${sessions.join('\n')}\n  ],\n};\n`;
}
const out = `// GENERATED by scripts/data/gen-balanced-presets.mjs from the recovery-balance spec; edit the spec, not this file.
import type { ProgramTemplate } from '@/contracts/domain';

/**
 * Recovery-balanced 6-day upper/lower split (2026-09-27).
 * - Upper and lower alternate, so every muscle gets 48 h before it is trained again, and no muscle
 *   takes 3+ fractional sets on two consecutive days (tested in data-integrity).
 * - Intensity undulates A heavy (5-10 reps, long rests) > B moderate (8-15) > C light (10-20, short rests):
 *   the lightest two sessions come right before the rest day.
 * - One heavy axial squat (Lower A) and one heavy hinge (Lower B) per week; Lower C is unilateral.
 * - Weekly fractional sets per muscle sit in 6-14 (see the data-integrity bounds).
 */
${tpl('TYTAX_BALANCED_6DAY', 'tytax-balanced-6day', 'TYTAX 6-Day Balanced', 'preset-tytax-bal', BAL)}
/** Elite v3.1: the balanced skeleton at top-of-range volume (replaces v3.0, which trained arms and delts on back-to-back days). */
${tpl('TYTAX_ELITE_V3', 'tytax-elite-v3', 'Tytax Elite v3.1', 'preset-tytax', ELITE)}`;
fs.writeFileSync('src/data/tytax/presets-balanced.ts', out);
console.log('written', out.split('\n').length, 'lines');
