// i18n keys for the exercises screen(s). en and hr live side by side; the Record
// type makes tsc enforce hr/en parity inside this module. Key prefix convention
// is in modules/README.md; keys must be unique across modules (tested).
export const exercisesEn = {
} as const;

export const exercisesHr: Record<keyof typeof exercisesEn, string> = {
};
