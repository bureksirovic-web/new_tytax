// i18n keys for the programs screen(s). en and hr live side by side; the Record
// type makes tsc enforce hr/en parity inside this module. Key prefix convention
// is in modules/README.md; keys must be unique across modules (tested).
export const programsEn = {
} as const;

export const programsHr: Record<keyof typeof programsEn, string> = {
};
