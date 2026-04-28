/**
 * SchoolsPage.jsx
 * Super Admin schools management page.
 * Provides list, create, edit, deactivate, and reactivate for all
 * schools on the platform.
 * Route: /super-admin/schools
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Eye, Pencil, XCircle, CheckCircle,
  Loader2, X, Building2,
} from 'lucide-react';
import {
  listSchools, createSchool, updateSchool,
  deactivateSchool, reactivateSchool,
} from '../../api/schools.api';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Pagination helper
 * ────────────────────────────────────────────────────────── */

// Returns array of page numbers and '...' strings for pagination display
function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set();
  pages.add(1);
  pages.add(totalPages);
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
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

/* ──────────────────────────────────────────────────────────
 * Local Modal component
 * ────────────────────────────────────────────────────────── */

// Reusable modal shell with backdrop, focus trap, and Escape/click-to-close
function Modal({ open, onClose, title, children, disableClose = false }) {
  const containerRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !disableClose) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, disableClose]);

  // Focus first focusable element when modal opens
  useEffect(() => {
    if (!open) return;
    const focusable = getFocusableElements();
    if (focusable.length) focusable[0].focus();
  }, [open]);

  // Queries live focusable elements inside the modal container
  function getFocusableElements() {
    const candidates = containerRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!candidates) return [];
    return Array.from(candidates).filter((el) => {
      if (el.offsetParent === null) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      return true;
    });
  }

  // Handles Tab/Shift+Tab to trap focus within the modal
  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    const current = getFocusableElements();
    if (!current.length) return;
    const first = current[0];
    const last = current[current.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={disableClose ? undefined : onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
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
 * Skeleton loading component
 * ────────────────────────────────────────────────────────── */


// Skeleton rows for desktop table — renders directly inside <tbody>
function TableSkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
              <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
              <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// Skeleton cards for mobile — renders inside a <div>
function CardSkeletonList() {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4 mb-3 shadow-sm animate-pulse">
          <div className="flex gap-3 mb-2">
            <div className="h-4 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
          <div className="flex gap-3 mb-2">
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
          <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <div className="h-7 w-16 bg-gray-200 rounded" />
            <div className="h-7 w-16 bg-gray-200 rounded" />
            <div className="h-7 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

/* ──────────────────────────────────────────────────────────
 * Main component
 * ────────────────────────────────────────────────────────── */

// Super Admin schools management page — CRUD and status toggle
export default function SchoolsPage() {
  // School list data
  const [schools, setSchools] = useState([]);
  const [pagination, setPagination] = useState(null);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState(null);

  // Search: inputValue is display state, apiSearch drives the fetch
  const [inputValue, setInputValue] = useState('');
  const [apiSearch, setApiSearch] = useState('');

  // Filters and pagination
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // refreshKey: incrementing this re-triggers the fetch useEffect
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal state: type is 'add' | 'edit' | 'deactivate' | 'reactivate' | null
  const [modal, setModal] = useState({ type: null, school: null });

  // hasFetchedRef: true after first successful fetch — controls skeleton vs spinner
  const hasFetchedRef = useRef(false);

  // isFetchingRef: prevents overlapping concurrent fetches
  const isFetchingRef = useRef(false);

  // debounceTimerRef: stores the pending debounce timeout ID for search
  const debounceTimerRef = useRef(null);

  const navigate = useNavigate();

  /* ── Data fetching ── */

  // Single fetch trigger — watches search, filter, page, and refreshKey
  useEffect(() => {
    const controller = new AbortController();

    async function fetchSchools() {
      // Guard against overlapping fetches
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      // Show skeleton on first load, spinner on subsequent loads
      if (!hasFetchedRef.current) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }
      setError(null);

      try {
        const data = await listSchools(
          { page: currentPage, limit: 20, search: apiSearch, status: statusFilter },
          controller.signal
        );
        setSchools(data.schools);
        setPagination(data.pagination);
        hasFetchedRef.current = true;
      } catch (err) {
        // Silent abort — do not set error state
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        setError('Failed to load schools. Please try again.');
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
        isFetchingRef.current = false;
      }
    }

    fetchSchools();
    return () => {
      controller.abort();
      isFetchingRef.current = false;
    };
  }, [apiSearch, statusFilter, currentPage, refreshKey]);

  /* ── Search debounce ── */

  // Debounces search input by 300ms before updating the apiSearch trigger
  useEffect(() => {
    debounceTimerRef.current = setTimeout(() => {
      setApiSearch(inputValue);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(debounceTimerRef.current);
  }, [inputValue]);

  /* ── Handlers ── */

  // Cancels pending debounce and applies status filter immediately
  function handleStatusFilter(value) {
    clearTimeout(debounceTimerRef.current);
    setStatusFilter(value);
    setApiSearch(inputValue);
    setCurrentPage(1);
  }

  // Opens the Add School modal
  function openAddModal() {
    setModal({ type: 'add', school: null });
  }

  // Opens the Edit School modal with the target school pre-loaded
  function openEditModal(school) {
    setModal({ type: 'edit', school });
  }

  // Opens the deactivate confirmation modal for the target school
  function openDeactivateModal(school) {
    setModal({ type: 'deactivate', school });
  }

  // Opens the reactivate confirmation modal for the target school
  function openReactivateModal(school) {
    setModal({ type: 'reactivate', school });
  }

  // Closes any open modal
  function closeModal() {
    setModal({ type: null, school: null });
  }

  // Called by AddSchoolModal on success — go to page 1 or force refetch
  function handleAddSuccess() {
    closeModal();
    if (currentPage === 1 && apiSearch === '') {
      setRefreshKey((prev) => prev + 1);
    } else {
      setCurrentPage(1);
      setApiSearch('');
      setInputValue('');
    }
  }

  // Called by EditSchoolModal on success — update matching row in place
  function handleEditSuccess(updatedSchool) {
    closeModal();
    setSchools((prev) =>
      prev.map((s) =>
        s.id === updatedSchool.id
          ? { ...s, name: updatedSchool.name, city: updatedSchool.city, state: updatedSchool.state }
          : s
      )
    );
  }

  // Called by ConfirmModal on deactivate success — flip is_active to false
  function handleDeactivateSuccess(schoolId) {
    closeModal();
    setSchools((prev) =>
      prev.map((s) => (s.id === schoolId ? { ...s, is_active: false } : s))
    );
  }

  // Called by ConfirmModal on reactivate success — flip is_active to true
  function handleReactivateSuccess(updatedSchool) {
    closeModal();
    setSchools((prev) =>
      prev.map((s) => (s.id === updatedSchool.id ? { ...s, is_active: true } : s))
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">

      {/* ① Header row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
        <button
          type="button"
          onClick={openAddModal}
          disabled={isLoading && !hasFetchedRef.current}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add School
        </button>
      </div>

      {/* ② Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search schools"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
          aria-label="Filter by status"
        >
          <option value="all">All Schools</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* ③ Stats + refetch indicator */}
      {pagination !== null && !isLoading && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span>
            Showing {schools.length} of {pagination.total} school{pagination.total !== 1 ? 's' : ''}
          </span>
          {isRefetching && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        </div>
      )}

      {/* ④ Error banner */}
      {error !== null && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-700">{error}</span>
          <button
            type="button"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="text-sm font-medium text-red-700 hover:text-red-900 underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* ⑤ Desktop table (md+) */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Name</th>
              <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Code</th>
              <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 text-left">City</th>
              <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 text-left">State</th>
              <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Status</th>
              <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Created</th>
              <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Skeleton rows on initial load */}
            {isLoading && !hasFetchedRef.current && <TableSkeletonRows />}

            {/* Empty state */}
            {!isLoading && !error && schools.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="text-center py-12 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No schools found.</p>
                  </div>
                </td>
              </tr>
            )}

            {/* School rows */}
            {!isLoading && schools.map((school) => (
              <tr key={school.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{school.name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono text-xs font-semibold">
                    {school.code}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{school.city || '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{school.state || '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    school.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  )}>
                    {school.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(school.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" aria-label="View details" onClick={() => navigate(`/super-admin/schools/${school.id}`)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label="Edit school" onClick={() => openEditModal(school)} className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {school.is_active ? (
                      <button type="button" aria-label="Deactivate school" onClick={() => openDeactivateModal(school)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <button type="button" aria-label="Reactivate school" onClick={() => openReactivateModal(school)} className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ⑥ Mobile cards (below md) */}
      <div className="md:hidden space-y-3">
        {/* Skeleton cards on initial load */}
        {isLoading && !hasFetchedRef.current && <CardSkeletonList />}

        {/* Empty state */}
        {!isLoading && !error && schools.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No schools found.</p>
          </div>
        )}

        {/* School cards */}
        {!isLoading && schools.map((school) => (
          <div key={school.id} className="bg-white rounded-lg shadow-sm p-4">
            {/* Card top — name, code, status */}
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-semibold text-gray-900 text-sm">{school.name}</span>
                <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono text-xs font-semibold">
                  {school.code}
                </span>
              </div>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                school.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              )}>
                {school.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Card detail row */}
            <div className="flex gap-4 text-xs text-gray-500 mb-3">
              <span>{school.city || '—'}</span>
              <span>{school.state || '—'}</span>
              <span>{new Date(school.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>

            {/* Card actions */}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button type="button" onClick={() => navigate(`/super-admin/schools/${school.id}`)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                <Eye className="w-3 h-3" /> View
              </button>
              <button type="button" onClick={() => openEditModal(school)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-md transition-colors">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              {school.is_active ? (
                <button type="button" onClick={() => openDeactivateModal(school)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors">
                  <XCircle className="w-3 h-3" /> Deactivate
                </button>
              ) : (
                <button type="button" onClick={() => openReactivateModal(school)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors">
                  <CheckCircle className="w-3 h-3" /> Reactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ⑦ Pagination */}
      {pagination !== null && pagination.total_pages > 1 && (
        <div className="flex justify-center items-center gap-1 mt-6">
          {getVisiblePages(currentPage, pagination.total_pages).map((item, index) =>
            item === '...' ? (
              <span key={`ellipsis-${index}`} className="px-3 py-1 text-gray-400 text-sm">...</span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setCurrentPage(item)}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  currentPage === item
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                )}
              >
                {item}
              </button>
            )
          )}
        </div>
      )}

      {/* ⑧ Modal mount points */}
      <AddSchoolModal
        open={modal.type === 'add'}
        onClose={closeModal}
        onSuccess={handleAddSuccess}
      />

      <EditSchoolModal
        open={modal.type === 'edit'}
        onClose={closeModal}
        onSuccess={handleEditSuccess}
        school={modal.school}
      />

      <ConfirmModal
        open={modal.type === 'deactivate' || modal.type === 'reactivate'}
        onClose={closeModal}
        onDeactivateSuccess={handleDeactivateSuccess}
        onReactivateSuccess={handleReactivateSuccess}
        type={modal.type}
        school={modal.school}
      />

    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * AddSchoolModal
 * ────────────────────────────────────────────────────────── */

// Modal form for creating a new school
function AddSchoolModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', code: '', city: '', state: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (!open) return;
    setForm({ name: '', code: '', city: '', state: '', address: '' });
    setCodeError(null);
    setGeneralError(null);
  }, [open]);

  // Updates a single form field by key
  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Validates and submits the create-school request
  async function handleSubmit() {
    if (!form.name.trim()) {
      setGeneralError('School name is required.');
      return;
    }
    if (!form.code.trim()) {
      setGeneralError('School code is required.');
      return;
    }

    setSubmitting(true);
    setCodeError(null);
    setGeneralError(null);

    try {
      await createSchool({
        name: form.name.trim(),
        code: form.code.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        address: form.address.trim() || null,
      });
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('already exists')) {
        setCodeError('This school code already exists — codes must be unique.');
      } else {
        setGeneralError('Failed to create school. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Shared input/textarea classes
  const inputClasses =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed';

  return (
    <Modal open={open} onClose={onClose} title="Add School" disableClose={submitting}>
      <div className="space-y-4">
        {/* School Name */}
        <div>
          <label htmlFor="add-school-name" className="block text-sm font-medium text-gray-700 mb-1">
            School Name
          </label>
          <input
            id="add-school-name"
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* School Code */}
        <div>
          <label htmlFor="add-school-code" className="block text-sm font-medium text-gray-700 mb-1">
            School Code
          </label>
          <input
            id="add-school-code"
            type="text"
            value={form.code}
            onChange={(e) => handleChange('code', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
          {codeError && (
            <p className="mt-1 text-xs text-red-600">{codeError}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Stored uppercase. Cannot be changed after creation.
          </p>
        </div>

        {/* City */}
        <div>
          <label htmlFor="add-school-city" className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            id="add-school-city"
            type="text"
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* State */}
        <div>
          <label htmlFor="add-school-state" className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <input
            id="add-school-state"
            type="text"
            value={form.state}
            onChange={(e) => handleChange('state', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="add-school-address" className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <textarea
            id="add-school-address"
            rows={3}
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* General error banner */}
        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{generalError}</p>
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </span>
            ) : (
              'Add School'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * EditSchoolModal
 * ────────────────────────────────────────────────────────── */

// Modal form for editing an existing school
function EditSchoolModal({ open, onClose, onSuccess, school }) {
  const [form, setForm] = useState({ name: '', city: '', state: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState(null);

  // Pre-populate form when modal opens with the selected school data
  useEffect(() => {
    if (!open || !school) return;
    setForm({
      name: school.name || '',
      city: school.city || '',
      state: school.state || '',
      address: school.address || '',
    });
    setGeneralError(null);
  }, [open, school]);

  // Updates a single form field by key
  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Validates and submits the update-school request
  async function handleSubmit() {
    if (!form.name.trim()) {
      setGeneralError('School name is required.');
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    try {
      // Build payload — only include fields with non-empty trimmed values
      const payload = {
        name: form.name.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        address: form.address.trim() || null,
      };

      const data = await updateSchool(school.id, payload);
      onSuccess(data.school);
    } catch {
      setGeneralError('Failed to update school. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Shared input/textarea classes
  const inputClasses =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed';

  return (
    <Modal open={open} onClose={onClose} title="Edit School" disableClose={submitting}>
      <div className="space-y-4">
        {/* Read-only school code */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">School Code (cannot be changed)</p>
          <span className="font-mono text-sm font-semibold text-gray-700">
            {school?.code}
          </span>
        </div>

        {/* School Name */}
        <div>
          <label htmlFor="edit-school-name" className="block text-sm font-medium text-gray-700 mb-1">
            School Name
          </label>
          <input
            id="edit-school-name"
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* City */}
        <div>
          <label htmlFor="edit-school-city" className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            id="edit-school-city"
            type="text"
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* State */}
        <div>
          <label htmlFor="edit-school-state" className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <input
            id="edit-school-state"
            type="text"
            value={form.state}
            onChange={(e) => handleChange('state', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="edit-school-address" className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <textarea
            id="edit-school-address"
            rows={3}
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* General error banner */}
        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{generalError}</p>
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * ConfirmModal
 * ────────────────────────────────────────────────────────── */

// Confirmation modal for deactivating or reactivating a school
function ConfirmModal({ open, onClose, onDeactivateSuccess, onReactivateSuccess, type, school }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset error state when modal opens
  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  // Determines modal title based on action type
  const title = type === 'deactivate' ? 'Deactivate School' : 'Reactivate School';

  // Executes the deactivate or reactivate API call
  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      if (type === 'deactivate') {
        const data = await deactivateSchool(school.id);
        onDeactivateSuccess(data.schoolId);
      } else {
        const data = await reactivateSchool(school.id);
        onReactivateSuccess(data.school);
      }
    } catch {
      if (type === 'deactivate') {
        setError('Failed to deactivate school. Please try again.');
      } else {
        setError('Failed to reactivate school. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} disableClose={submitting}>
      {/* Body content — varies by action type */}
      {type === 'deactivate' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to deactivate{' '}
            <span className="font-semibold">{school?.name}</span>?
          </p>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              This will deactivate the school and all its associated users
              (drivers, parents, school admin). They will not be able to
              log in until the school is reactivated.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to reactivate{' '}
            <span className="font-semibold">{school?.name}</span>?
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              The school will be reactivated. Note: associated users
              (drivers, parents, school admin) are NOT automatically
              reactivated and must be reactivated individually.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Footer buttons */}
      <div className="flex justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed',
            type === 'deactivate'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          )}
        >
          {submitting ? (
            <span className="flex items-center">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Processing...
            </span>
          ) : type === 'deactivate' ? (
            'Deactivate'
          ) : (
            'Reactivate'
          )}
        </button>
      </div>
    </Modal>
  );
}