// i18n keys for the shared screen(s). en lives in <module>.en.ts, hr in <module>.hr.ts
// (one locale per file, so a locale can load on its own); the Record
// type makes tsc enforce hr/en parity inside this module. Key prefix convention
// is in modules/README.md; keys must be unique across modules (tested).
import type { sharedEn } from './shared.en';

export const sharedHr: Record<keyof typeof sharedEn, string> = {
};
