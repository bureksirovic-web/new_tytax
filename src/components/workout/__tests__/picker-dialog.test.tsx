import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { PickerDialog } from '../picker-dialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <LocaleProvider>
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <PickerDialog title="Pick" testId="dlg" closeTestId="dlg-close" onClose={() => setOpen(false)}>
          <button type="button" data-testid="inside-last">
            last
          </button>
        </PickerDialog>
      )}
    </LocaleProvider>
  );
}

describe('PickerDialog focus', () => {
  it('moves focus in, wraps Tab both ways, locks scroll and restores focus on Escape', () => {
    render(<Harness />);
    const opener = screen.getByTestId('opener');
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByTestId('dlg-close');
    const last = screen.getByTestId('inside-last');
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('dlg')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('');
  });
});
