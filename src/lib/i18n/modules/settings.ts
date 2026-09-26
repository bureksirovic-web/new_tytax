// i18n keys for the settings screen(s). en and hr live side by side; the Record
// type makes tsc enforce hr/en parity inside this module. Key prefix convention
// is in modules/README.md; keys must be unique across modules (tested).
export const settingsEn = {
} as const;

export const settingsHr: Record<keyof typeof settingsEn, string> = {
};
