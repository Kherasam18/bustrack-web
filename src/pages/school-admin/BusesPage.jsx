/**
 * BusesPage.jsx
 * Buses & Routes management page for the School Admin role. Provides a
 * single-page CRUD interface for buses, their routes, and route stops.
 * All operations are handled inline via modals and expandable route panels.
 *
 * Student assignment is excluded (Phase 7d-ii).
 * Driver assignment in route forms is excluded (Phase 7f).
 * The page title is rendered by Topbar — no page-level h1.
 */
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  AlertTriangle,
  Search,
  Bus,
  ArrowUp,
  ArrowDown,
  Loader2,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import {
  listBuses,
  createBus,
  updateBus,
  deactivateBus,
  reactivateBus,
  getRoute,
  createRoute,
  updateRoute,
  addStop,
  updateStop as updateStopApi,
  deleteStop as deleteStopApi,
  reorderStops,
  listBusStudents,
  assignStudent,
  unassignStudent,
} from '../../api/buses.api';
import { listStudents } from '../../api/students.api';
import { listDrivers } from '../../api/users.api';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */

const PAGE_LIMIT = 20;
const DEBOUNCE_MS = 400;

/** Seat status badge config */
const SEAT_BADGE = {
  AVAILABLE: { label: 'Available', classes: 'bg-green-100 text-green-700' },
  ALMOST_FULL: { label: 'Almost Full', classes: 'bg-amber-100 text-amber-700' },
  FULL: { label: 'Full', classes: 'bg-red-100 text-red-700' },
};

/* ──────────────────────────────────────────────────────────
 * Utility functions
 * ────────────────────────────────────────────────────────── */

/** Strips seconds from HH:MM:SS → HH:MM. Returns "—" if null. */
function fmtTime(time) {
  if (!time) return '—';
  const parts = time.split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  return time.slice(0, 5);
}

// Returns a condensed page list with '...' for gaps between non-adjacent ranges
function getVisiblePages(current, total) {
  if (total <= 7) {
    // Show all pages if 7 or fewer — no truncation needed
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set();
  // Always include first and last
  pages.add(1);
  pages.add(total);
  // Include window around current page
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
    pages.add(i);
  }

  // Convert to sorted array and insert '...' for gaps
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push('...');
    }
    result.push(sorted[i]);
  }
  return result;
}

/* ──────────────────────────────────────────────────────────
 * Modal components
 * ────────────────────────────────────────────────────────── */

/**
 * Reusable modal shell — renders a backdrop + centred card.
 * Closes on Escape and backdrop click. Traps conceptual focus.
 */
