/**
 * buses.api.js
 * API functions for bus CRUD, route management, and stop management.
 * All requests flow through the shared Axios instance which auto-attaches
 * the JWT Bearer token. Errors propagate naturally to callers.
 */
import api from './axios';

/* ──────────────────────────────────────────────────────────
 * Bus CRUD
 * ────────────────────────────────────────────────────────── */

/** Lists buses with pagination, search, and status filter. */
export async function listBuses(params) {
  const response = await api.get('/api/buses', { params });
  return response.data.data;
}

/** Creates a new bus. */
export async function createBus(data) {
  const response = await api.post('/api/buses', data);
  return response.data.data;
}

/** Updates an existing bus (bus_number, capacity). */
export async function updateBus(busId, data) {
  const response = await api.patch(`/api/buses/${busId}`, data);
  return response.data.data;
}

/** Deactivates a bus — clears student assignments and deactivates route. */
export async function deactivateBus(busId) {
  const response = await api.delete(`/api/buses/${busId}/deactivate`);
  return response.data.data;
}

/** Reactivates an inactive bus (route + students must be reconfigured). */
export async function reactivateBus(busId) {
  const response = await api.put(`/api/buses/${busId}/reactivate`);
  return response.data.data;
}

/* ──────────────────────────────────────────────────────────
 * Route management
 * ────────────────────────────────────────────────────────── */

/** Fetches the active route (with stops) for a bus. 404 if none. */
export async function getRoute(busId) {
  const response = await api.get(`/api/buses/${busId}/route`);
  return response.data.data;
}

/** Creates a new route for a bus. */
export async function createRoute(busId, data) {
  const response = await api.post(`/api/buses/${busId}/route`, data);
  return response.data.data;
}

/** Updates the active route for a bus. */
export async function updateRoute(busId, data) {
  const response = await api.patch(`/api/buses/${busId}/route`, data);
  return response.data.data;
}

/* ──────────────────────────────────────────────────────────
 * Stop management
 * ────────────────────────────────────────────────────────── */

/** Adds a new stop to the bus's active route. */
export async function addStop(busId, data) {
  const response = await api.post(`/api/buses/${busId}/route/stops`, data);
  return response.data.data;
}

/** Updates an existing stop on the bus's active route. */
export async function updateStop(busId, stopId, data) {
  const response = await api.patch(`/api/buses/${busId}/route/stops/${stopId}`, data);
  return response.data.data;
}

/** Deletes a stop from the bus's active route. */
export async function deleteStop(busId, stopId) {
  const response = await api.delete(`/api/buses/${busId}/route/stops/${stopId}`);
  return response.data.data;
}

/** Reorders all stops on the bus's active route. */
export async function reorderStops(busId, stops) {
  const response = await api.put(`/api/buses/${busId}/route/stops/reorder`, { stops });
  return response.data.data;
}
