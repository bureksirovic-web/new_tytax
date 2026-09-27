import { describe, it, expect } from 'vitest';
import {
  BOTTOM_NAV_ITEMS,
  FAVORITES_HREF,
  MORE_ITEMS,
  NAV_SECTIONS,
  isMoreActive,
  isNavActive,
} from '../nav-items';

const V2_ROUTES = [
  '/dashboard',
  '/workout',
  '/exercises',
  '/programs',
  '/history',
  '/analytics',
  '/settings',
  '/tools/plate-calculator',
  '/tools/rm-calculator',
  '/auth/login',
];

const allHrefs = [
  ...NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href)),
  ...BOTTOM_NAV_ITEMS.map((i) => i.href),
  ...MORE_ITEMS.map((i) => i.href),
];

describe('nav items', () => {
  it('contains no dead links', () => {
    for (const href of allHrefs) {
      const path = href.split('?')[0];
      expect(V2_ROUTES, `dead link ${href}`).toContain(path);
    }
    expect(allHrefs.some((h) => h.includes('arsenal'))).toBe(false);
  });

  it('exposes Arsenal as the favourites filter inside /exercises', () => {
    expect(FAVORITES_HREF).toBe('/exercises?favorites=1');
    expect(NAV_SECTIONS.flatMap((s) => s.items).some((i) => i.href === FAVORITES_HREF)).toBe(true);
    expect(MORE_ITEMS.some((i) => i.href === FAVORITES_HREF)).toBe(true);
  });

  it('reaches every app route from the sidebar and from the mobile nav', () => {
    const appRoutes = V2_ROUTES.filter((r) => r !== '/auth/login');
    const sidebar = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    const mobile = [...BOTTOM_NAV_ITEMS, ...MORE_ITEMS].map((i) => i.href);
    for (const route of appRoutes) {
      expect(sidebar, `sidebar misses ${route}`).toContain(route);
      expect(mobile, `mobile nav misses ${route}`).toContain(route);
    }
  });

  it('puts /history directly in the bottom bar', () => {
    expect(BOTTOM_NAV_ITEMS.map((i) => i.href)).toContain('/history');
  });

  it('matches the active route by path segment', () => {
    expect(isNavActive('/history', '/history')).toBe(true);
    expect(isNavActive('/history/abc', '/history')).toBe(true);
    expect(isNavActive('/historyx', '/history')).toBe(false);
    expect(isNavActive('/exercises', FAVORITES_HREF)).toBe(false);
    expect(isNavActive(null, '/history')).toBe(false);
  });

  it('marks More active only for routes behind it', () => {
    expect(isMoreActive('/settings')).toBe(true);
    expect(isMoreActive('/tools/rm-calculator')).toBe(true);
    expect(isMoreActive('/dashboard')).toBe(false);
    expect(isMoreActive('/history')).toBe(false);
  });
});
