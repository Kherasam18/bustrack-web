/**
 * SchoolDetailPage.jsx
 * Super Admin school detail page.
 * Shows: school info, stats, school admin management.
 * Route: /super-admin/schools/:id
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Users, Bus, GraduationCap,
  UserCheck, Plus, KeyRound, XCircle, CheckCircle,
  Loader2, X, Shield,
} from 'lucide-react';
import {
  getSchool, getSchoolAdmin,
  createSchoolAdmin, resetSchoolAdminPassword,
  deactivateSchoolAdmin, reactivateSchoolAdmin,
} from '../../api/schools.api';
import { cn } from '../../lib/utils';

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
 * SchoolDetailPage component
 * ────────────────────────────────────────────────────────── */

// Super Admin school detail page — school info, stats, admin management
export default function SchoolDetailPage() {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();

  // School data
  const [school, setSchool] = useState(null);

  // School admin data — null means not yet fetched, { admin: null }
  // means fetched and confirmed no admin exists
  const [adminData, setAdminData] = useState(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  // type: 'add-admin' | 'reset-password' | 'deactivate-admin'
  //       | 'reactivate-admin' | null
  const [modal, setModal] = useState({ type: null });

  // isFetchingRef: prevents overlapping fetches
  const isFetchingRef = useRef(false);

  /* ── Data fetching ── */

  // Fetches school detail and admin data in parallel on mount
  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      // Guard against overlapping fetches
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch school and admin in parallel
        const [schoolResult, adminResult] = await Promise.all([
          getSchool(schoolId),
          getSchoolAdmin(schoolId),
        ]);

        setSchool(schoolResult.school);
        setAdminData(adminResult);
      } catch (err) {
        // Silent abort — do not set error state
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        setError('Failed to load school details. Please try again.');
      } finally {
        if (controller.signal.aborted) return;
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    }

    fetchData();

    return () => {
      controller.abort();
      isFetchingRef.current = false;
    };
  }, [schoolId]);

  /* ── Modal handlers ── */

  // Closes any open modal
  function closeModal() {
    setModal({ type: null });
  }

  // Opens the Add Admin modal
  function openAddAdminModal() {
    setModal({ type: 'add-admin' });
  }

  // Opens the Reset Password modal for the current admin
  function openResetPasswordModal() {
    setModal({ type: 'reset-password' });
  }

  // Opens the deactivate confirmation for the current admin
  function openDeactivateAdminModal() {
    setModal({ type: 'deactivate-admin' });
  }

  // Opens the reactivate confirmation for the current admin
  function openReactivateAdminModal() {
    setModal({ type: 'reactivate-admin' });
  }

  // Called by AddAdminModal on success — update adminData in place
  function handleAdminCreated(newAdmin) {
    closeModal();
    setAdminData({ admin: newAdmin });
  }

  // Called by ResetPasswordModal on success — just close modal
  function handlePasswordReset() {
    closeModal();
  }

  // Called by ConfirmAdminModal on deactivate success
  // Flips is_active to false on the current admin object
  function handleAdminDeactivated() {
    closeModal();
    setAdminData((prev) => ({
      ...prev,
      admin: { ...prev.admin, is_active: false },
    }));
  }

  // Called by ConfirmAdminModal on reactivate success
  // updatedAdmin is the full admin object returned from reactivateSchoolAdmin
  function handleAdminReactivated(updatedAdmin) {
    closeModal();
    setAdminData({ admin: updatedAdmin });
  }

  // Derive admin for cleaner JSX
  const admin = adminData?.admin ?? null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">

      {/* ① Loading skeleton */}
      {isLoading && (
        <div className="animate-pulse space-y-6">
          {/* Back button skeleton */}
          <div className="h-4 w-32 bg-gray-200 rounded" />

          {/* School header card skeleton */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-3">
                <div className="h-7 w-64 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-48 bg-gray-200 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded-full" />
            </div>
          </div>

          {/* Stats row skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-4">
                <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
                <div className="h-8 w-12 bg-gray-200 rounded" />
              </div>
            ))}
          </div>

          {/* Admin section skeleton */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
            <div className="h-16 w-full bg-gray-200 rounded" />
          </div>
        </div>
      )}

      {/* ② Error state */}
      {!isLoading && error !== null && (
        <>
          {/* Back button — always shown */}
          <button
            type="button"
            onClick={() => navigate('/super-admin/schools')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schools
          </button>

          <div className="mt-6 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-red-700 text-sm mb-3">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-red-700 underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        </>
      )}

      {/* ③–⑦ Main content — only when loaded successfully */}
      {!isLoading && !error && school && (
        <>
          {/* ③ Back button */}
          <button
            type="button"
            onClick={() => navigate('/super-admin/schools')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schools
          </button>

          {/* ④ School info card */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-start">
              {/* Left — school details */}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {school.name}
                </h1>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono text-xs font-semibold">
                  {school.code}
                </span>

                {/* Location line */}
                <p className="text-sm text-gray-500 mt-2">
                  {school.city && school.state
                    ? `${school.city}, ${school.state}`
                    : school.city || school.state || '—'}
                </p>

                {/* Address line — omit if empty */}
                {school.address && (
                  <p className="text-sm text-gray-400 mt-1">{school.address}</p>
                )}

                {/* Created date */}
                <p className="text-xs text-gray-400 mt-2">
                  Added{' '}
                  {new Date(school.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {/* Right — status pill */}
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  school.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                )}
              >
                {school.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* ⑤ Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Buses */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Bus className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Total Buses</p>
              <p className="text-2xl font-bold text-gray-900">{school.stats.totalBuses}</p>
            </div>

            {/* Students */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Students</p>
              <p className="text-2xl font-bold text-gray-900">{school.stats.totalStudents}</p>
            </div>

            {/* Drivers */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Drivers</p>
              <p className="text-2xl font-bold text-gray-900">{school.stats.totalDrivers}</p>
            </div>

            {/* Parents */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Parents</p>
              <p className="text-2xl font-bold text-gray-900">{school.stats.totalParents}</p>
            </div>
          </div>

          {/* ⑥ School Admin section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Section header row */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-500" />
                School Admin
              </h2>

              {/* Action buttons — vary by admin state */}
              {adminData !== null && adminData.admin === null && (
                <button
                  type="button"
                  onClick={openAddAdminModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Admin
                </button>
              )}

              {admin && (
                <div className="flex gap-2 flex-wrap">
                  {/* Reset Password */}
                  <button
                    type="button"
                    onClick={openResetPasswordModal}
                    className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                    Reset Password
                  </button>

                  {/* Deactivate or Reactivate */}
                  {admin.is_active ? (
                    <button
                      type="button"
                      onClick={openDeactivateAdminModal}
                      className="border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openReactivateAdminModal}
                      className="border border-green-200 text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Reactivate
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Admin body — Case A: still loading (defensive guard) */}
            {adminData === null && (
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            )}

            {/* Admin body — Case B: no admin exists */}
            {adminData !== null && adminData.admin === null && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Shield className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm font-medium">No admin assigned</p>
                <p className="text-gray-400 text-xs mt-1">
                  This school has no School Admin account yet.
                  Add one to allow school-level login.
                </p>
              </div>
            )}

            {/* Admin body — Case C: admin exists */}
            {admin && (
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                {/* Avatar circle */}
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-semibold text-lg">
                    {admin.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info block */}
                <div>
                  <p className="font-medium text-gray-900">{admin.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{admin.email}</p>
                  {admin.phone && (
                    <p className="text-sm text-gray-500 mt-0.5">{admin.phone}</p>
                  )}

                  {/* Status pill */}
                  <span
                    className={cn(
                      'inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-2',
                      admin.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {admin.is_active ? 'Active' : 'Inactive'}
                  </span>

                  {/* Created date */}
                  <p className="mt-1 text-xs text-gray-400">
                    Added{' '}
                    {new Date(admin.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ⑦ Modal mount points */}
          <AddAdminModal
            open={modal.type === 'add-admin'}
            onClose={closeModal}
            onSuccess={handleAdminCreated}
            schoolId={school?.id}
          />

          <ResetPasswordModal
            open={modal.type === 'reset-password'}
            onClose={closeModal}
            onSuccess={handlePasswordReset}
            schoolId={school?.id}
            admin={adminData?.admin}
          />

          <ConfirmAdminModal
            open={modal.type === 'deactivate-admin' || modal.type === 'reactivate-admin'}
            onClose={closeModal}
            onDeactivateSuccess={handleAdminDeactivated}
            onReactivateSuccess={handleAdminReactivated}
            type={modal.type}
            schoolId={school?.id}
            admin={adminData?.admin}
          />
        </>
      )}

    </div>
  );
}
/* ──────────────────────────────────────────────────────────
 * AddAdminModal
 * ────────────────────────────────────────────────────────── */

// Modal form for creating a School Admin account
function AddAdminModal({ open, onClose, onSuccess, schoolId }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (!open) return;
    setForm({ name: '', email: '', phone: '', password: '' });
    setGeneralError(null);
  }, [open]);

  // Updates a single form field by key
  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Validates and submits the create-admin request
  async function handleSubmit() {
    if (!form.name.trim()) {
      setGeneralError('Name is required.');
      return;
    }
    if (!form.email.trim()) {
      setGeneralError('Email is required.');
      return;
    }
    if (!/^\d{10}$/.test(form.phone.trim())) {
      setGeneralError('Phone number must be exactly 10 digits');
      return;
    }
    if (form.password.trim().length < 8) {
      setGeneralError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    try {
      const data = await createSchoolAdmin(schoolId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      onSuccess(data.admin);
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('already exists')) {
        setGeneralError('A School Admin already exists for this school.');
      } else {
        setGeneralError('Failed to create admin. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Shared input classes
  const inputClasses =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed';

  return (
    <Modal open={open} onClose={onClose} title="Add School Admin" disableClose={submitting}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Name */}
        <div>
          <label htmlFor="add-admin-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="add-admin-name"
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="add-admin-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="add-admin-email"
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="admin-phone"
                 className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            id="admin-phone"
            type="tel"
            value={form.phone}
            onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="10-digit phone number"
            maxLength={10}
            disabled={submitting}
            className={inputClasses}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="add-admin-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="add-admin-password"
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-gray-500">Minimum 8 characters.</p>
        </div>

        {/* General error banner */}
        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{generalError}</p>
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
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {submitting ? 'Creating...' : 'Create Admin'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * ResetPasswordModal
 * ────────────────────────────────────────────────────────── */

// Modal form for resetting a School Admin's password
function ResetPasswordModal({ open, onClose, onSuccess, schoolId, admin }) {
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (!open) return;
    setNewPassword('');
    setGeneralError(null);
  }, [open]);

  // Validates and submits the password reset request
  async function handleSubmit() {
    if (newPassword.length < 8) {
      setGeneralError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    try {
      await resetSchoolAdminPassword(schoolId, admin.id, {
        new_password: newPassword,
      });
      onSuccess();
    } catch (err) {
      setGeneralError('Failed to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Shared input classes
  const inputClasses =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed';

  return (
    <Modal open={open} onClose={onClose} title="Reset Admin Password" disableClose={submitting}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Admin info summary */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-0.5">Resetting password for</p>
          <p className="text-sm font-medium text-gray-800">{admin?.name}</p>
          <p className="text-xs text-gray-500">{admin?.email}</p>
        </div>

        {/* New Password */}
        <div>
          <label htmlFor="reset-admin-password" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="reset-admin-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-gray-500">Minimum 8 characters.</p>
        </div>

        {/* General error banner */}
        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{generalError}</p>
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
            type="submit"
            disabled={submitting}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * ConfirmAdminModal
 * ────────────────────────────────────────────────────────── */

// Confirmation modal for deactivating or reactivating a School Admin
function ConfirmAdminModal({
  open, onClose, onDeactivateSuccess, onReactivateSuccess,
  type, schoolId, admin,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset error state when modal opens
  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  // Submits the deactivate or reactivate action
  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      if (type === 'deactivate-admin') {
        await deactivateSchoolAdmin(schoolId, admin.id);
        onDeactivateSuccess();
      } else if (type === 'reactivate-admin') {
        const data = await reactivateSchoolAdmin(schoolId, admin.id);
        onReactivateSuccess(data.admin);
      }
    } catch (err) {
      if (type === 'deactivate-admin') {
        setError('Failed to deactivate admin. Please try again.');
      } else {
        setError('Failed to reactivate admin. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Derive modal title from type
  const title = type === 'deactivate-admin'
    ? 'Deactivate School Admin'
    : 'Reactivate School Admin';

  return (
    <Modal open={open} onClose={onClose} title={title} disableClose={submitting}>
      <div className="space-y-3">
        {/* Deactivate confirmation body */}
        {type === 'deactivate-admin' && (
          <>
            <p className="text-sm text-gray-700">
              Are you sure you want to deactivate{' '}
              <span className="font-semibold">{admin?.name}</span>?
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                This School Admin will no longer be able to log in to
                BusTrack until their account is reactivated.
              </p>
            </div>
          </>
        )}

        {/* Reactivate confirmation body */}
        {type === 'reactivate-admin' && (
          <>
            <p className="text-sm text-gray-700">
              Are you sure you want to reactivate{' '}
              <span className="font-semibold">{admin?.name}</span>?
            </p>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                This School Admin will be able to log in to BusTrack again.
              </p>
            </div>
          </>
        )}
      </div>

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
            'px-4 py-2 rounded-lg text-sm font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed',
            type === 'deactivate-admin'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          )}
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {submitting
            ? 'Processing...'
            : type === 'deactivate-admin'
              ? 'Deactivate'
              : 'Reactivate'}
        </button>
      </div>
    </Modal>
  );
}
