import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { ALL_PRESETS, getPresetById } from '@/lib/programs/presets';
import { PresetCard } from '../preset-card';

function renderEn(ui: ReactElement) {
  window.localStorage.setItem('locale', 'en');
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

const noop = () => {};

describe('PresetCard: youth safety note', () => {
  it('shows the supervision/safety note only for the youth preset', () => {
    const youth = getPresetById('bw-youth-dipbar-start')!;
    renderEn(<PresetCard preset={youth} installed={false} busy={false} disabled={false} onInstall={noop} />);
    expect(screen.getByTestId('preset-youth-safety')).toHaveTextContent(
      'Supervised by an adult. Warm up for 5 minutes first. Stop right away if it hurts. Technique before reps.',
    );
  });

  it('every other preset shows no safety note', () => {
    for (const preset of ALL_PRESETS.filter((p) => p.presetId !== 'bw-youth-dipbar-start')) {
      const { unmount } = renderEn(<PresetCard preset={preset} installed={false} busy={false} disabled={false} onInstall={noop} />);
      expect(screen.queryByTestId('preset-youth-safety')).toBeNull();
      unmount();
    }
  });
});
