/**
 * DriversPage.jsx
 * Drivers management page for the School Admin role.
 * Provides CRUD for driver accounts: add/edit, deactivate/
 * reactivate, and password reset.
 * Page title rendered by Topbar — no page-level h1.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Pencil, Power, PowerOff, KeyRound, UserCheck,
  X, Search, Loader2, Eye, EyeOff,
} from 'lucide-react';
import {
  listDrivers, createDriver, updateDriver,
  deactivateDriver, reactivateDriver, resetDriverPassword,
} from '../../api/users.api';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */

const PAGE_LIMIT = 20;
const DEBOUNCE_MS = 400;

/* ──────────────────────────────────────────────────────────
 * Utility helpers
 * ────────────────────────────────────────────────────────── */

// Returns condensed page list with ellipsis for gaps
function getVisiblePages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set();
  pages.add(1);
  pages.add(total);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
    pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}

// Formats ISO timestamp as DD Mon YYYY. Returns "Never" if null.
function fmtDate(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = String(d.getDate()).padStart(2, '0');
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  return `${day} ${mon} ${yr}`;
}

/* ──────────────────────────────────────────────────────────
 * Reusable Modal shell
 * ────────────────────────────────────────────────────────── */

/**
 * Renders a backdrop + centred card. Closes on Escape and
 * backdrop click. Traps Tab focus within the dialog.
 */
