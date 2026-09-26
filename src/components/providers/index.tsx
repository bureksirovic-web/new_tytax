'use client';
import { AppBootstrap } from './app-bootstrap';
import { LocaleProvider } from './locale-provider';
import { ThemeProvider } from './theme-provider';

export { useLocale } from './locale-provider';
export { useTheme } from './theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AppBootstrap />
        {children}
      </LocaleProvider>
    </ThemeProvider>
  );
}