function Modal({ open, onClose, title, wide, disableClose = false, children }) {
  const dialogRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      // Prevent closing while a mutation is in flight
      if (e.key === 'Escape' && !disableClose) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, disableClose]);

  // Save previously focused element and move focus into the modal
  // Constrain Tab key to focusable elements within the dialog
  // Restore focus to previously focused element on close
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const focusable = dialogRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable?.length) focusable[0].focus();
    else dialogRef.current?.focus();

    function handleTab(e) {
      if (e.key !== 'Tab') return;
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        // Shift+Tab: if focus is on first, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on last, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
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

/**
 * Bus Add/Edit modal form.
 */
function BusModal({ modal, onClose, onSuccess }) {
  const isEdit = modal.mode === 'edit';
  const [busNumber, setBusNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Re-initialise form fields whenever the modal opens or its data changes
  useEffect(() => {
    if (!modal.open) return;
    if (isEdit && modal.bus) {
      setBusNumber(modal.bus.bus_number || '');
      setCapacity(modal.bus.capacity?.toString() || '');
    } else {
      setBusNumber('');
      setCapacity('');
    }
    setFormError(null);
  }, [isEdit, modal.bus, modal.open]);

  /** Validates and submits the bus form. */
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    // Client-side validation
    const trimmed = busNumber.trim();
    if (!trimmed) {
      setFormError('Bus number is required.');
      return;
    }

    const payload = { bus_number: trimmed };
    if (capacity.trim()) {
      const cap = parseInt(capacity, 10);
      if (Number.isNaN(cap) || cap <= 0) {
        setFormError('Capacity must be a positive number.');
        return;
      }
      payload.capacity = cap;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateBus(modal.bus.id, payload);
      } else {
        await createBus(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save bus');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={modal.open} onClose={onClose} title={isEdit ? 'Edit Bus' : 'Add Bus'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="bus-number" className="mb-1 block text-sm font-medium text-slate-700">
            Bus Number <span className="text-red-500">*</span>
          </label>
          <input
            id="bus-number"
            type="text"
            value={busNumber}
            onChange={(e) => setBusNumber(e.target.value)}
            disabled={saving}
            placeholder="e.g. BUS-001"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="bus-capacity" className="mb-1 block text-sm font-medium text-slate-700">
            Capacity
          </label>
          <input
            id="bus-capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            disabled={saving}
            placeholder="Default: 40"
            min="1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
          {isEdit && modal.bus && (
            <p className="mt-1 text-xs text-slate-400">
              Current capacity: {modal.bus.capacity} seats
            </p>
          )}
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
            {isEdit ? 'Save Changes' : 'Add Bus'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Route Create/Edit modal form.
 */
function RouteModal({ modal, onClose, onSuccess }) {
  const isEdit = modal.mode === 'edit';
  const [routeName, setRouteName] = useState('');
  const [departure, setDeparture] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
  const [driversWarning, setDriversWarning] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const driversAbortRef = useRef(null);

  // Re-initialise form fields whenever the modal opens or its data changes
  useEffect(() => {
    if (!modal.open) {
      // Abort any in-flight driver fetch when modal closes
      if (driversAbortRef.current) {
        driversAbortRef.current.abort();
        driversAbortRef.current = null;
      }
      setSelectedDriverId('');
      setDrivers([]);
      setIsLoadingDrivers(false);
      setDriversWarning(null);
      return;
    }
    if (isEdit && modal.route) {
      setRouteName(modal.route.route_name || '');
      // Normalise HH:MM:SS → HH:MM so the field passes validation unchanged
      setDeparture(fmtTime(modal.route.scheduled_departure) || '');
      setSelectedDriverId(modal.route.default_driver_id || '');
    } else {
      setRouteName('');
      setDeparture('');
      setSelectedDriverId('');
    }
    setFormError(null);

    // Fetch active drivers for the dropdown whenever modal opens
    const controller = new AbortController();
    driversAbortRef.current = controller;

    async function loadDrivers() {
      setIsLoadingDrivers(true);
      try {
        const data = await listDrivers(
          { status: 'active', limit: 100 },
          controller.signal
        );
        if (!controller.signal.aborted) {
          setDrivers(data.drivers || []);
          // Warn if list was truncated — schools with > 100 drivers
          if (data.pagination?.total > (data.drivers?.length || 0)) {
            setDriversWarning(
              `Showing first ${data.drivers?.length} of ${data.pagination.total} drivers. Search by name in the Drivers page to find others.`
            );
          } else {
            setDriversWarning(null);
          }
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        if (!controller.signal.aborted) setDrivers([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingDrivers(false);
      }
    }
    loadDrivers();
  }, [isEdit, modal.route, modal.open]);

  /** Validates and submits the route form. */
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = routeName.trim();
    if (!trimmedName) {
      setFormError('Route name is required.');
      return;
    }

    // Departure is required for create, optional for edit
    if (!isEdit && !departure) {
      setFormError('Departure time is required.');
      return;
    }

    // Validate HH:MM format if provided
    if (departure && !/^\d{2}:\d{2}$/.test(departure)) {
      setFormError('Departure must be in HH:MM format.');
      return;
    }

    const payload = {};
    if (isEdit) {
      // Only send changed fields
      if (trimmedName !== modal.route?.route_name) payload.route_name = trimmedName;
      if (departure && departure !== modal.route?.scheduled_departure) {
        payload.scheduled_departure = departure;
      }
      // Normalise to empty string for comparison
      const originalDriverId = modal.route?.default_driver_id || '';
      if (selectedDriverId !== originalDriverId) {
        payload.default_driver_id = selectedDriverId || null;
      }
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
    } else {
      payload.route_name = trimmedName;
      payload.scheduled_departure = departure;
      payload.default_driver_id = selectedDriverId || null;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateRoute(modal.busId, payload);
      } else {
        await createRoute(modal.busId, payload);
      }
      onSuccess(modal.busId);
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save route');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={modal.open} onClose={onClose} title={isEdit ? 'Edit Route' : 'Create Route'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="route-name" className="mb-1 block text-sm font-medium text-slate-700">
            Route Name <span className="text-red-500">*</span>
          </label>
          <input
            id="route-name"
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            disabled={saving}
            placeholder="e.g. North Campus Route"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="route-departure" className="mb-1 block text-sm font-medium text-slate-700">
            Departure Time {!isEdit && <span className="text-red-500">*</span>}
          </label>
          <input
            id="route-departure"
            type="time"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-slate-400">24-hour format (e.g. 08:30)</p>
        </div>

        {/* Default driver selection */}
        <div>
          <label
            htmlFor="route-driver"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Default Driver (optional)
          </label>
          <select
            id="route-driver"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            disabled={saving || isLoadingDrivers}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          >
            <option value="">— No driver assigned —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.employee_id})
              </option>
            ))}
          </select>
          {isLoadingDrivers && (
            <p className="mt-1 text-xs text-slate-400">Loading drivers...</p>
          )}
          {driversWarning && (
            <p className="mt-1 text-xs text-amber-600">{driversWarning}</p>
          )}
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
            {isEdit ? 'Save Changes' : 'Create Route'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Stop Add/Edit modal form.
 */
function StopModal({ modal, onClose, onSuccess }) {
  const isEdit = modal.mode === 'edit';
  const [stopName, setStopName] = useState('');
  const [sequence, setSequence] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Re-initialise form fields whenever the modal opens or its data changes
  useEffect(() => {
    if (!modal.open) return;
    if (isEdit && modal.stop) {
      setStopName(modal.stop.stop_name || '');
      setSequence(modal.stop.stop_sequence?.toString() || '');
      setLat(modal.stop.lat?.toString() || '');
      setLng(modal.stop.lng?.toString() || '');
    } else {
      setStopName('');
      setSequence('');
      setLat('');
      setLng('');
    }
    setFormError(null);
  }, [isEdit, modal.stop, modal.open]);

  /** Validates and submits the stop form. */
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = stopName.trim();
    if (!trimmedName) {
      setFormError('Stop name is required.');
      return;
    }

    const seq = parseInt(sequence, 10);
    if (Number.isNaN(seq) || seq < 1) {
      setFormError('Sequence must be a positive integer.');
      return;
    }

    const latNum = parseFloat(lat);
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError('Latitude must be between -90 and 90.');
      return;
    }

    const lngNum = parseFloat(lng);
    if (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setFormError('Longitude must be between -180 and 180.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        // Only send changed fields
        const changes = {};
        if (trimmedName !== modal.stop.stop_name) changes.stop_name = trimmedName;
        if (seq !== modal.stop.stop_sequence) changes.stop_sequence = seq;
        if (latNum !== modal.stop.lat) changes.lat = latNum;
        if (lngNum !== modal.stop.lng) changes.lng = lngNum;

        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
        await updateStopApi(modal.busId, modal.stop.id, changes);
      } else {
        await addStop(modal.busId, {
          stop_name: trimmedName,
          stop_sequence: seq,
          lat: latNum,
          lng: lngNum,
        });
      }
      onSuccess(modal.busId);
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save stop');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={modal.open} onClose={onClose} title={isEdit ? 'Edit Stop' : 'Add Stop'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="stop-name" className="mb-1 block text-sm font-medium text-slate-700">
            Stop Name <span className="text-red-500">*</span>
          </label>
          <input
            id="stop-name"
            type="text"
            value={stopName}
            onChange={(e) => setStopName(e.target.value)}
            disabled={saving}
            placeholder="e.g. Greenfield Colony"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="stop-sequence" className="mb-1 block text-sm font-medium text-slate-700">
            Sequence Number <span className="text-red-500">*</span>
          </label>
          <input
            id="stop-sequence"
            type="number"
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            disabled={saving}
            min="1"
            placeholder="1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-slate-400">Order in pickup route</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="stop-lat" className="mb-1 block text-sm font-medium text-slate-700">
              Latitude <span className="text-red-500">*</span>
            </label>
            <input
              id="stop-lat"
              type="number"
              step="0.000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              disabled={saving}
              placeholder="28.6139"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="stop-lng" className="mb-1 block text-sm font-medium text-slate-700">
              Longitude <span className="text-red-500">*</span>
            </label>
            <input
              id="stop-lng"
              type="number"
              step="0.000001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              disabled={saving}
              placeholder="77.2090"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
          </div>
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
            {isEdit ? 'Save Changes' : 'Add Stop'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Confirmation modal for destructive actions.
 */
function ConfirmModal({ modal, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    setConfirming(false);
    setConfirmError(null);
  }, [modal.open]);

  /** Executes the confirmed action. */
  async function handleConfirm() {
    setConfirming(true);
    setConfirmError(null);
    try {
      await onConfirm(modal.action, modal.busId, modal.stopId, modal.studentId);
      onClose();
    } catch (err) {
      setConfirmError(err.response?.data?.message || 'Action failed');
    } finally {
      setConfirming(false);
    }
  }

  // Derive title from action
  const titles = {
    deactivate: 'Confirm Deactivate',
    reactivate: 'Confirm Reactivate',
    deleteStop: 'Delete Stop',
    unassignStudent: 'Unassign Student',
  };

  return (
    <Modal open={modal.open} onClose={onClose} title={titles[modal.action] || 'Confirm'}>
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
 * Route panel (expanded inline below bus row)
 * ────────────────────────────────────────────────────────── */

/**
 * Renders the route detail panel inside the expanded bus row.
 */
function RoutePanel({
  busId,
  route,
  isRouteLoading,
  routeError,
  onEditRoute,
  onCreateRoute,
  onAddStop,
  onEditStop,
  onDeleteStop,
  onMoveStop,
  colSpan,
  reorderError,
  assignedStudents,
  isStudentsLoading,
  studentsError,
  onAssignStudent,
  onUnassignStudent,
}) {
  // Loading state
  if (isRouteLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="space-y-3">
            <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
          </div>
        </td>
      </tr>
    );
  }

  // Error fetching route
  if (routeError) {
    return (
      <tr>
        <td colSpan={colSpan} className="border-t border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-red-600">{routeError}</p>
        </td>
      </tr>
    );
  }

  // No route configured (404)
  if (!route) {
    return (
      <tr>
        <td colSpan={colSpan} className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">No route configured for this bus.</p>
            <button
              type="button"
              onClick={() => onCreateRoute(busId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Route
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Sort stops by sequence for display
  const sortedStops = [...(route.stops || [])].sort(
    (a, b) => a.stop_sequence - b.stop_sequence
  );

  return (
    <tr>
      <td colSpan={colSpan} className="border-t border-slate-200 bg-slate-50 p-4">
        {/* Route header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-800">{route.route_name}</p>
            <p className="text-sm text-slate-500">
              Departure: {fmtTime(route.scheduled_departure)}
              <span className="mx-2">·</span>
              Driver: {route.default_driver_name || 'No driver assigned'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEditRoute(busId, route)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Route
          </button>
        </div>

        {/* Stops sub-section */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">
            Stops ({sortedStops.length})
          </p>
          <button
            type="button"
            onClick={() => onAddStop(busId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Stop
          </button>
        </div>

        {sortedStops.length === 0 ? (
          <p className="text-sm text-slate-400">No stops added yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Stop Name</th>
                  <th className="px-3 py-2 font-medium">Lat</th>
                  <th className="px-3 py-2 font-medium">Lng</th>
                  <th className="px-3 py-2 font-medium">Students</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedStops.map((stop, idx) => (
                  <tr key={stop.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{stop.stop_sequence}</td>
                    <td className="px-3 py-2 text-slate-800">{stop.stop_name}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">
                      {typeof stop.lat === 'number' ? stop.lat.toFixed(4) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">
                      {typeof stop.lng === 'number' ? stop.lng.toFixed(4) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {stop.students?.length ?? 0}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {/* Move up */}
                        <button
                          type="button"
                          onClick={() => onMoveStop(busId, sortedStops, idx, 'up')}
                          disabled={idx === 0}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        {/* Move down */}
                        <button
                          type="button"
                          onClick={() => onMoveStop(busId, sortedStops, idx, 'down')}
                          disabled={idx === sortedStops.length - 1}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        {/* Edit stop */}
                        <button
                          type="button"
                          onClick={() => onEditStop(busId, stop)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          title="Edit stop"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* Delete stop */}
                        <button
                          type="button"
                          onClick={() => onDeleteStop(busId, stop.id)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                          title="Delete stop"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Inline reorder error — shown temporarily when sequence swap fails */}
        {reorderError && (
          <p className="mt-2 text-xs text-red-600">{reorderError}</p>
        )}

        {/* ── Assigned Students sub-section ─────────────── */}
        <hr className="my-4 border-slate-200" />

        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">
            Assigned Students ({assignedStudents.length})
          </p>
          {/* Route is guaranteed truthy here — RoutePanel returns early when
              route is null, so this button is always reachable */}
          <button
            type="button"
            onClick={() => onAssignStudent(busId)}
            aria-label="Assign student to bus"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Assign Student
          </button>
        </div>

        {/* Students loading skeleton */}
        {isStudentsLoading && (
          <div className="space-y-2">
            <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
          </div>
        )}

        {/* Students error */}
        {!isStudentsLoading && studentsError && (
          <p className="text-sm text-red-600">{studentsError}</p>
        )}

        {/* Students empty state */}
        {!isStudentsLoading && !studentsError && assignedStudents.length === 0 && (
          <p className="text-sm text-slate-400">No students assigned to this bus.</p>
        )}

        {/* Students table */}
        {!isStudentsLoading && !studentsError && assignedStudents.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Roll No</th>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Stop</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{s.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{s.roll_no}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.class}{s.section ? ` ${s.section}` : ''}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.stop_name || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => onUnassignStudent(busId, s.id, s.name)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                          aria-label={`Unassign ${s.name}`}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Unassign
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </td>
    </tr>
  );
}

/* ──────────────────────────────────────────────────────────
 * Mobile route panel (card-based layout for < md screens)
 * ────────────────────────────────────────────────────────── */

function MobileRoutePanel({
  busId,
  route,
  isRouteLoading,
  routeError,
  assignedStudents,
  isStudentsLoading,
  studentsError,
  reorderError,
  onEditRoute,
  onCreateRoute,
  onAddStop,
  onEditStop,
  onDeleteStop,
  onMoveStop,
  onAssignStudent,
  onUnassignStudent,
}) {
  // Loading state
  if (isRouteLoading) {
    return (
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-3 w-48 rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  // Error fetching route
  if (routeError) {
    return (
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-red-600">{routeError}</p>
      </div>
    );
  }

  // No route configured
  if (!route) {
    return (
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">No route configured for this bus.</p>
          <button
            type="button"
            onClick={() => onCreateRoute(busId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Route
          </button>
        </div>
      </div>
    );
  }

  // Sort stops by sequence
  const sortedStops = [...(route.stops || [])].sort(
    (a, b) => a.stop_sequence - b.stop_sequence
  );

  return (
    <div className="space-y-4 border-t border-slate-200 bg-slate-50 p-4">
      {/* Section 1 — Route info */}
      <div>
        <div className="mb-2 flex items-start justify-between">
          <div>
            <p className="font-semibold text-slate-800">{route.route_name}</p>
            <p className="text-sm text-slate-500">
              Departure: {fmtTime(route.scheduled_departure)}
            </p>
            <p className="text-sm text-slate-500">
              Driver: {route.default_driver_name || 'No driver assigned'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEditRoute(busId, route)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      {/* Section 2 — Stops */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            Stops ({sortedStops.length})
          </p>
          <button
            type="button"
            onClick={() => onAddStop(busId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Stop
          </button>
        </div>

        {sortedStops.length === 0 ? (
          <p className="text-sm text-slate-400">No stops added yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedStops.map((stop, idx) => (
              <div key={stop.id} className="rounded-lg border border-slate-200 bg-white p-3">
                {/* Stop header: sequence + name */}
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <span className="mr-1 text-xs text-slate-400">#{stop.stop_sequence}</span>
                    <span className="text-sm font-medium text-slate-800">{stop.stop_name}</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {stop.students?.length ?? 0} students
                  </span>
                </div>

                {/* Lat/Lng */}
                <p className="mb-3 font-mono text-xs text-slate-500">
                  {typeof stop.lat === 'number'
                    ? stop.lat.toFixed(4)
                    : parseFloat(stop.lat).toFixed(4)},{' '}
                  {typeof stop.lng === 'number'
                    ? stop.lng.toFixed(4)
                    : parseFloat(stop.lng).toFixed(4)}
                </p>

                {/* Stop actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMoveStop(busId, sortedStops, idx, 'up')}
                    disabled={idx === 0}
                    aria-label="Move stop up"
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveStop(busId, sortedStops, idx, 'down')}
                    disabled={idx === sortedStops.length - 1}
                    aria-label="Move stop down"
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditStop(busId, stop)}
                    aria-label={`Edit stop ${stop.stop_name}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteStop(busId, stop.id)}
                    aria-label={`Delete stop ${stop.stop_name}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reorder error */}
        {reorderError && (
          <p className="mt-1 text-xs text-red-600">{reorderError}</p>
        )}
      </div>

      {/* Section 3 — Assigned Students */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            Assigned Students ({assignedStudents.length})
          </p>
          <button
            type="button"
            onClick={() => onAssignStudent(busId)}
            aria-label="Assign student to bus"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Assign
          </button>
        </div>

        {isStudentsLoading && (
          <div className="animate-pulse space-y-2">
            <div className="h-12 rounded-lg bg-slate-200" />
            <div className="h-12 rounded-lg bg-slate-200" />
          </div>
        )}

        {!isStudentsLoading && studentsError && (
          <p className="text-sm text-red-600">{studentsError}</p>
        )}

        {!isStudentsLoading && !studentsError && assignedStudents.length === 0 && (
          <p className="text-sm text-slate-400">No students assigned to this bus.</p>
        )}

        {!isStudentsLoading && !studentsError && assignedStudents.length > 0 && (
          <div className="space-y-2">
            {assignedStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {student.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{student.roll_no}</span>
                    {' · '}
                    {student.class}{student.section ? ` ${student.section}` : ''}
                  </p>
                  {student.stop_name && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Stop: {student.stop_name}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onUnassignStudent(busId, student.id, student.name)}
                  aria-label={`Unassign ${student.name}`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <UserMinus className="h-3 w-3" />
                  Unassign
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * Assign Student modal — search, select, optional stop pick
 * ────────────────────────────────────────────────────────── */

function AssignStudentModal({ modal, onClose, onSuccess }) {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStopId, setSelectedStopId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const searchDebounceRef = useRef(null);
  // Tracks the AbortController for the active search request
  const abortControllerRef = useRef(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      // Abort any in-flight search request on unmount
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Re-initialise form state when modal opens or closes
  useEffect(() => {
    if (!modal.open) {
      // Modal closed — cancel any pending search timer and in-flight
      // request to prevent stale state updates while hidden
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }
    // Modal opened — reset all form state
    setSearchInput('');
    setSearchResults([]);
    setIsSearching(false);
    setSearchError(null);
    setSelectedStudent(null);
    setSelectedStopId('');
    setAssigning(false);
    setAssignError(null);
  }, [modal.open]);

  // Debounced student search
  function handleSearch(value) {
    setSearchInput(value);
    setAssignError(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    // Cancel any in-flight search request before starting a new one
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      try {
        const data = await listStudents({
          search: value.trim(),
          status: 'active',
          limit: 10,
          page: 1,
        }, abortControllerRef.current.signal);
        setSearchResults(data.students || []);
      } catch (err) {
        // Ignore abort errors — request was superseded by a newer search
        if (err.name === 'AbortError' || err.name === 'CanceledError') return;
        setSearchError(err.response?.data?.message || 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
  }

  // Select a student from search results
  function selectStudent(student) {
    setSelectedStudent(student);
    setSearchInput(student.name);
    setSearchResults([]);
    setAssignError(null);
  }

  // Submit assignment
  async function handleAssign() {
    if (!selectedStudent) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const payload = { student_id: selectedStudent.id };
      if (selectedStopId) payload.stop_id = selectedStopId;
      await assignStudent(modal.busId, payload);
      onSuccess(modal.busId);
      onClose();
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  }

  // Route stops for optional stop picker
  const stops = modal.route?.stops || [];
  const sortedStops = [...stops].sort((a, b) => a.stop_sequence - b.stop_sequence);

  return (
    <Modal open={modal.open} onClose={onClose} title="Assign Student" disableClose={assigning}>
      <div className="space-y-4">
        {/* Student search */}
        <div>
          <label htmlFor="assign-student-search" className="mb-1 block text-sm font-medium text-slate-700">
            Search Student <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="assign-student-search"
              type="text"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              disabled={assigning}
              placeholder="Type a name or roll number..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              autoComplete="off"
            />
            {/* Search results dropdown */}
            {(searchResults.length > 0 || isSearching) && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {isSearching && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                  </div>
                )}
                {!isSearching && searchResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectStudent(s)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <div>
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <span className="ml-2 font-mono text-xs text-slate-500">{s.roll_no}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {s.class}{s.section ? ` ${s.section}` : ''}
                      </span>
                    </div>
                    {s.bus_number && (
                      <span className="text-xs text-amber-600">(Assigned to {s.bus_number})</span>
                    )}
                  </button>
                ))}
                {!isSearching && searchResults.length === 0 && searchInput.trim() && (
                  <p className="px-3 py-2 text-sm text-slate-400">No students found.</p>
                )}
              </div>
            )}
          </div>
          {searchError && <p className="mt-1 text-xs text-red-600">{searchError}</p>}
        </div>

        {/* Selected student indicator */}
        {selectedStudent && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{selectedStudent.name}</p>
              <p className="text-xs text-slate-500">
                {selectedStudent.roll_no} · {selectedStudent.class}{selectedStudent.section ? ` ${selectedStudent.section}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedStudent(null); setSearchInput(''); }}
              className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Optional stop selector */}
        {modal.route && sortedStops.length > 0 && (
          <div>
            <label htmlFor="assign-stop-select" className="mb-1 block text-sm font-medium text-slate-700">
              Assign to Stop (optional)
            </label>
            <select
              id="assign-stop-select"
              value={selectedStopId}
              onChange={(e) => setSelectedStopId(e.target.value)}
              disabled={assigning}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            >
              <option value="">— No specific stop —</option>
              {sortedStops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.stop_sequence}. {stop.stop_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Leaving this blank assigns the student to the bus without a specific stop.
            </p>
          </div>
        )}

        {/* Error display */}
        {assignError && <p className="text-sm text-red-600">{assignError}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={assigning}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selectedStudent || assigning}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign Student
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Main page component
 * ────────────────────────────────────────────────────────── */

export default function BusesPage() {
  // ── Core list state ──────────────────────────────────
  const [buses, setBuses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Route expansion state ────────────────────────────
  const [expandedBusId, setExpandedBusId] = useState(null);
  const [busRoute, setBusRoute] = useState({});
  const [busRouteLoading, setBusRouteLoading] = useState({});
  const [busRouteError, setBusRouteError] = useState({});

  // ── Assigned students cache ──────────────────────────
  const [busStudents, setBusStudents] = useState({});
  const [busStudentsLoading, setBusStudentsLoading] = useState({});
  const [busStudentsError, setBusStudentsError] = useState({});

  // ── Modal state ──────────────────────────────────────
  const [busModal, setBusModal] = useState({ open: false, mode: 'add', bus: null });
  const [routeModal, setRouteModal] = useState({ open: false, mode: 'create', busId: null, route: null });
  const [stopModal, setStopModal] = useState({ open: false, mode: 'add', busId: null, stop: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, busId: null, stopId: null, studentId: null, studentName: '', label: '' });
  const [assignModal, setAssignModal] = useState({ open: false, busId: null, route: null });

  // Map of busId → reorder error string | null — auto-clears after 4s
  const [reorderError, setReorderError] = useState({});

  // ── Refs ─────────────────────────────────────────────
  const hasFetchedRef = useRef(false);
  const debounceRef = useRef(null);
  const tableTopRef = useRef(null);
  // Tracks pending reorder-error auto-clear timers keyed by busId
  const reorderTimeoutsRef = useRef({});

  // Cancel any pending debounce timer when the component unmounts
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  // Clear all pending reorder error timers on unmount
  useEffect(() => {
    return () => {
      Object.values(reorderTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  // ── Table column count for colSpan ───────────────────
  const COL_COUNT = 8;

  /* ────────────────────────────────────────────────────────
   * Data fetching
   * ──────────────────────────────────────────────────────── */

  /** Fetches the bus list for the current page, search, and filter. */
  const fetchBuses = useCallback(async (page, searchVal, status) => {
    if (!hasFetchedRef.current) setIsLoading(true);
    setError(null);

    try {
      const data = await listBuses({
        page,
        limit: PAGE_LIMIT,
        search: searchVal || undefined,
        status,
      });
      setBuses(data.buses || []);
      setPagination(data.pagination || null);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load buses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and when page/filter changes
  useEffect(() => {
    fetchBuses(currentPage, search, statusFilter);
  }, [currentPage, statusFilter, fetchBuses]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Debounced search handler — resets to page 1. */
  function handleSearchChange(value) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchBuses(1, value, statusFilter);
    }, DEBOUNCE_MS);
  }

  // Cancel any pending debounced search before switching filters
  function handleStatusFilter(status) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setStatusFilter(status);
    setCurrentPage(1);
    fetchBuses(1, search, status);
  }

  /** Refetch current page (for retry / after mutations). */
  function refetch() {
    fetchBuses(currentPage, search, statusFilter);
  }

  /** Pagination page change. */
  function goToPage(page) {
    setCurrentPage(page);
    tableTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  /* ────────────────────────────────────────────────────────
   * Route panel expansion and fetching
   * ──────────────────────────────────────────────────────── */

  /** Toggles the route panel for a bus row. */
  function toggleExpand(busId) {
    if (expandedBusId === busId) {
      setExpandedBusId(null);
      return;
    }
    setExpandedBusId(busId);
    // Only fetch if not yet cached (undefined) — null means confirmed no route
    if (busRoute[busId] === undefined && !busRouteLoading[busId]) {
      fetchRouteForBus(busId);
    }
    // Fetch students if not yet cached
    if (busStudents[busId] === undefined && !busStudentsLoading[busId]) {
      fetchStudentsForBus(busId);
    }
  }

  /** Fetches route data for a single bus and caches it. */
  async function fetchRouteForBus(busId) {
    setBusRouteLoading((prev) => ({ ...prev, [busId]: true }));
    setBusRouteError((prev) => ({ ...prev, [busId]: null }));

    try {
      const data = await getRoute(busId);
      setBusRoute((prev) => ({ ...prev, [busId]: data.route }));
    } catch (err) {
      // 404 means no route — store null to show "Create Route"
      if (err.response?.status === 404) {
        setBusRoute((prev) => ({ ...prev, [busId]: null }));
      } else {
        setBusRouteError((prev) => ({
          ...prev,
          [busId]: err.response?.data?.message || 'Failed to load route',
        }));
      }
    } finally {
      setBusRouteLoading((prev) => ({ ...prev, [busId]: false }));
    }
  }

  /** Refetches a bus's route data (after mutations). */
  function refreshRoute(busId) {
    // Clear cache so panel re-renders with fresh data
    setBusRoute((prev) => {
      const next = { ...prev };
      delete next[busId];
      return next;
    });
    fetchRouteForBus(busId);
  }

  /** Fetches assigned students for a bus and caches the result. */
  async function fetchStudentsForBus(busId) {
    setBusStudentsLoading((prev) => ({ ...prev, [busId]: true }));
    setBusStudentsError((prev) => ({ ...prev, [busId]: null }));
    try {
      const data = await listBusStudents(busId);
      setBusStudents((prev) => ({ ...prev, [busId]: data.students || [] }));
    } catch (err) {
      setBusStudentsError((prev) => ({
        ...prev,
        [busId]: err.response?.data?.message || 'Failed to load students',
      }));
    } finally {
      setBusStudentsLoading((prev) => ({ ...prev, [busId]: false }));
    }
  }

  /** Clears student cache and refetches for a bus. */
  function refreshStudents(busId) {
    setBusStudents((prev) => {
      const next = { ...prev };
      delete next[busId];
      return next;
    });
    fetchStudentsForBus(busId);
  }

  /* ────────────────────────────────────────────────────────
   * Modal openers
   * ──────────────────────────────────────────────────────── */

  function openAddBus() {
    setBusModal({ open: true, mode: 'add', bus: null });
  }

  function openEditBus(bus) {
    setBusModal({ open: true, mode: 'edit', bus });
  }

  function openDeactivate(busId) {
    setConfirmModal({
      open: true,
      action: 'deactivate',
      busId,
      stopId: null,
      studentId: null,
      studentName: '',
      label: 'Deactivating this bus will remove all student assignments and deactivate its route. This cannot be undone automatically.',
    });
  }

  function openReactivate(busId) {
    setConfirmModal({
      open: true,
      action: 'reactivate',
      busId,
      stopId: null,
      studentId: null,
      studentName: '',
      label: 'This will reactivate the bus only. Student assignments and route must be reconfigured manually.',
    });
  }

  function openCreateRoute(busId) {
    setRouteModal({ open: true, mode: 'create', busId, route: null });
  }

  function openEditRoute(busId, route) {
    setRouteModal({ open: true, mode: 'edit', busId, route });
  }

  function openAddStop(busId) {
    setStopModal({ open: true, mode: 'add', busId, stop: null });
  }

  function openEditStop(busId, stop) {
    setStopModal({ open: true, mode: 'edit', busId, stop });
  }

  function openDeleteStop(busId, stopId) {
    setConfirmModal({
      open: true,
      action: 'deleteStop',
      busId,
      stopId,
      studentId: null,
      studentName: '',
      label: 'This will remove the stop and unassign any students linked to it.',
    });
  }

  /** Opens the assign student modal for a bus. */
  function openAssignStudent(busId) {
    const route = busRoute[busId] || null;
    setAssignModal({ open: true, busId, route });
  }

  /** Opens the confirm modal to unassign a student from a bus. */
  function openUnassignStudent(busId, studentId, studentName) {
    setConfirmModal({
      open: true,
      action: 'unassignStudent',
      busId,
      stopId: null,
      studentId,
      studentName,
      label: `This will remove ${studentName} from this bus. Their stop assignment will also be cleared.`,
    });
  }

  /* ────────────────────────────────────────────────────────
   * Confirm action handler
   * ──────────────────────────────────────────────────────── */

  /** Executes the confirmed destructive action. */
  async function handleConfirmAction(action, busId, stopId, studentId) {
    if (action === 'deactivate') {
      await deactivateBus(busId);
      // Clear cached route since it's now deactivated
      setBusRoute((prev) => {
        const next = { ...prev };
        delete next[busId];
        return next;
      });
      // Clear cached students — deactivation removes all assignments
      setBusStudents((prev) => {
        const next = { ...prev };
        delete next[busId];
        return next;
      });
      refetch();
    } else if (action === 'reactivate') {
      await reactivateBus(busId);
      refetch();
    } else if (action === 'deleteStop') {
      await deleteStopApi(busId, stopId);
      // Refresh both caches — stop deletion affects route stops and
      // any students assigned to the deleted stop
      refreshRoute(busId);
      refreshStudents(busId);
      refetch();
    } else if (action === 'unassignStudent') {
      await unassignStudent(busId, studentId);
      // Refresh both caches — unassignment affects student list and
      // route stop student counts
      refreshRoute(busId);
      refreshStudents(busId);
      refetch();
    }
  }

  /* ────────────────────────────────────────────────────────
   * Stop reorder handler
   * ──────────────────────────────────────────────────────── */

  /** Swaps a stop with its neighbour and calls the reorder API. */
  async function handleMoveStop(busId, sortedStops, index, direction) {
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= sortedStops.length) return;

    // Build the reordered stops array with swapped sequences
    const updated = sortedStops.map((s) => ({
      id: s.id,
      stop_sequence: s.stop_sequence,
    }));

    // Swap sequences between the two stops
    const tempSeq = updated[index].stop_sequence;
    updated[index].stop_sequence = updated[swapIdx].stop_sequence;
    updated[swapIdx].stop_sequence = tempSeq;

    try {
      await reorderStops(busId, updated);
      refreshRoute(busId);
    } catch (err) {
      // Show reorder failure inline — cancel any prior timer for this bus
      const msg = err.response?.data?.message || 'Failed to reorder stops';
      setReorderError((prev) => ({ ...prev, [busId]: msg }));
      if (reorderTimeoutsRef.current[busId]) {
        clearTimeout(reorderTimeoutsRef.current[busId]);
      }
      reorderTimeoutsRef.current[busId] = setTimeout(() => {
        setReorderError((prev) => ({ ...prev, [busId]: null }));
        delete reorderTimeoutsRef.current[busId];
      }, 4000);
    }
  }

  /* ────────────────────────────────────────────────────────
   * Bus modal success handlers
   * ──────────────────────────────────────────────────────── */

  /** Called after a bus is added — reset to page 1. */
  function onBusAddSuccess() {
    setCurrentPage(1);
    fetchBuses(1, search, statusFilter);
  }

  /** Called after a bus is edited — refetch current page. */
  function onBusEditSuccess() {
    refetch();
  }

  // Refresh both caches after assignment — stop student counts and
  // assigned student list both change
  function onAssignSuccess(busId) {
    refreshRoute(busId);
    refreshStudents(busId);
    refetch();
  }

  /* ────────────────────────────────────────────────────────
   * Render
   * ──────────────────────────────────────────────────────── */

  // Status filter button helper
  const filterBtns = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6" ref={tableTopRef}>
      {/* ── Header row ─────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xl font-semibold text-slate-800">Buses & Routes</p>
        <button
          type="button"
          onClick={openAddBus}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          <Plus className="h-4 w-4" />
          Add Bus
        </button>
      </div>

      {/* ── Search + filter row ────────────────────────── */}
      <div className="mb-4 flex flex-col flex-wrap items-start gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative w-full min-w-0 flex-1 sm:w-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search bus number..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter buttons */}
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

      {/* ── Error banner ───────────────────────────────── */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* ── Bus table — hidden on mobile, visible on md+ ── */}
      <div className="hidden md:block">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Bus Number</th>
              <th className="px-4 py-3 font-medium">Route</th>
              <th className="px-4 py-3 font-medium">Departure</th>
              <th className="px-4 py-3 font-medium">Driver</th>
              <th className="px-4 py-3 font-medium">Students</th>
              <th className="px-4 py-3 font-medium">Seats</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Loading skeleton */}
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: COL_COUNT }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))}

            {/* Empty state */}
            {!isLoading && !error && buses.length === 0 && (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <Bus className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No buses found</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Bus rows */}
            {!isLoading &&
              buses.map((bus) => {
                const isExpanded = expandedBusId === bus.id;
                const seatBadge = SEAT_BADGE[bus.seat_status] || SEAT_BADGE.AVAILABLE;

                return (
                  <Fragment key={bus.id}>
                    <tr className="hover:bg-slate-50">
                      {/* Bus number */}
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {bus.bus_number}
                      </td>

                      {/* Route name */}
                      <td className="px-4 py-3 text-slate-600">
                        {bus.route_name || <span className="text-slate-400">—</span>}
                      </td>

                      {/* Departure */}
                      <td className="px-4 py-3 text-slate-600">
                        {fmtTime(bus.scheduled_departure)}
                      </td>

                      {/* Driver */}
                      <td className="px-4 py-3 text-slate-600">
                        {bus.default_driver_name || <span className="text-slate-400">—</span>}
                      </td>

                      {/* Students */}
                      <td className="px-4 py-3 text-slate-600">
                        {bus.student_count}/{bus.capacity}
                      </td>

                      {/* Seats badge */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            seatBadge.classes
                          )}
                        >
                          {seatBadge.label}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            bus.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {bus.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit bus */}
                          <button
                            type="button"
                            onClick={() => openEditBus(bus)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            title="Edit bus"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* Deactivate / Reactivate */}
                          {bus.is_active ? (
                            <button
                              type="button"
                              onClick={() => openDeactivate(bus.id)}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                              title="Deactivate bus"
                            >
                              <PowerOff className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openReactivate(bus.id)}
                              className="rounded p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-300"
                              title="Reactivate bus"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          )}

                          {/* Expand/collapse route */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(bus.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            title={isExpanded ? 'Collapse route' : 'Expand route'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded route panel */}
                    {isExpanded && (
                      <RoutePanel
                        busId={bus.id}
                        route={busRoute[bus.id]}
                        isRouteLoading={busRouteLoading[bus.id]}
                        routeError={busRouteError[bus.id]}
                        onEditRoute={openEditRoute}
                        onCreateRoute={openCreateRoute}
                        onAddStop={openAddStop}
                        onEditStop={openEditStop}
                        onDeleteStop={openDeleteStop}
                        onMoveStop={handleMoveStop}
                        colSpan={COL_COUNT}
                        reorderError={reorderError[bus.id] || null}
                        assignedStudents={busStudents[bus.id] || []}
                        isStudentsLoading={busStudentsLoading[bus.id] || false}
                        studentsError={busStudentsError[bus.id] || null}
                        onAssignStudent={openAssignStudent}
                        onUnassignStudent={openUnassignStudent}
                      />
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
      </div>

      {/* ── Mobile card list — visible on mobile, hidden on md+ ── */}
      <div className="md:hidden space-y-3">
        {/* Loading skeletons */}
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-200" />
          </div>
        ))}

        {/* Empty state */}
        {!isLoading && !error && buses.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center">
            <div className="flex flex-col items-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Bus className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No buses found</p>
            </div>
          </div>
        )}

        {/* Bus cards */}
        {!isLoading && buses.map((bus) => {
          const isExpanded = expandedBusId === bus.id;
          const seatBadge = SEAT_BADGE[bus.seat_status] || SEAT_BADGE.AVAILABLE;

          return (
            <div key={bus.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Card header */}
              <div className="p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{bus.bus_number}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {bus.route_name || (
                        <span className="text-slate-400">No route</span>
                      )}
                    </p>
                  </div>
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    bus.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  )}>
                    {bus.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Bus details */}
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-slate-400">Departure</p>
                    <p className="text-sm text-slate-600">{fmtTime(bus.scheduled_departure)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Driver</p>
                    <p className="text-sm text-slate-600">{bus.default_driver_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Students</p>
                    <p className="text-sm text-slate-600">{bus.student_count}/{bus.capacity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Seats</p>
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      seatBadge.classes
                    )}>
                      {seatBadge.label}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openEditBus(bus)}
                    aria-label={`Edit bus ${bus.bus_number}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>

                  {bus.is_active ? (
                    <button
                      type="button"
                      onClick={() => openDeactivate(bus.id)}
                      aria-label={`Deactivate bus ${bus.bus_number}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openReactivate(bus.id)}
                      aria-label={`Reactivate bus ${bus.bus_number}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-200 px-3 py-2 text-xs font-medium text-green-600 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-300"
                    >
                      <Power className="h-3.5 w-3.5" />
                      Reactivate
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleExpand(bus.id)}
                    aria-label={isExpanded
                      ? `Collapse route for ${bus.bus_number}`
                      : `Expand route for ${bus.bus_number}`}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5" />
                      : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded route panel — mobile version */}
              {isExpanded && (
                <MobileRoutePanel
                  busId={bus.id}
                  route={busRoute[bus.id]}
                  isRouteLoading={busRouteLoading[bus.id]}
                  routeError={busRouteError[bus.id]}
                  assignedStudents={busStudents[bus.id] || []}
                  isStudentsLoading={busStudentsLoading[bus.id] || false}
                  studentsError={busStudentsError[bus.id] || null}
                  reorderError={reorderError[bus.id] || null}
                  onEditRoute={openEditRoute}
                  onCreateRoute={openCreateRoute}
                  onAddStop={openAddStop}
                  onEditStop={openEditStop}
                  onDeleteStop={openDeleteStop}
                  onMoveStop={handleMoveStop}
                  onAssignStudent={openAssignStudent}
                  onUnassignStudent={openUnassignStudent}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pagination ─────────────────────────────────── */}
      {pagination && pagination.total_pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {/* Previous */}
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {/* Page numbers */}
          {getVisiblePages(currentPage, pagination.total_pages).map(
            (item, idx) =>
              item === '...' ? (
                // Non-clickable ellipsis separator
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1.5 text-sm text-slate-400 select-none"
                >
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

          {/* Next */}
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= pagination.total_pages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────── */}
      <BusModal
        modal={busModal}
        onClose={() => setBusModal((m) => ({ ...m, open: false }))}
        onSuccess={busModal.mode === 'add' ? onBusAddSuccess : onBusEditSuccess}
      />

      <RouteModal
        modal={routeModal}
        onClose={() => setRouteModal((m) => ({ ...m, open: false }))}
        onSuccess={refreshRoute}
      />

      <StopModal
        modal={stopModal}
        onClose={() => setStopModal((m) => ({ ...m, open: false }))}
        onSuccess={refreshRoute}
      />

      <ConfirmModal
        modal={confirmModal}
        onClose={() => setConfirmModal((m) => ({ ...m, open: false }))}
        onConfirm={handleConfirmAction}
      />

      <AssignStudentModal
        modal={assignModal}
        onClose={() => setAssignModal((m) => ({ ...m, open: false }))}
        onSuccess={onAssignSuccess}
      />
    </div>
  );
}
