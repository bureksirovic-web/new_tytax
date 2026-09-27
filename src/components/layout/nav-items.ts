import type { TranslationKey } from '@/lib/i18n';

/**
 * Single source of truth for the app navigation. Every href here must be a
 * real v2 route (no dead links): /dashboard, /workout, /exercises, /programs,
 * /history, /analytics, /settings, /tools/plate-calculator, /tools/rm-calculator.
 * "Arsenal" from the legacy app is the favourites filter inside /exercises.
 */
export interface NavItem {
  href: string;
  label: TranslationKey;
  icon: string;
  description?: TranslationKey;
}

export interface NavSection {
  label: TranslationKey;
  items: NavItem[];
}

export const FAVORITES_HREF = '/exercises?favorites=1';

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'sidebar_training',
    items: [
      { href: '/dashboard', label: 'sidebar_command_center', icon: '⌂' },
      { href: '/workout', label: 'sidebar_training_center', icon: '◈' },
      { href: '/history', label: 'sidebar_vault', icon: '◫' },
    ],
  },
  {
    label: 'sidebar_intel',
    items: [
      { href: '/exercises', label: 'sidebar_meta_library', icon: '⊞' },
      { href: FAVORITES_HREF, label: 'layout_favorites', icon: '★' },
      { href: '/programs', label: 'nav_programs', icon: '▦' },
    ],
  },
  {
    label: 'sidebar_analysis',
    items: [{ href: '/analytics', label: 'sidebar_force_analytics', icon: '▲' }],
  },
  {
    label: 'sidebar_system',
    items: [
      { href: '/tools/plate-calculator', label: 'sidebar_plate_calc', icon: '⚖' },
      { href: '/tools/rm-calculator', label: 'sidebar_rm_calc', icon: '⟨' },
      { href: '/settings', label: 'nav_settings', icon: '≡' },
    ],
  },
];

/** Primary tabs of the mobile bottom bar (a "More" button follows them). */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'nav_home', icon: '⌂' },
  { href: '/workout', label: 'nav_workout', icon: '◈' },
  { href: '/exercises', label: 'nav_exercises', icon: '⊞' },
  { href: '/history', label: 'history', icon: '◫' },
];

/** Everything else, reachable from the mobile "More" drawer. */
export const MORE_ITEMS: NavItem[] = [
  { href: '/analytics', label: 'nav_analytics', icon: '▲', description: 'layout_analytics_desc' },
  { href: '/programs', label: 'nav_programs', icon: '▦', description: 'training_plans' },
  { href: FAVORITES_HREF, label: 'layout_favorites', icon: '★', description: 'layout_favorites_desc' },
  { href: '/tools/plate-calculator', label: 'sidebar_plate_calc', icon: '⚖', description: 'layout_plate_calc_desc' },
  { href: '/tools/rm-calculator', label: 'sidebar_rm_calc', icon: '⟨', description: 'layout_rm_calc_desc' },
  { href: '/settings', label: 'nav_settings', icon: '≡', description: 'preferences_sync' },
  { href: '/auth/login', label: 'sign_in', icon: '⇥', description: 'sync_across_devices' },
];

/**
 * True when `pathname` is the item's route or below it. Items carrying a query
 * string (the favourites filter) are never marked current: the path alone
 * cannot tell them apart from their parent route.
 */
export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname || href.includes('?')) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Routes that live behind the mobile "More" button. */
export function isMoreActive(pathname: string | null): boolean {
  return MORE_ITEMS.some((item) => isNavActive(pathname, item.href));
}

/** Visible keyboard focus ring shared by every layout control. */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight';
