/**
 * dashboard.api.js
 * API functions for the School Admin live dashboard. All requests flow through
 * the shared Axios instance which auto-attaches the JWT Bearer token via its
 * request interceptor — callers must never attach it manually.
 */
import api from './axios';

/**
 * Fetches the live fleet snapshot for the authenticated school.
 * @returns {Promise<{ buses: Array, total_buses: number }>}
 * @throws Re-throws the Axios error so calling code can handle it.
 */
export async function getLiveFleet() {
  try {
    const response = await api.get('/api/dashboard/live');
    return response.data.data;
  } catch (err) {
    throw err;
  }
}

/**
 * Fetches the aggregated dashboard statistics for the authenticated school.
 * @returns {Promise<{ total_buses: number, buses_with_journey: number, journeys_active: number, journeys_completed: number, arrived_school: number, buses_with_flags: number }>}
 * @throws Re-throws the Axios error so calling code can handle it.
 */
export async function getDashboardStats() {
  try {
    const response = await api.get('/api/dashboard/stats');
    return response.data.data.stats;
  } catch (err) {
    throw err;
  }
}
