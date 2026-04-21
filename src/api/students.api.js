/**
 * students.api.js
 * API functions for student CRUD, deactivate/reactivate, parent linking,
 * and bulk import. All requests flow through the shared Axios instance
 * which auto-attaches the JWT Bearer token.
 * Errors propagate naturally to callers.
 */
import api from './axios';

/* ──────────────────────────────────────────────────────────
 * Student CRUD
 * ────────────────────────────────────────────────────────── */

/** Lists students with pagination, search, class/section/status filters. */
export async function listStudents(params) {
  const response = await api.get('/api/students', { params });
  return response.data.data;
}

/** Fetches a single student with parents and current bus assignment. */
export async function getStudent(studentId) {
  const response = await api.get(`/api/students/${studentId}`);
  return response.data.data;
}

/** Creates a new student. */
export async function createStudent(data) {
  const response = await api.post('/api/students', data);
  return response.data.data;
}

/** Updates an existing student (name, class, section — never roll_no). */
export async function updateStudent(studentId, data) {
  const response = await api.patch(`/api/students/${studentId}`, data);
  return response.data.data;
}

/** Deactivates a student — removes current bus assignment. */
export async function deactivateStudent(studentId) {
  const response = await api.delete(`/api/students/${studentId}/deactivate`);
  return response.data.data;
}

/** Reactivates an inactive student (bus assignment must be reconfigured). */
export async function reactivateStudent(studentId) {
  const response = await api.put(`/api/students/${studentId}/reactivate`);
  return response.data.data;
}

/* ──────────────────────────────────────────────────────────
 * Parent linking
 * ────────────────────────────────────────────────────────── */

/** Links a parent to a student by parent UUID. */
export async function linkParent(studentId, parentId) {
  const response = await api.post(`/api/students/${studentId}/parents`, {
    parent_id: parentId,
  });
  return response.data.data;
}

/** Unlinks a parent from a student. */
export async function unlinkParent(studentId, parentId) {
  const response = await api.delete(
    `/api/students/${studentId}/parents/${parentId}`
  );
  return response.data.data;
}

/* ──────────────────────────────────────────────────────────
 * Bulk import
 * ────────────────────────────────────────────────────────── */

/** Bulk imports students from a JSON array (max 500). */
export async function bulkImportStudents(students) {
  const response = await api.post('/api/students/import', { students });
  return response.data.data;
}
