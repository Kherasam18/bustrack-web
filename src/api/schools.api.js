/**
 * schools.api.js
 * API functions for school CRUD, deactivate, and reactivate operations.
 * Used by the Super Admin Schools management page.
 * All requests flow through the shared Axios instance which auto-attaches
 * the JWT Bearer token. Errors propagate naturally to callers.
 */
import api from './axios';

// Lists schools with pagination, search, and status filter
export async function listSchools(params, signal) {
  const response = await api.get('/api/schools', {
    params,
    ...(signal ? { signal } : {}),
  });
  return response.data.data;
}

// Creates a new school
export async function createSchool(data) {
  const response = await api.post('/api/schools', data);
  return response.data.data;
}

// Updates an existing school (name, address, city, state — never code)
export async function updateSchool(schoolId, data) {
  if (!schoolId) throw new Error('schoolId is required');
  const response = await api.patch(`/api/schools/${schoolId}`, data);
  return response.data.data;
}

// Deactivates a school and all its associated users
export async function deactivateSchool(schoolId) {
  if (!schoolId) throw new Error('schoolId is required');
  const response = await api.delete(`/api/schools/${schoolId}/deactivate`);
  return response.data.data;
}

// Reactivates an inactive school (users are NOT automatically reactivated)
export async function reactivateSchool(schoolId) {
  if (!schoolId) throw new Error('schoolId is required');
  const response = await api.put(`/api/schools/${schoolId}/reactivate`);
  return response.data.data;
}

// Fetches a single school with full detail and stats
export async function getSchool(schoolId, signal) {
  if (!schoolId) throw new Error('schoolId is required');
  const response = await api.get(`/api/schools/${schoolId}`, { signal });
  return response.data.data;
}

// Fetches the School Admin for a school (returns { admin: null } if none)
export async function getSchoolAdmin(schoolId, signal) {
  if (!schoolId) throw new Error('schoolId is required');
  const response = await api.get(`/api/schools/${schoolId}/admin`, { signal });
  return response.data.data;
}

// Creates a School Admin for a school
export async function createSchoolAdmin(schoolId, { name, email, phone, password }) {
  if (!schoolId) throw new Error('schoolId is required');
  const response = await api.post(`/api/schools/${schoolId}/admin`, {
    name,
    email,
    phone,
    password,
  });
  return response.data.data;
}

// Resets School Admin password — Super Admin sets specific password
export async function resetSchoolAdminPassword(schoolId, userId, { new_password }) {
  if (!schoolId) throw new Error('schoolId is required');
  if (!userId) throw new Error('userId is required');
  const response = await api.post(`/api/schools/${schoolId}/admin/${userId}/reset-password`, { new_password });
  return response.data.data;
}

// Deactivates a School Admin
export async function deactivateSchoolAdmin(schoolId, userId) {
  if (!schoolId) throw new Error('schoolId is required');
  if (!userId) throw new Error('userId is required');
  const response = await api.delete(`/api/schools/${schoolId}/admin/${userId}/deactivate`);
  return response.data.data;
}

// Reactivates a School Admin
export async function reactivateSchoolAdmin(schoolId, userId) {
  if (!schoolId) throw new Error('schoolId is required');
  if (!userId) throw new Error('userId is required');
  const response = await api.put(`/api/schools/${schoolId}/admin/${userId}/reactivate`);
  return response.data.data;
}
