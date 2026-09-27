'use client';
import { useEffect, useRef, useState } from 'react';
import type { SetupParseError, SetupPayload } from '@/lib/setup-link';
import { useT } from '@/lib/i18n/use-t';
import { useRepo } from '@/hooks/use-repo';
import type { TranslationKey } from '@/lib/i18n';
import { DEFAULT_PROFILE_NAME } from '@/components/providers/app-bootstrap';
import { applySetupPayload, type SetupProfileResult } from './setup-actions';
import { SetupPreview } from './setup-preview';
import { SetupResult } from './setup-result';
import '@/lib/i18n/packs/setup';

type Phase =
  | { kind: 'checking' }
  | { kind: 'invalid'; error: SetupParseError }
  | { kind: 'preview'; payload: SetupPayload; origin: string; programNames: Readonly<Record<string, string>> }
  | { kind: 'creating'; payload: SetupPayload; origin: string; programNames: Readonly<Record<string, string>> }
  | { kind: 'cancelled' }
  | { kind: 'result'; results: SetupProfileResult[] }
  | { kind: 'failed' };

const ERROR_KEY: Record<SetupParseError, TranslationKey> = {
  too_long: 'link_error_too_long',
  missing_payload: 'link_error_missing_payload',
  bad_base64: 'link_error_bad_base64',
  bad_json: 'link_error_bad_json',
  unsafe_key: 'link_error_unsafe_key',
  invalid_schema: 'link_error_invalid_schema',
};

/** A secondary-button-styled link (a real `<a>`, so it fully navigates). */
const backLinkClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gunmetal-600 bg-gunmetal-700 px-4 text-sm font-medium text-gray-100 transition-colors duration-150 hover:bg-gunmetal-600';

/**
 * `/setup`: preview a setup link, then create its profiles on "Create".
 * Nothing is written before that (AppBootstrap also skips the normal
 * first-run profile while this route is active, see app-bootstrap.tsx).
 */
export function SetupView() {
  const { t, locale } = useT();
  const repo = useRepo();
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  // Dev-mode React runs an effect's setup, cleanup and setup again on mount
  // (Strict Mode) to surface effects that are not safe to repeat; reading and
  // clearing the fragment is not (the second run would see it already
  // cleared and report the link "invalid"). This ref makes the real work run
  // exactly once per mount, the same problem AppBootstrap's `booting` promise
  // guards against for `ensureActive`.
  const consumed = useRef(false);

  useEffect(() => {
    // Capture and clear the fragment immediately, valid or not (amendments
    // after 1b): a screenshot or the browser history never carries it. This
    // has to be an effect, not a useState lazy initializer: `window` does not
    // exist during the server render, and computing the real phase on the
    // client's first render would then mismatch the server's "checking" HTML.
    if (consumed.current) return;
    consumed.current = true;
    const hash = window.location.hash;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    void (async () => {
      // Lazy: the strict zod schema and the full preset catalog would
      // otherwise ship in this route's first-load JS (check-bundle budget).
      // "checking" covers the extra tick; setup-view.test.tsx pins it.
      const [{ parseSetupFragment }, { getPresetById }] = await Promise.all([
        import('@/lib/setup-link'),
        import('@/lib/programs/presets'),
      ]);
      const result = parseSetupFragment(hash);
      if (!result.ok) {
        setPhase({ kind: 'invalid', error: result.error });
        return;
      }
      const programNames: Record<string, string> = {};
      for (const profile of result.payload.profiles) {
        programNames[profile.presetId] = getPresetById(profile.presetId)?.name ?? profile.presetId;
      }
      setPhase({ kind: 'preview', payload: result.payload, origin: window.location.origin, programNames });
    })();
  }, []);

  async function handleCreate() {
    if (phase.kind !== 'preview') return;
    setPhase({ kind: 'creating', payload: phase.payload, origin: phase.origin, programNames: phase.programNames });
    try {
      const results = await applySetupPayload(repo, phase.payload, {
        defaultProfileName: DEFAULT_PROFILE_NAME,
        fallbackLanguage: locale,
      });
      setPhase({ kind: 'result', results });
    } catch (error: unknown) {
      console.error('[setup] create failed', error);
      setPhase({ kind: 'failed' });
    }
  }

  function handleCancel() {
    setPhase({ kind: 'cancelled' });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg-primary)]">
      <div className="w-full max-w-md rounded-xl border p-6 space-y-4 bg-[var(--bg-secondary)] border-[var(--border-color)]">
        {phase.kind === 'checking' && (
          <p role="status" className="text-sm text-[var(--text-muted)]" data-testid="setup-checking">
            {t('link_checking')}
          </p>
        )}

        {phase.kind === 'invalid' && (
          <div className="space-y-4" data-testid="setup-invalid">
            <h1 className="font-display text-lg font-semibold uppercase tracking-wide text-[var(--text-primary)]">
              {t('link_invalid_title')}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">{t(ERROR_KEY[phase.error])}</p>
            <a href="/dashboard" data-testid="setup-invalid-back" className={backLinkClass}>
              {t('link_invalid_back')}
            </a>
          </div>
        )}

        {(phase.kind === 'preview' || phase.kind === 'creating') && (
          <SetupPreview
            payload={phase.payload}
            origin={phase.origin}
            programNames={phase.programNames}
            busy={phase.kind === 'creating'}
            onCreate={() => void handleCreate()}
            onCancel={handleCancel}
          />
        )}

        {phase.kind === 'cancelled' && (
          <div className="space-y-4 text-center" role="status" data-testid="setup-cancelled">
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('link_cancelled_title')}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('link_cancelled_body')}</p>
            <a href="/dashboard" data-testid="setup-cancelled-back" className={backLinkClass}>
              {t('link_invalid_back')}
            </a>
          </div>
        )}

        {phase.kind === 'result' && <SetupResult results={phase.results} />}

        {phase.kind === 'failed' && (
          <div className="space-y-4" data-testid="setup-failed">
            <p className="text-sm text-red-400">{t('link_action_failed')}</p>
          </div>
        )}
      </div>
    </main>
  );
}
