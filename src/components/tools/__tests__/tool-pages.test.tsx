import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';

// G4-02: nav.spec finds each route by its h1's `page-heading-<name>` test id.
vi.mock('@/hooks/use-repo', () => ({ useActiveProfile: () => ({ profile: undefined, profileId: undefined, loading: false }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { LocaleProvider } from '@/components/providers/locale-provider';
import ToolsPage from '@/app/(app)/tools/page-client';
import PlateCalculatorPage from '@/app/(app)/tools/plate-calculator/page-client';
import RmCalculatorPage from '@/app/(app)/tools/rm-calculator/page-client';

describe('tools pages: page-heading test ids on the h1', () => {
  it.each([
    ['page-heading-tools', ToolsPage],
    ['page-heading-plate-calculator', PlateCalculatorPage],
    ['page-heading-rm-calculator', RmCalculatorPage],
  ] as Array<[string, ComponentType]>)('%s is the only h1', (testId, Page) => {
    render(
      <LocaleProvider>
        <Page />
      </LocaleProvider>,
    );
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toBe(screen.getByTestId(testId));
    expect(headings[0].textContent?.trim()).not.toBe('');
  });
});
