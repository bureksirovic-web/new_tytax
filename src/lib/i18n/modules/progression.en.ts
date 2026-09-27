// i18n keys for the post-save progression-prompt card (workout debrief, piece 4
// of PLAN-family-profiles.md). en lives in <module>.en.ts, hr in <module>.hr.ts
// (one locale per file, so a locale can load on its own); the Record type in
// the .hr file makes tsc enforce hr/en parity. Keys must be unique across
// modules (tested); prefix `progstep_` to avoid colliding with `prog_`
// (programs.ts, see modules/README.md).
export const progressionEn = {
  progstep_title: 'Ready for the next step',
  progstep_ready_body: 'Ready for the next step: {from} → {to}',
  progstep_youth_confirm_label: 'Check with a parent/trainer: form looked solid for 2 sessions?',
  progstep_accept: 'Move up to {to}',
  progstep_dismiss: 'Not now',
  progstep_swap_failed: 'Could not update the program. Please try again.',
};
