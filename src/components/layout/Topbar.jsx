/**
 * Topbar.jsx
 * Top navigation bar for the BusTrack dashboard. Shows the current page title
 * (derived from the active route), a hamburger menu button on mobile, and the
 * authenticated user's name with a role badge on the right.
 */
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { ROLES } from '../../utils/roles';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Static route → title mapping for exact-match paths
 * ────────────────────────────────────────────────────────── */
const ROUTE_TITLES = {
  '/school-admin/dashboard': 'Dashboard',
  '/school-admin/buses': 'Buses & Routes',
  '/school-admin/students': 'Students',
  '/school-admin/drivers': 'Drivers',
  '/school-admin/notifications': 'Notifications',
  '/super-admin/schools': 'Schools',
};

/* ──────────────────────────────────────────────────────────
 * Dynamic route prefixes for pages with URL params (e.g. :id)
 * Checked only when the exact map yields no match.
 * ────────────────────────────────────────────────────────── */
const DYNAMIC_ROUTE_TITLES = [
  { prefix: '/school-admin/buses/', title: 'Bus Detail' },
  { prefix: '/super-admin/schools/', title: 'School Detail' },
];

/**
 * Derives a human-readable page title from the current pathname.
 * Falls back to "BusTrack" if no mapping is found.
 * @param {string} pathname — current location.pathname
 * @returns {string}
 */
function derivePageTitle(pathname) {
  // 1. Try an exact match first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

  // 2. Try dynamic route prefixes (longest prefix wins)
  for (const route of DYNAMIC_ROUTE_TITLES) {
    if (pathname.startsWith(route.prefix)) return route.title;
  }

  // 3. Fallback
  return 'BusTrack';
}

/**
 * Topbar component.
 * @param {{ onMenuToggle: () => void }} props
 */
export default function Topbar({ onMenuToggle }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Derive the page title from the current route
  const pageTitle = derivePageTitle(location.pathname);

  // Human-readable role label for the badge
  const roleBadge = user?.role === ROLES.SUPER_ADMIN ? 'Platform Admin' : 'School Admin';

  return (
    <header
      className={cn(
        'flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm',
        'sm:px-6'
      )}
    >
      {/* ── Left section: hamburger + page title ──────── */}
      <div className="flex items-center gap-3">
        {/* Hamburger menu — visible only on mobile (below lg) */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page title */}
        <h1 className="text-lg font-semibold text-slate-800">{pageTitle}</h1>
      </div>

      {/* ── Right section: user info + role badge ─────── */}
      <div className="flex items-center gap-3">
        {/* User name */}
        <span className="hidden text-sm font-medium text-slate-700 sm:inline">
          {user?.name ?? 'User'}
        </span>

        {/* Role badge */}
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            user?.role === ROLES.SUPER_ADMIN
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          )}
        >
          {roleBadge}
        </span>
      </div>
    </header>
  );
}
