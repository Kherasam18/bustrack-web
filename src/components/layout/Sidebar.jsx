/**
 * Sidebar.jsx
 * Role-aware navigation sidebar for the BusTrack dashboard. Renders the correct
 * set of nav links based on the logged-in user's role (SCHOOL_ADMIN or SUPER_ADMIN).
 * On mobile, the sidebar slides in from the left as a fixed overlay drawer.
 * On desktop (≥ lg), it is statically positioned in the layout grid.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Bus,
  Users,
  UsersRound,
  UserCheck,
  Bell,
  Building2,
  LogOut,
  X,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { ROLES } from '../../utils/roles';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Nav link configuration per role
 * Each entry: { label, path, icon }
 * ────────────────────────────────────────────────────────── */
const SCHOOL_ADMIN_LINKS = [
  { label: 'Dashboard', path: '/school-admin/dashboard', icon: LayoutDashboard },
  { label: 'Buses', path: '/school-admin/buses', icon: Bus },
  { label: 'Students', path: '/school-admin/students', icon: Users },
  { label: 'Drivers', path: '/school-admin/drivers', icon: UserCheck },
  { label: 'Parents', path: '/school-admin/parents', icon: UsersRound },
  { label: 'Notifications', path: '/school-admin/notifications', icon: Bell },
];

const SUPER_ADMIN_LINKS = [
  { label: 'Schools', path: '/super-admin/schools', icon: Building2 },
];

/**
 * Returns the nav links appropriate for the given role.
 * @param {string} role — SCHOOL_ADMIN | SUPER_ADMIN
 * @returns {Array<{ label: string, path: string, icon: import('lucide-react').LucideIcon }>}
 */
function getLinksForRole(role) {
  if (role === ROLES.SCHOOL_ADMIN) return SCHOOL_ADMIN_LINKS;
  if (role === ROLES.SUPER_ADMIN) return SUPER_ADMIN_LINKS;
  return [];
}

/**
 * Sidebar component.
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  // Resolve nav links for the current user's role
  const navLinks = getLinksForRole(user?.role);

  // Determine the subtitle shown below the brand name
  const subtitle = user?.role === ROLES.SUPER_ADMIN ? 'Platform Admin' : 'School Admin';

  /**
   * Handles logout: clears auth state and navigates to /login.
   */
  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <aside
      className={cn(
        // Base styles — full-height dark sidebar
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-800',
        // Mobile: slide transform + transition; hidden off-screen when closed
        'transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: always visible, no transform
        'lg:translate-x-0'
      )}
    >
      {/* ── Brand header ────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-6">
        <div className="flex items-center gap-3">
          {/* Bus icon as brand mark */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <Bus className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-slate-100">BusTrack</span>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>

        {/* Close button — visible only on mobile */}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Navigation links ────────────────────────────── */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
        {navLinks.map((link) => {
          const Icon = link.icon;
          // Match exact path or true child routes only — prevents false 
          // positives from shared path prefixes (e.g. /bus vs /buses)
          const isActive =
            location.pathname === link.path ||
            location.pathname.startsWith(link.path + '/');

          return (
            <Link
              key={link.path}
              to={link.path}
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-white/30',
                isActive
                  ? 'border-l-4 border-white bg-white/10 pl-2 font-semibold text-white'
                  : 'border-l-4 border-transparent pl-2 text-slate-300 hover:bg-white/5 hover:text-white'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Logout button (pinned to bottom) ────────────── */}
      <div className="border-t border-slate-700 px-3 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
            'text-slate-300 transition-colors hover:bg-white/5 hover:text-white',
            'focus:outline-none focus:ring-2 focus:ring-white/30'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}
