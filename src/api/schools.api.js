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
  const response = await api.patch(`/api/schools/${schoolId}`, data);
  return response.data.data;
}

// Deactivates a school and all its associated users
export async function deactivateSchool(schoolId) {
  const response = await api.delete(`/api/schools/${schoolId}/deactivate`);
  return response.data.data;
}

// Reactivates an inactive school (users are NOT automatically reactivated)
export async function reactivateSchool(schoolId) {
  const response = await api.put(`/api/schools/${schoolId}/reactivate`);
  return response.data.data;
}
