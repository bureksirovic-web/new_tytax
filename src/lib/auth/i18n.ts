/**
 * Auth UI strings. The keys are requested from G4's dictionary in
 * docs/v2/requests/G5-i18n.md (same keys, same values; a test keeps them in
 * sync). Until they are merged, the dictionary's own fallback returns the key
 * itself, so useAuthT() falls back to these values instead of showing a raw key.
 */
import type { Locale } from '@/lib/i18n';

export const AUTH_STRINGS = {
  en: {
    'auth.login.title': 'TYTAX',
    'auth.login.subtitle': 'Training Companion',
    'auth.login.email_label': 'Email',
    'auth.login.email_placeholder': 'you@example.com',
    'auth.login.submit': 'Continue with Email',
    'auth.login.sent_title': 'Check your email for a magic link',
    'auth.login.sent_body': 'Click the link in the email to sign in. You can close this tab.',
    'auth.login.continue_without_account': 'Continue without account',
    'auth.error.auth_failed': 'Sign-in failed. Please request a new link.',
    'auth.error.auth_not_configured': 'Accounts are not available on this installation. You can still use the app without an account.',
    'auth.error.missing_code': 'The sign-in link is incomplete. Please request a new one.',
    'auth.error.auth_exchange_failed': 'Sign-in could not be completed. The link may have expired or already been used.',
    'auth.error.otp_expired': 'This sign-in link has expired. Please request a new one.',
    'auth.error.access_denied': 'Sign-in was denied. Please request a new link.',
    'auth.error.invalid_email': 'Enter a valid email address.',
    'auth.error.send_failed': 'The sign-in email could not be sent. Please try again.',
  },
  hr: {
    'auth.login.title': 'TYTAX',
    'auth.login.subtitle': 'Trenažni pratitelj',
    'auth.login.email_label': 'E-mail',
    'auth.login.email_placeholder': 'ti@primjer.hr',
    'auth.login.submit': 'Nastavi s e-mailom',
    'auth.login.sent_title': 'Provjeri e-mail: poslali smo ti poveznicu za prijavu',
    'auth.login.sent_body': 'Klikni poveznicu u e-mailu za prijavu. Ovu karticu možeš zatvoriti.',
    'auth.login.continue_without_account': 'Nastavi bez računa',
    'auth.error.auth_failed': 'Prijava nije uspjela. Zatraži novu poveznicu.',
    'auth.error.auth_not_configured': 'Korisnički računi nisu dostupni u ovoj instalaciji. Aplikaciju i dalje možeš koristiti bez računa.',
    'auth.error.missing_code': 'Poveznica za prijavu je nepotpuna. Zatraži novu.',
    'auth.error.auth_exchange_failed': 'Prijavu nije bilo moguće dovršiti. Poveznica je možda istekla ili je već iskorištena.',
    'auth.error.otp_expired': 'Ova poveznica za prijavu je istekla. Zatraži novu.',
    'auth.error.access_denied': 'Prijava je odbijena. Zatraži novu poveznicu.',
    'auth.error.invalid_email': 'Upiši ispravnu e-mail adresu.',
    'auth.error.send_failed': 'E-mail za prijavu nije poslan. Pokušaj ponovno.',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type AuthKey = keyof (typeof AUTH_STRINGS)['en'];

type AuthErrorKey = Extract<AuthKey, `auth.error.${string}`>;

/** Maps an `?error=` code to its i18n key; unknown or missing codes → auth.error.auth_failed. */
export function authErrorKey(code: string | null | undefined): AuthErrorKey {
  const key = `auth.error.${code ?? ''}`;
  return Object.prototype.hasOwnProperty.call(AUTH_STRINGS.en, key)
    ? (key as AuthErrorKey)
    : 'auth.error.auth_failed';
}

/**
 * Resolve an auth key through the app's translate function first; if it only
 * echoes the key back (its fallback for unknown keys), use AUTH_STRINGS.
 */
export function translateAuth(
  key: AuthKey,
  locale: string,
  translate?: (key: string) => string | undefined
): string {
  const fromDictionary = translate?.(key);
  if (fromDictionary && fromDictionary !== key) return fromDictionary;
  const table = locale === 'hr' ? AUTH_STRINGS.hr : AUTH_STRINGS.en;
  return table[key];
}