function Modal({ open, onClose, title, disableClose = false, children }) {
  const dialogRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !disableClose) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, disableClose]);

  // Focus trap — save previous focus, constrain Tab, restore on close
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;

    function getFocusable() {
      const candidates = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!candidates) return [];
      return Array.from(candidates).filter((el) => {
        if (el.disabled) return false;
        if (el.hidden) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        if (!el.offsetParent && el.tagName !== 'BODY') return false;
        return true;
      });
    }

    // Re-query live focusable elements on each Tab press
    function handleTab(e) {
      if (e.key !== 'Tab') return;
      const current = getFocusable();
      if (!current.length) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    const focusable = getFocusable();
    if (focusable.length) focusable[0].focus();
    else dialogRef.current?.focus();

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      if (previouslyFocused?.focus) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={disableClose ? undefined : onClose}
        aria-hidden="true"
      />
      {/* Card */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative z-10 mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl md:mx-0"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={disableClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * Driver Add / Edit modal
 * ────────────────────────────────────────────────────────── */

/** Modal form for creating or editing a driver account. */
function DriverModal({ modal, onClose, onSuccess }) {
  const isEdit = modal.mode === 'edit';
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Populate or clear fields when the modal opens
  useEffect(() => {
    if (!modal.open) return;
    if (isEdit && modal.driver) {
      setName(modal.driver.name || '');
      setEmployeeId(modal.driver.employee_id || '');
      setPhone(modal.driver.phone || '');
      setEmail(modal.driver.email || '');
    } else {
      setName('');
      setEmployeeId('');
      setPassword('');
      setPhone('');
      setEmail('');
    }
    setShowPassword(false);
    setFormError(null);
  }, [modal.open, modal.mode, modal.driver]);

  /** Validates and submits the driver form. */
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Name is required.');
      return;
    }

    if (!isEdit) {
      if (!employeeId.trim()) {
        setFormError('Employee ID is required.');
        return;
      }
      if (!password) {
        setFormError('Password is required.');
        return;
      }
      if (password.length < 8) {
        setFormError('Password must be at least 8 characters.');
        return;
      }
    }

    let payload;
    if (isEdit) {
      // Only send changed fields — never employee_id or password
      const changes = {};
      if (trimmedName !== modal.driver.name) changes.name = trimmedName;
      if (phone.trim() !== (modal.driver.phone || '')) changes.phone = phone.trim() || undefined;
      if (email.trim() !== (modal.driver.email || '')) changes.email = email.trim() || undefined;

      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      payload = changes;
    } else {
      payload = {
        name: trimmedName,
        employee_id: employeeId.trim(),
        password,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      };
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateDriver(modal.driver.id, payload);
      } else {
        await createDriver(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save driver');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={modal.open}
      onClose={onClose}
      title={isEdit ? 'Edit Driver' : 'Add Driver'}
      disableClose={saving}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="driver-name" className="mb-1 block text-sm font-medium text-slate-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="driver-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            placeholder="e.g. Rajesh Kumar"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </div>

        {/* Employee ID */}
        <div>
          <label htmlFor="driver-emp-id" className="mb-1 block text-sm font-medium text-slate-700">
            Employee ID {!isEdit && <span className="text-red-500">*</span>}
          </label>
          {isEdit ? (
            <>
              <input
                id="driver-emp-id"
                type="text"
                value={employeeId}
                disabled
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 disabled:opacity-60"
              />
              <p className="mt-1 text-xs italic text-slate-400">
                Employee ID cannot be changed after creation.
              </p>
            </>
          ) : (
            <input
              id="driver-emp-id"
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={saving}
              placeholder="e.g. DRV-001"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
          )}
        </div>

        {/* Password (add) / Note (edit) */}
        <div>
          {isEdit ? (
            <p className="text-sm text-slate-400">
              Use the <span className="font-medium">Reset Password</span> button to change this driver's password.
            </p>
          ) : (
            <>
              <label htmlFor="driver-password" className="mb-1 block text-sm font-medium text-slate-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="driver-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={saving}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={saving}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">Minimum 8 characters</p>
            </>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="driver-phone" className="mb-1 block text-sm font-medium text-slate-700">
            Phone
          </label>
          <input
            id="driver-phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={saving}
            placeholder="e.g. 9876543210"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="driver-email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="driver-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            placeholder="e.g. driver@school.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </div>

        {formError && (
          <p className="text-sm text-red-600">{formError}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Driver'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Reset Password modal
 * ────────────────────────────────────────────────────────── */

/** Modal for resetting a driver's password (admin sets new password). */
function ResetPasswordModal({ modal, onClose }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Clear fields when modal opens
  useEffect(() => {
    if (!modal.open) return;
    setNewPassword('');
    setConfirmPassword('');
    setShowNew(false);
    setShowConfirm(false);
    setFormError(null);
  }, [modal.open]);

  /** Validates and submits the password reset. */
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    // Passwords are opaque — never trim, validate and send raw value
    if (!newPassword) {
      setFormError('New password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setResetting(true);
    try {
      await resetDriverPassword(modal.driverId, newPassword);
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  return (
    <Modal
      open={modal.open}
      onClose={onClose}
      title={`Reset Password — ${modal.driverName}`}
      disableClose={resetting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div>
          <label htmlFor="reset-new-password" className="mb-1 block text-sm font-medium text-slate-700">
            New Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reset-new-password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={resetting}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              disabled={resetting}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
              aria-label={showNew ? 'Hide new password' : 'Show new password'}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Minimum 8 characters</p>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="reset-confirm-password" className="mb-1 block text-sm font-medium text-slate-700">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reset-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={resetting}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              disabled={resetting}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {formError && (
          <p className="text-sm text-red-600">{formError}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={resetting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={resetting}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
            Reset Password
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Confirm (Deactivate / Reactivate) modal
 * ────────────────────────────────────────────────────────── */

/** Confirmation dialog for deactivate / reactivate actions. */
function ConfirmModal({ modal, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    setConfirming(false);
    setConfirmError(null);
  }, [modal.open]);

  const titles = {
    deactivate: 'Confirm Deactivate',
    reactivate: 'Confirm Reactivate',
  };

  /** Executes the confirmed action. */
  async function handleConfirm() {
    setConfirming(true);
    setConfirmError(null);
    try {
      await onConfirm(modal.action, modal.driverId);
      onClose();
    } catch (err) {
      setConfirmError(err.response?.data?.message || 'Action failed');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal
      open={modal.open}
      onClose={onClose}
      title={titles[modal.action] || 'Confirm'}
      disableClose={confirming}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{modal.label}</p>

        {confirmError && (
          <p className="text-sm text-red-600">{confirmError}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
          >
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Main component
 * ────────────────────────────────────────────────────────── */

/** Drivers management page — CRUD, status toggle, password reset. */
export default function DriversPage() {
  /* ── Core list state ── */
  const [drivers, setDrivers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState(null);

  /* ── Search state (inputValue = display, apiSearch = fetch trigger) ── */
  const [inputValue, setInputValue] = useState('');
  const [apiSearch, setApiSearch] = useState('');

  /* ── Filter + pagination state ── */
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  /* ── Modal state ── */
  const [driverModal, setDriverModal] = useState({
    open: false, mode: 'add', driver: null,
  });
  const [resetModal, setResetModal] = useState({
    open: false, driverId: null, driverName: '',
  });
  const [confirmModal, setConfirmModal] = useState({
    open: false, action: null, driverId: null,
    driverName: '', label: '',
  });

  /* ── Refs ── */
  const hasFetchedRef = useRef(false);
  const debounceRef = useRef(null);
  const tableTopRef = useRef(null);

  /* ── Data fetching ── */

  // Fetches drivers — accepts an optional signal so callers can cancel
  const fetchDrivers = useCallback(async (page, search, status, signal) => {
    if (!hasFetchedRef.current) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }
    setError(null);

    try {
      const data = await listDrivers(
        { page, limit: PAGE_LIMIT, search: search || undefined, status },
        signal
      );
      if (!signal?.aborted) {
        const totalPages = data.pagination?.total_pages || 1;
        if (page > totalPages) setCurrentPage(totalPages);
        setDrivers(data.drivers || []);
        setPagination(data.pagination || null);
        hasFetchedRef.current = true;
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.message || 'Failed to load drivers');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, []);

  // Single fetch trigger — handlers only update state, this effect fetches
  useEffect(() => {
    // Create controller synchronously so cleanup can abort
    // immediately regardless of async function progress
    const controller = new AbortController();
    fetchDrivers(currentPage, apiSearch, statusFilter, controller.signal);
    return () => controller.abort();
  }, [currentPage, apiSearch, statusFilter, fetchDrivers]);

  // Cancel pending debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Direct fetch for post-mutation refresh
  function refetch() {
    fetchDrivers(currentPage, apiSearch, statusFilter);
  }

  /* ── Search handler ── */

  function handleSearchChange(value) {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setApiSearch(value);
      setCurrentPage(1);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  }

  /* ── Filter handler ── */

  function handleStatusFilter(status) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setStatusFilter(status);
    setCurrentPage(1);
  }

  /* ── Pagination ── */

  function goToPage(page) {
    setCurrentPage(page);
    tableTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  /* ── Modal openers ── */

  function openAddDriver() {
    setDriverModal({ open: true, mode: 'add', driver: null });
  }

  function openEditDriver(driver) {
    setDriverModal({ open: true, mode: 'edit', driver });
  }

  function openResetPassword(driver) {
    setResetModal({ open: true, driverId: driver.id, driverName: driver.name });
  }

  function openDeactivate(driver) {
    setConfirmModal({
      open: true,
      action: 'deactivate',
      driverId: driver.id,
      driverName: driver.name,
      label: `Deactivating ${driver.name} will prevent them from logging in to the driver app. Any active journey will not be affected.`,
    });
  }

  function openReactivate(driver) {
    setConfirmModal({
      open: true,
      action: 'reactivate',
      driverId: driver.id,
      driverName: driver.name,
      label: `This will allow ${driver.name} to log in to the driver app again.`,
    });
  }

  /* ── Confirm action handler ── */

  async function handleConfirmAction(action, driverId) {
    if (action === 'deactivate') {
      await deactivateDriver(driverId);
    } else if (action === 'reactivate') {
      await reactivateDriver(driverId);
    }
    refetch();
  }

  /* ── Driver modal success ── */

  function onDriverSuccess() {
    if (currentPage === 1) {
      fetchDrivers(1, apiSearch, statusFilter);
    } else {
      setCurrentPage(1);
    }
  }

  /* ── Render ── */

  const COL_COUNT = 7;
  const filterBtns = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6" ref={tableTopRef}>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-xl font-semibold text-slate-800">Drivers</p>
        <button
          type="button"
          onClick={openAddDriver}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          <Plus className="h-4 w-4" />
          Add Driver
        </button>
      </div>

      {/* Subtle refetch indicator */}
      {isRefetching && (
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* Search + filter row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search name or employee ID..."
            aria-label="Search drivers by name or employee ID"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {filterBtns.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => handleStatusFilter(btn.value)}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-300',
                statusFilter === btn.value
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Retry
          </button>
        </div>
      )}

      {/* Drivers table — hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Employee ID</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Last Active</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">

            {/* Loading skeleton */}
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: COL_COUNT }).map((__, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))}

            {/* Empty state */}
            {!isLoading && !error && drivers.length === 0 && (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <UserCheck className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No drivers found</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Driver rows */}
            {!isLoading && drivers.map((driver) => (
              <tr key={driver.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {driver.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {driver.employee_id}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {driver.phone || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {driver.email || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {fmtDate(driver.last_active_at)}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    driver.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  )}>
                    {driver.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEditDriver(driver)}
                      aria-label={`Edit driver ${driver.name}`}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openResetPassword(driver)}
                      aria-label={`Reset password for ${driver.name}`}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    {driver.is_active ? (
                      <button
                        type="button"
                        onClick={() => openDeactivate(driver)}
                        aria-label={`Deactivate driver ${driver.name}`}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                      >
                        <PowerOff className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openReactivate(driver)}
                        aria-label={`Reactivate driver ${driver.name}`}
                        className="rounded p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-300"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

          </tbody>
        </table>
      </div>
      </div>

      {/* Mobile card list — visible on mobile, hidden on md+ */}
      <div className="md:hidden space-y-3">
        {/* Loading skeleton cards */}
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-3 w-40 rounded bg-slate-200" />
          </div>
        ))}

        {/* Empty state */}
        {!isLoading && !error && drivers.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center">
            <div className="flex flex-col items-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <UserCheck className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No drivers found</p>
            </div>
          </div>
        )}

        {/* Driver cards */}
        {!isLoading && drivers.map((driver) => (
          <div key={driver.id} className="rounded-xl border border-slate-200 bg-white p-4">
            {/* Card header: name + status badge */}
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-800">{driver.name}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">
                  {driver.employee_id}
                </p>
              </div>
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                driver.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500'
              )}>
                {driver.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Card body: contact details */}
            <div className="mb-4 space-y-1">
              <p className="text-sm text-slate-600">
                <span className="text-xs text-slate-400">Phone: </span>
                {driver.phone || '—'}
              </p>
              <p className="text-sm text-slate-600">
                <span className="text-xs text-slate-400">Email: </span>
                {driver.email || '—'}
              </p>
              <p className="text-sm text-slate-500">
                <span className="text-xs text-slate-400">Last active: </span>
                {fmtDate(driver.last_active_at)}
              </p>
            </div>

            {/* Card footer: action buttons */}
            <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => openEditDriver(driver)}
                aria-label={`Edit driver ${driver.name}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => openResetPassword(driver)}
                aria-label={`Reset password for ${driver.name}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Reset
              </button>
              {driver.is_active ? (
                <button
                  type="button"
                  onClick={() => openDeactivate(driver)}
                  aria-label={`Deactivate driver ${driver.name}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <PowerOff className="h-3.5 w-3.5" />
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openReactivate(driver)}
                  aria-label={`Reactivate driver ${driver.name}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-200 px-3 py-2 text-xs font-medium text-green-600 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-300"
                >
                  <Power className="h-3.5 w-3.5" />
                  Reactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          {getVisiblePages(currentPage, pagination.total_pages).map((item, idx) =>
            item === '...' ? (
              <span key={`ellipsis-${idx}`} className="select-none px-2 py-1.5 text-sm text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => goToPage(item)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300',
                  item === currentPage
                    ? 'bg-slate-800 text-white'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                )}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= pagination.total_pages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Modals */}
      <DriverModal
        modal={driverModal}
        onClose={() => setDriverModal((m) => ({ ...m, open: false }))}
        onSuccess={onDriverSuccess}
      />
      <ResetPasswordModal
        modal={resetModal}
        onClose={() => setResetModal((m) => ({ ...m, open: false }))}
      />
      <ConfirmModal
        modal={confirmModal}
        onClose={() => setConfirmModal((m) => ({ ...m, open: false }))}
        onConfirm={handleConfirmAction}
      />

    </div>
  );
}
