/**
 * StudentsPage.jsx
 * Students management page for the School Admin role. Provides a
 * single-page CRUD interface for students, parent linking, and
 * bulk import (CSV / XLSX parsed client-side, sent as JSON).
 *
 * Bus assignment is excluded (Phase 7d-ii).
 * The page title is rendered by Topbar — no page-level h1.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Pencil,
  PowerOff,
  Power,
  Users,
  UserMinus,
  Upload,
  Download,
  X,
  Search,
  GraduationCap,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deactivateStudent,
  reactivateStudent,
  linkParent,
  unlinkParent,
  bulkImportStudents,
} from '../../api/students.api';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */

const PAGE_LIMIT = 20;
const DEBOUNCE_MS = 400;

/* ──────────────────────────────────────────────────────────
 * Utility functions
 * ────────────────────────────────────────────────────────── */

/** Returns a condensed page list with '...' for gaps between non-adjacent ranges. */
function getVisiblePages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
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

/**
 * Parses a single CSV line respecting double-quoted fields.
 * Handles: commas inside quotes, escaped quotes ("").
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        // Toggle quoted mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator — only when not inside quotes
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Push the last field
  result.push(current.trim());
  return result;
}

/* ──────────────────────────────────────────────────────────
 * Reusable Modal shell — Escape close + manual focus trap
 * ────────────────────────────────────────────────────────── */

