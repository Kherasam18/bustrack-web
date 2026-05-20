/**
 * Topbar.jsx
 * Top navigation bar for the BusTrack dashboard. Shows the current page title
 * (derived from the active route), a hamburger menu button on mobile, and the
 * authenticated user's name with a role badge on the right.
 *
 * For SCHOOL_ADMIN users the name becomes a dropdown trigger with a
 * "Change Password" option that opens an inline modal.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Menu,
  ChevronDown,
  KeyRound,
  X,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { ROLES } from '../../utils/roles';
import { cn } from '../../lib/utils';
import { changeSchoolAdminPassword } from '../../api/auth.api';

/* ──────────────────────────────────────────────────────────
 * Static route → title mapping for exact-match paths
 * ────────────────────────────────────────────────────────── */
const ROUTE_TITLES = {
  '/school-admin/dashboard': 'Dashboard',
  '/school-admin/buses': 'Buses & Routes',
  '/school-admin/students': 'Students',
  '/school-admin/drivers': 'Drivers',
  '/school-admin/parents': 'Parents',
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
  // Longest-prefix-wins: iterate all entries and track the most 
  // specific match instead of returning the first match
  let bestMatch = null;
  for (const { prefix, title } of DYNAMIC_ROUTE_TITLES) {
    if (
      pathname.startsWith(prefix) &&
      (!bestMatch || prefix.length > bestMatch.prefix.length)
    ) {
      bestMatch = { prefix, title };
    }
  }
  if (bestMatch) return bestMatch.title;

  // 3. Fallback
  return 'BusTrack';
}

/* ──────────────────────────────────────────────────────────
 * Password input with show/hide toggle
 * ────────────────────────────────────────────────────────── */
function PasswordField({ label, value, onChange, disabled, hint, inputRef }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {/* Show / hide toggle */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      {/* Optional hint text below the input */}
      {hint && (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
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

  // ── Dropdown state ──────────────────────────────────────
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDropdownOpen]);

  // ── Modal state ─────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const firstInputRef = useRef(null);

  /** Resets all modal fields and messages */
  const resetModalState = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
  }, []);

  /** Opens the change-password modal */
  const openModal = useCallback(() => {
    resetModalState();
    setIsModalOpen(true);
  }, [resetModalState]);

  /** Closes the modal (blocked while submitting) */
  const closeModal = useCallback(() => {
    if (isSubmitting) return;
    resetModalState();
    setIsModalOpen(false);
  }, [isSubmitting, resetModalState]);

  // Focus the first input when modal opens
  useEffect(() => {
    if (isModalOpen) {
      // Small delay to let the DOM render first
      const timer = setTimeout(() => firstInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isModalOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, closeModal]);

  /** Handles the Change Password form submission */
  const handleSubmit = async () => {
    // Clear previous messages
    setError(null);
    setSuccessMsg(null);

    // ── Client-side validation ────────────────────────────
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    // ── API call ──────────────────────────────────────────
    setIsSubmitting(true);
    try {
      const data = await changeSchoolAdminPassword(currentPassword, newPassword);
      setSuccessMsg(data.message || 'Password changed successfully');
      // Clear inputs on success — user can close manually
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(
        err.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Is the current user a School Admin? ─────────────────
  const isSchoolAdmin = user?.role === ROLES.SCHOOL_ADMIN;

  return (
    <>
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
          {/* User name — dropdown trigger for SCHOOL_ADMIN, plain span for others */}
          {isSchoolAdmin ? (
            <div className="relative" ref={dropdownRef}>
              {/* Dropdown trigger button */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="hidden items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 sm:inline-flex"
              >
                {user?.name ?? 'User'}
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                    isDropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Dropdown menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      openModal();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <KeyRound className="h-4 w-4 text-slate-500" />
                    Change Password
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* SUPER_ADMIN — plain name span (no dropdown) */
            <span className="hidden text-sm font-medium text-slate-700 sm:inline">
              {user?.name ?? 'User'}
            </span>
          )}

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

      {/* ── Change Password Modal ──────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            // Backdrop click — close only when not submitting
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            {/* Modal header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Change Password
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Password fields */}
            <div className="space-y-4">
              {/* Current password */}
              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                inputRef={firstInputRef}
              />

              {/* New password */}
              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                hint="Minimum 8 characters"
              />

              {/* Confirm new password */}
              <PasswordField
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}

            {/* Success message */}
            {successMsg && (
              <p className="mt-4 text-sm text-green-600">{successMsg}</p>
            )}

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
