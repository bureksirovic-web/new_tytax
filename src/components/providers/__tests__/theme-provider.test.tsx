import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../theme-provider';

/** Shows the theme and toggles it. */
function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={() => setTheme(theme === 'dark' ? 'oled' : 'dark')}>
        toggle
      </button>
    </div>
  );
}

const tree = () => (
  <ThemeProvider>
    <Probe />
  </ThemeProvider>
);

const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

/** Makes the `window.localStorage` getter itself throw, as blocked site data does. */
function blockStorage(): () => number {
  let reads = 0;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      reads += 1;
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
  return () => reads;
}

describe('ThemeProvider', () => {
  afterEach(() => {
    cleanup();
    // Put the environment's own localStorage property back after blockStorage().
    if (storageDescriptor) Object.defineProperty(window, 'localStorage', storageDescriptor);
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('restores a saved theme and remembers a change', () => {
    window.localStorage.setItem('theme', 'oled');
    render(tree());

    expect(screen.getByTestId('theme').textContent).toBe('oled');
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled');
    act(() => screen.getByRole('button').click());
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('ignores an unknown saved value', () => {
    window.localStorage.setItem('theme', 'neon');
    render(tree());

    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('renders dark and still switches when the window.localStorage getter throws SecurityError', () => {
    const reads = blockStorage();

    render(tree());

    expect(reads()).toBeGreaterThan(0);
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    const before = reads();
    act(() => screen.getByRole('button').click());
    // setItem went through the throwing getter and was swallowed; the change lives in memory.
    expect(reads()).toBeGreaterThan(before);
    expect(screen.getByTestId('theme').textContent).toBe('oled');
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled');
  });
});