function Modal({ open, onClose, title, wide, children }) {
  const dialogRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus trap: save previous focus, constrain Tab, restore on close
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;

    // Re-query live focusable elements on each Tab press
    function getFocusable() {
      const candidates = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!candidates) return [];
      // Filter to only visible, enabled, non-hidden elements
      return Array.from(candidates).filter((el) => {
        // Skip disabled form controls
        if (el.disabled) return false;
        // Skip elements hidden via attribute
        if (el.hidden) return false;
        // Skip aria-hidden elements
        if (el.getAttribute('aria-hidden') === 'true') return false;
        // Skip elements with no rendered box (display:none, visibility:hidden,
        // or detached from layout like className="hidden")
        if (!el.offsetParent && el.tagName !== 'BODY') return false;
        return true;
      });
    }

    // Set initial focus on the first focusable element
    const focusable = getFocusable();
    if (focusable?.length) focusable[0].focus();
    else dialogRef.current?.focus();

    function handleTab(e) {
      if (e.key !== 'Tab') return;
      // Re-query every time so step changes don't cause stale references
      const current = getFocusable();
      if (!current?.length) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      // Restore focus to previously focused element on close
      if (previouslyFocused?.focus) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full rounded-xl border border-slate-200 bg-white p-6 shadow-xl',
          wide ? 'max-w-lg' : 'max-w-md'
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
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
 * Student Add/Edit modal
 * ────────────────────────────────────────────────────────── */

function StudentModal({ modal, onClose, onSuccess }) {
  const isEdit = modal.mode === 'edit';
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [section, setSection] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Re-initialise form fields whenever the modal opens or its data changes
  useEffect(() => {
    if (!modal.open) return;
    if (isEdit && modal.student) {
      setName(modal.student.name || '');
      setRollNo(modal.student.roll_no || '');
      setStudentClass(modal.student['class'] || '');
      setSection(modal.student.section || '');
    } else {
      setName('');
      setRollNo('');
      setStudentClass('');
      setSection('');
    }
    setFormError(null);
  }, [isEdit, modal.student, modal.open]);

  /** Validates and submits the student form. */
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) { setFormError('Name is required.'); return; }

    const trimmedClass = studentClass.trim();
    if (!trimmedClass) { setFormError('Class is required.'); return; }

    if (!isEdit) {
      const trimmedRoll = rollNo.trim();
      if (!trimmedRoll) { setFormError('Roll number is required.'); return; }
    }

    setSaving(true);
    try {
      if (isEdit) {
        // Only send changed fields — roll_no is NEVER sent
        const changes = {};
        if (trimmedName !== modal.student.name) changes.name = trimmedName;
        if (trimmedClass !== modal.student['class']) changes['class'] = trimmedClass;
        const trimmedSection = section.trim() || undefined;
        const origSection = modal.student.section || undefined;
        if (trimmedSection !== origSection) {
          changes.section = trimmedSection || null;
        }
        if (Object.keys(changes).length === 0) { onClose(); return; }
        await updateStudent(modal.student.id, changes);
      } else {
        const payload = {
          name: trimmedName,
          roll_no: rollNo.trim(),
          class: trimmedClass,
        };
        const trimmedSection = section.trim();
        if (trimmedSection) payload.section = trimmedSection;
        await createStudent(payload);
      }
      onSuccess(isEdit ? 'edit' : 'add');
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save student');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={modal.open} onClose={onClose} title={isEdit ? 'Edit Student' : 'Add Student'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="student-name" className="mb-1 block text-sm font-medium text-slate-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="student-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            placeholder="e.g. John Smith"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="student-roll" className="mb-1 block text-sm font-medium text-slate-700">
            Roll Number <span className="text-red-500">*</span>
          </label>
          <input
            id="student-roll"
            type="text"
            value={rollNo}
            onChange={(e) => setRollNo(e.target.value)}
            disabled={saving || isEdit}
            placeholder="e.g. 001"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
          {isEdit && (
            <p className="mt-1 text-xs text-slate-400 italic">
              Roll number cannot be changed after creation.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="student-class" className="mb-1 block text-sm font-medium text-slate-700">
              Class <span className="text-red-500">*</span>
            </label>
            <input
              id="student-class"
              type="text"
              value={studentClass}
              onChange={(e) => setStudentClass(e.target.value)}
              disabled={saving}
              placeholder="e.g. 10"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="student-section" className="mb-1 block text-sm font-medium text-slate-700">
              Section
            </label>
            <input
              id="student-section"
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={saving}
              placeholder="e.g. A"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
          </div>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Parent management modal
 * ────────────────────────────────────────────────────────── */

function ParentModal({ modal, onClose }) {
  const [parents, setParents] = useState([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [parentIdInput, setParentIdInput] = useState('');
  const [linkError, setLinkError] = useState(null);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);
  const parentRequestRef = useRef(0);

  // Fetch parents for the current student — wrapped in useCallback
  // for stable reference in useEffect dependency array
  const fetchParents = useCallback(async () => {
    if (!modal.studentId) return;
    // Increment token — only the latest request should commit
    const token = ++parentRequestRef.current;
    // Clear stale parents immediately so old data doesn't show under
    // the new student while loading
    setParents([]);
    setIsLoadingParents(true);
    setLinkError(null);
    try {
      const data = await getStudent(modal.studentId);
      // Only commit if this is still the latest request
      if (token === parentRequestRef.current) {
        setParents(data.student?.parents || []);
      }
    } catch (err) {
      // Only commit if this is still the latest request
      if (token === parentRequestRef.current) {
        // Clear parents on failure — don't leave previous student's
        // parents visible after a failed fetch
        setParents([]);
        setLinkError(err.response?.data?.message || 'Failed to load parents');
      }
    } finally {
      // Only commit if this is still the latest request
      if (token === parentRequestRef.current) {
        setIsLoadingParents(false);
      }
    }
  }, [modal.studentId]);

  // Fetch student detail (with parents) when modal opens
  useEffect(() => {
    if (!modal.open || !modal.studentId) return;
    fetchParents();
    setParentIdInput('');
    setLinkError(null);
  }, [modal.open, modal.studentId, fetchParents]);

  /** Links a parent by UUID. */
  async function handleLink(e) {
    e.preventDefault();
    const trimmed = parentIdInput.trim();
    if (!trimmed) { setLinkError('Parent ID is required.'); return; }
    setLinkError(null);
    setLinking(true);
    try {
      await linkParent(modal.studentId, trimmed);
      setParentIdInput('');
      await fetchParents();
    } catch (err) {
      setLinkError(err.response?.data?.message || 'Failed to link parent');
    } finally {
      setLinking(false);
    }
  }

  /** Unlinks a parent. */
  async function handleUnlink(parentId) {
    setUnlinkingId(parentId);
    try {
      await unlinkParent(modal.studentId, parentId);
      await fetchParents();
    } catch (_) {
      // Silently fail — user can retry
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <Modal open={modal.open} onClose={onClose} title={`Manage Parents — ${modal.studentName}`} wide>
      {/* Current parents list */}
      {isLoadingParents ? (
        <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading parents…
        </div>
      ) : parents.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">No parents linked yet.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {parents.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.phone || '—'}{p.email ? ` · ${p.email}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleUnlink(p.id)}
                disabled={unlinkingId === p.id}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
                aria-label={`Unlink parent ${p.name}`}
              >
                {unlinkingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Link new parent */}
      <form onSubmit={handleLink} className="space-y-2 border-t border-slate-200 pt-4">
        <label htmlFor="parent-id-input" className="block text-sm font-medium text-slate-700">
          Link Parent by ID
        </label>
        <div className="flex gap-2">
          <input
            id="parent-id-input"
            type="text"
            value={parentIdInput}
            onChange={(e) => setParentIdInput(e.target.value)}
            disabled={linking}
            placeholder="Paste parent user ID (UUID)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={linking || !parentIdInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            {linking && <Loader2 className="h-4 w-4 animate-spin" />}
            Link
          </button>
        </div>
        {linkError && <p className="text-xs text-red-600">{linkError}</p>}
        <p className="text-xs text-slate-400">
          Parent must be registered as a Parent role user first.
        </p>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Bulk Import modal — 3-step flow
 * ────────────────────────────────────────────────────────── */

function ImportModal({ modal, onClose, onDone }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!modal.open) return;
    setStep('upload');
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    setImporting(false);
    setImportError(null);
    setImportResult(null);
  }, [modal.open]);

  /** Downloads a CSV template file. */
  function downloadTemplate() {
    const csv = 'name,roll_no,class,section\nJohn Smith,001,10,A\nJane Doe,002,10,B\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Maps header row to column indices (case-insensitive). */
  function mapHeaders(headerRow) {
    const map = {};
    headerRow.forEach((h, i) => {
      const key = String(h).trim().toLowerCase();
      if (key === 'name') map.name = i;
      else if (key === 'roll_no' || key === 'rollno' || key === 'roll no') map.roll_no = i;
      else if (key === 'class') map.class = i;
      else if (key === 'section') map.section = i;
    });
    return map;
  }

  /** Validates that required headers are present. */
  function validateHeaders(headerMap) {
    const missing = [];
    if (headerMap.name === undefined) missing.push('name');
    if (headerMap.roll_no === undefined) missing.push('roll_no');
    if (headerMap.class === undefined) missing.push('class');
    if (missing.length > 0) return `Missing required headers: ${missing.join(', ')}`;
    return null;
  }

  /** Converts raw rows (arrays of strings) to student objects. */
  function rowsToStudents(dataRows, headerMap) {
    return dataRows
      .filter((row) => row.some((cell) => String(cell || '').trim()))
      .map((row) => {
        const obj = {
          name: String(row[headerMap.name] || '').trim(),
          roll_no: String(row[headerMap.roll_no] || '').trim(),
          class: String(row[headerMap.class] || '').trim(),
        };
        if (headerMap.section !== undefined) {
          const sec = String(row[headerMap.section] || '').trim();
          if (sec) obj.section = sec;
        }
        return obj;
      });
  }

  /** Parses the selected file (CSV or XLSX). */
  function parseFile() {
    if (!file) return;
    setParseError(null);

    const reader = new FileReader();
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');

    reader.onload = (e) => {
      try {
        let headerRow;
        let dataRows;

        if (isXlsx) {
          // Parse Excel with SheetJS
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          // raw: false returns formatted cell text — preserves leading zeros
          // e.g. "001" stays "001" instead of becoming 1
          const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
          if (allRows.length < 2) {
            setParseError('File must have a header row and at least one data row.');
            return;
          }
          headerRow = allRows[0];
          dataRows = allRows.slice(1);
        } else {
          // Parse CSV manually
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          if (lines.length < 2) {
            setParseError('File must have a header row and at least one data row.');
            return;
          }
          // Use quoted-field-aware parser — naive split breaks on "Smith, John"
          headerRow = parseCSVLine(lines[0]);
          dataRows = lines.slice(1).map((l) => parseCSVLine(l));
        }

        // Map headers
        const headerMap = mapHeaders(headerRow);
        const headerErr = validateHeaders(headerMap);
        if (headerErr) { setParseError(headerErr); return; }

        // Convert to student objects
        const students = rowsToStudents(dataRows, headerMap);
        if (students.length === 0) {
          setParseError('No data rows found in file.');
          return;
        }
        if (students.length > 500) {
          setParseError('Maximum 500 rows per import. File has ' + students.length + ' rows.');
          return;
        }

        setParsedRows(students);
        setStep('preview');
      } catch (_) {
        setParseError('Failed to parse file. Make sure the format is correct.');
      }
    };

    reader.onerror = () => {
      setParseError('Failed to read file.');
    };

    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  // Validates all parsed rows — returns array of error strings (null for valid)
  function computeRowValidationErrors(rows) {
    return rows.map((row, idx) => {
      const missing = [];
      if (!row.name?.trim()) missing.push('name');
      if (!row.roll_no?.trim()) missing.push('roll number');
      if (!row['class']?.trim()) missing.push('class');
      if (missing.length === 0) return null;
      return `Row ${idx + 1} is missing: ${missing.join(', ')}`;
    });
  }

  /** Sends parsed rows to the bulk import endpoint. */
  async function handleImport() {
    const rowErrors = computeRowValidationErrors(parsedRows);
    const firstError = rowErrors.find((e) => e !== null);
    if (firstError) { setImportError(firstError); return; }
    setImportError(null);
    setImporting(true);
    try {
      const result = await bulkImportStudents(parsedRows);
      setImportResult(result);
      setStep('result');
    } catch (err) {
      setImportError(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  /** Handles file selection from input or drop. */
  function handleFileSelect(f) {
    if (!f) return;
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx')) {
      setParseError('Only .csv and .xlsx files are supported.');
      setFile(null);
      return;
    }
    setParseError(null);
    setFile(f);
  }

  // Native drag-and-drop handlers
  function onDragOver(e) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave() { setIsDragging(false); }
  function onDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }

  const rowErrors = step === 'preview' ? computeRowValidationErrors(parsedRows) : [];
  const hasErrors = rowErrors.some((e) => e !== null);

  return (
    <Modal open={modal.open} onClose={onClose} title="Bulk Import Students" wide>
      {/* ── Step 1: Upload ─────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Download the template, fill in student data, then upload the file.
          </p>

          {/* Template download */}
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Download className="h-3.5 w-3.5" />
            Download Template CSV
          </button>

          {/* Drop zone */}
          {/* Make file drop zone keyboard-accessible */}
          <div
            tabIndex={0}
            role="button"
            aria-label="Upload CSV or Excel file"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors',
              isDragging ? 'border-slate-500 bg-slate-50' : 'border-slate-300 hover:border-slate-400'
            )}
          >
            <Upload className="h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-500">
              {file ? file.name : 'Drag & drop a file here, or click to browse'}
            </p>
            <p className="text-xs text-slate-400">Supports .csv and .xlsx</p>
            {/* Accessible label for hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Student import file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
          </div>

          {parseError && <p className="text-sm text-red-600">{parseError}</p>}

          {file && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={parseFile}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Parse File
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Preview ────────────────────────── */}
      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-700">
            {parsedRows.length} student{parsedRows.length !== 1 ? 's' : ''} ready to import
          </p>

          {hasErrors && (
            <p className="mb-2 text-sm text-red-600">
              {rowErrors.filter(Boolean).length} row(s) have missing required fields. Fix the file and re-upload.
            </p>
          )}

          {/* Preview table (first 10 rows) */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Roll No</th>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Section</th>
                  <th className="px-3 py-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 text-slate-800">{row.name || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.roll_no || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{row.class || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{row.section || '—'}</td>
                    <td className="px-3 py-2 text-xs text-red-600">{rowErrors[i] || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 10 && (
            <p className="text-xs text-slate-400">
              … and {parsedRows.length - 10} more row{parsedRows.length - 10 !== 1 ? 's' : ''}
            </p>
          )}

          {importError && <p className="text-sm text-red-600">{importError}</p>}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => { setStep('upload'); setParsedRows([]); setFile(null); setImportError(null); }}
              disabled={importing}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || hasErrors}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
              ) : (
                `Import ${parsedRows.length} Student${parsedRows.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ─────────────────────────── */}
      {step === 'result' && importResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="text-center py-4">
            <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
            <p className="text-sm text-slate-600">student{importResult.imported !== 1 ? 's' : ''} imported</p>
            {importResult.skipped > 0 && (
              <p className="mt-1 text-sm text-amber-600">
                {importResult.skipped} skipped (duplicates)
              </p>
            )}
          </div>

          {/* Skipped details table */}
          {importResult.skipped_details?.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Roll No</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importResult.skipped_details.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400">{s.row}</td>
                      <td className="px-3 py-2 text-slate-800">{s.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{s.roll_no}</td>
                      <td className="px-3 py-2 text-amber-600">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setStep('upload'); setFile(null); setParsedRows([]); setImportResult(null); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              Import More
            </button>
            <button
              type="button"
              onClick={() => { onDone(); onClose(); }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Confirm modal (deactivate / reactivate)
 * ────────────────────────────────────────────────────────── */

function ConfirmModal({ modal, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Reset on open/close
  useEffect(() => {
    setConfirming(false);
    setConfirmError(null);
  }, [modal.open]);

  /** Executes the confirmed action. */
  async function handleConfirm() {
    setConfirming(true);
    setConfirmError(null);
    try {
      await onConfirm(modal.action, modal.studentId);
      onClose();
    } catch (err) {
      setConfirmError(err.response?.data?.message || 'Action failed');
    } finally {
      setConfirming(false);
    }
  }

  const titles = {
    deactivate: 'Confirm Deactivate',
    reactivate: 'Confirm Reactivate',
  };

  return (
    <Modal open={modal.open} onClose={onClose} title={titles[modal.action] || 'Confirm'}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{modal.label}</p>
        {confirmError && <p className="text-sm text-red-600">{confirmError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={confirming} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={confirming} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50">
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Main page component
 * ────────────────────────────────────────────────────────── */

export default function StudentsPage() {
  // ── Core list state ──────────────────────────────────
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // True during background refetches (after mutations) — not initial load
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [apiSearch, setApiSearch] = useState('');
  // Display value for class filter input (immediate)
  const [classInputValue, setClassInputValue] = useState('');
  // Debounced value used in fetch
  const [classFilter, setClassFilter] = useState('');
  // Display value for section filter input (immediate)
  const [sectionInputValue, setSectionInputValue] = useState('');
  // Debounced value used in fetch
  const [sectionFilter, setSectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Modal state ──────────────────────────────────────
  const [studentModal, setStudentModal] = useState({ open: false, mode: 'add', student: null });
  const [parentModal, setParentModal] = useState({ open: false, studentId: null, studentName: '' });
  const [importModal, setImportModal] = useState({ open: false });
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, studentId: null, studentName: '', label: '' });

  // ── Refs ─────────────────────────────────────────────
  const hasFetchedRef = useRef(false);
  const debounceRef = useRef(null);
  const classDebounceRef = useRef(null);
  const sectionDebounceRef = useRef(null);
  const tableTopRef = useRef(null);

  // Cancel all pending debounce timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (classDebounceRef.current) clearTimeout(classDebounceRef.current);
      if (sectionDebounceRef.current) clearTimeout(sectionDebounceRef.current);
    };
  }, []);

  // ── Table column count for colSpan ───────────────────
  const COL_COUNT = 7;

  /* ────────────────────────────────────────────────────────
   * Data fetching — useEffect as single fetch source
   * ──────────────────────────────────────────────────────── */

  /** Fetches the student list for the current filters. */
  const fetchStudents = useCallback(async (page, search, classF, sectionF, status) => {
    // Create AbortController first — before any await — so cleanup
    // can always call abort() regardless of how far the function ran
    const controller = new AbortController();

    if (!hasFetchedRef.current) {
      setIsLoading(true);
    } else {
      // Show refetch indicator for subsequent fetches
      setIsRefetching(true);
    }
    setError(null);

    try {
      const params = { page, limit: PAGE_LIMIT, status };
      if (search) params.search = search;
      if (classF) params['class'] = classF;
      if (sectionF) params.section = sectionF;
      const data = await listStudents(params, controller.signal);
      // Only commit if not aborted
      if (!controller.signal.aborted) {
        const totalPages = data.pagination?.total_pages || 1;
        // Clamp currentPage if server now has fewer pages than we're on
        if (currentPage > totalPages) {
          setCurrentPage(totalPages);
        }
        setStudents(data.students || []);
        setPagination(data.pagination || null);
        hasFetchedRef.current = true;
      }
    } catch (err) {
      // Ignore abort errors — request was superseded
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.message || 'Failed to load students');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }

    return controller;
  }, [currentPage]);

  // Single useEffect as fetch source — reacts to state changes
  useEffect(() => {
    // Abort any in-flight fetch when deps change
    let controller;
    const run = async () => {
      controller = await fetchStudents(currentPage, apiSearch, classFilter, sectionFilter, statusFilter);
    };
    run();
    return () => controller?.abort();
  }, [currentPage, apiSearch, classFilter, sectionFilter, statusFilter, fetchStudents]);

  /** Debounced search handler — updates inputValue immediately, apiSearch after delay. */
  function handleSearchChange(value) {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      setApiSearch(value);
    }, DEBOUNCE_MS);
  }

  /** Status filter change — cancel pending debounce, reset page. */
  function handleStatusFilter(status) {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    setStatusFilter(status);
    setCurrentPage(1);
  }

  // Debounced class filter — updates display immediately, fetch after delay
  function handleClassFilter(value) {
    setClassInputValue(value);
    if (classDebounceRef.current) clearTimeout(classDebounceRef.current);
    classDebounceRef.current = setTimeout(() => {
      setClassFilter(value);
      setCurrentPage(1);
      classDebounceRef.current = null;
    }, DEBOUNCE_MS);
  }

  // Debounced section filter — updates display immediately, fetch after delay
  function handleSectionFilter(value) {
    setSectionInputValue(value);
    if (sectionDebounceRef.current) clearTimeout(sectionDebounceRef.current);
    sectionDebounceRef.current = setTimeout(() => {
      setSectionFilter(value);
      setCurrentPage(1);
      sectionDebounceRef.current = null;
    }, DEBOUNCE_MS);
  }

  /** Refetch current page (for post-mutation refreshes). */
  function refetch() {
    fetchStudents(currentPage, apiSearch, classFilter, sectionFilter, statusFilter);
  }

  /** Pagination page change. */
  function goToPage(page) {
    setCurrentPage(page);
    tableTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  /* ────────────────────────────────────────────────────────
   * Modal openers
   * ──────────────────────────────────────────────────────── */

  function openAddStudent() {
    setStudentModal({ open: true, mode: 'add', student: null });
  }

  function openEditStudent(student) {
    setStudentModal({ open: true, mode: 'edit', student });
  }

  function openParentModal(student) {
    setParentModal({ open: true, studentId: student.id, studentName: student.name });
  }

  function openImportModal() {
    setImportModal({ open: true });
  }

  function openDeactivate(student) {
    setConfirmModal({
      open: true,
      action: 'deactivate',
      studentId: student.id,
      studentName: student.name,
      label: `Deactivating ${student.name} will remove their current bus assignment. This cannot be undone automatically.`,
    });
  }

  function openReactivate(student) {
    setConfirmModal({
      open: true,
      action: 'reactivate',
      studentId: student.id,
      studentName: student.name,
      label: `This will reactivate ${student.name} only. Bus assignment must be reconfigured manually.`,
    });
  }

  /* ────────────────────────────────────────────────────────
   * Action handlers
   * ──────────────────────────────────────────────────────── */

  /** Handles student modal success. */
  function onStudentSuccess(mode) {
    if (mode === 'add') {
      // Avoid duplicate fetch — if already on page 1 fetch directly,
      // otherwise setCurrentPage triggers the effect
      if (currentPage === 1) {
        fetchStudents(1, apiSearch, classFilter, sectionFilter, statusFilter);
      } else {
        setCurrentPage(1);
      }
    } else {
      refetch();
    }
  }

  /** Handles confirm modal action. */
  async function handleConfirmAction(action, studentId) {
    if (action === 'deactivate') {
      await deactivateStudent(studentId);
      refetch();
    } else if (action === 'reactivate') {
      await reactivateStudent(studentId);
      refetch();
    }
  }

  /* ────────────────────────────────────────────────────────
   * Render
   * ──────────────────────────────────────────────────────── */

  const filterBtns = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6" ref={tableTopRef}>
      {/* ── Header row ─────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-xl font-semibold text-slate-800">Students</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openImportModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </button>
          <button
            type="button"
            onClick={openAddStudent}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Plus className="h-4 w-4" />
            Add Student
          </button>
        </div>
      </div>

      {isRefetching && (
        // Subtle refetch indicator — shown during background reloads
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* ── Search + filter row ────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search name or roll number..."
            aria-label="Search students by name or roll number"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          {inputValue && (
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

        {/* Class filter */}
        <input
          type="text"
          value={classInputValue}
          onChange={(e) => handleClassFilter(e.target.value)}
          placeholder="Class"
          aria-label="Filter by class"
          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        {/* Section filter */}
        <input
          type="text"
          value={sectionInputValue}
          onChange={(e) => handleSectionFilter(e.target.value)}
          placeholder="Section"
          aria-label="Filter by section"
          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        {/* Status filter buttons */}
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
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

      {/* ── Students table ─────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Roll No</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium">Bus</th>
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
            {!isLoading && !error && students.length === 0 && (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <GraduationCap className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No students found</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Student rows */}
            {!isLoading &&
              students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50">
                  {/* Name */}
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {student.name}
                  </td>

                  {/* Roll No */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {student.roll_no}
                  </td>

                  {/* Class */}
                  <td className="px-4 py-3 text-slate-600">
                    {student['class']}
                  </td>

                  {/* Section */}
                  <td className="px-4 py-3 text-slate-600">
                    {student.section || <span className="text-slate-400">—</span>}
                  </td>

                  {/* Bus */}
                  <td className="px-4 py-3 text-slate-600">
                    {student.bus_number || <span className="text-slate-400">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        student.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {student.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => openEditStudent(student)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        aria-label={`Edit ${student.name}`}
                        title="Edit student"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {/* Parents */}
                      <button
                        type="button"
                        onClick={() => openParentModal(student)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        aria-label={`Manage parents for ${student.name}`}
                        title="Manage parents"
                      >
                        <Users className="h-4 w-4" />
                      </button>

                      {/* Deactivate / Reactivate */}
                      {student.is_active ? (
                        <button
                          type="button"
                          onClick={() => openDeactivate(student)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                          aria-label={`Deactivate ${student.name}`}
                          title="Deactivate student"
                        >
                          <PowerOff className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openReactivate(student)}
                          className="rounded p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-300"
                          aria-label={`Reactivate ${student.name}`}
                          title="Reactivate student"
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

      {/* ── Pagination ─────────────────────────────────── */}
      {pagination && pagination.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {getVisiblePages(currentPage, pagination.total_pages).map((item, idx) =>
            item === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-slate-400 select-none">
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
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────── */}
      <StudentModal
        modal={studentModal}
        onClose={() => setStudentModal((m) => ({ ...m, open: false }))}
        onSuccess={onStudentSuccess}
      />

      <ParentModal
        modal={parentModal}
        onClose={() => setParentModal((m) => ({ ...m, open: false }))}
      />

      <ImportModal
        modal={importModal}
        onClose={() => setImportModal({ open: false })}
        onDone={refetch}
      />

      <ConfirmModal
        modal={confirmModal}
        onClose={() => setConfirmModal((m) => ({ ...m, open: false }))}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
