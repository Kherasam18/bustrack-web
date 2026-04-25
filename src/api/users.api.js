/**
 * users.api.js
 * API functions for driver user management (Phase 7f-i).
 * Parent user functions will be added in Phase 7f-ii.
 * All requests flow through the shared Axios instance which
 * auto-attaches the JWT Bearer token.
 * Errors propagate naturally to callers — no try/catch here.
 */
import api from './axios';

/* ──────────────────────────────────────────────────────────
 * Driver CRUD
 * ────────────────────────────────────────────────────────── */

/** Lists drivers with pagination, search, and status filters. */
export async function listDrivers(params, signal) {
  const response = await api.get('/api/users/drivers', {
    params,
    ...(signal ? { signal } : {}),
  });
  return response.data.data;
}

/** Creates a new driver account. */
export async function createDriver(data) {
  const response = await api.post('/api/users/drivers', data);
  return response.data.data;
}

/** Updates an existing driver (name, phone, email — never employee_id). */
export async function updateDriver(userId, data) {
  const response = await api.patch(`/api/users/drivers/${userId}`, data);
  return response.data.data;
}

/* ──────────────────────────────────────────────────────────
 * Driver status management
 * ────────────────────────────────────────────────────────── */

/** Deactivates a driver — prevents login to the driver app. */
export async function deactivateDriver(userId) {
  const response = await api.delete(`/api/users/drivers/${userId}/deactivate`);
  return response.data.data;
}

/** Reactivates an inactive driver — restores login access. */
export async function reactivateDriver(userId) {
  const response = await api.put(`/api/users/drivers/${userId}/reactivate`);
  return response.data.data;
}

/* ──────────────────────────────────────────────────────────
 * Driver password management
 * ────────────────────────────────────────────────────────── */

/** Resets a driver's password (admin sets a specific password). */
export async function resetDriverPassword(userId, newPassword) {
  const response = await api.post(
    `/api/users/drivers/${userId}/reset-password`,
    { new_password: newPassword }
  );
  return response.data.data;
}
