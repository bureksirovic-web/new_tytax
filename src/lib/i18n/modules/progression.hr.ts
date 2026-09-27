// hr strings of the progression module; see progression.en.ts for the
// convention. The Record type here makes tsc enforce hr/en key parity.
import type { progressionEn } from './progression.en';

export const progressionHr: Record<keyof typeof progressionEn, string> = {
  progstep_title: 'Spreman za sljedeći korak',
  progstep_ready_body: 'Spreman za sljedeći korak: {from} → {to}',
  progstep_youth_confirm_label: 'Provjeri s roditeljem/trenerom: je li tehnika bila dobra dvije sesije zaredom?',
  progstep_accept: 'Prijeđi na {to}',
  progstep_dismiss: 'Ne sada',
  progstep_swap_failed: 'Program nije bilo moguće ažurirati. Pokušaj ponovno.',
};
