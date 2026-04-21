/**
 * location.api.js
 * API functions for fetching GPS location data. All requests flow through the
 * shared Axios instance which auto-attaches the JWT Bearer token.
 */
import api from './axios';

/**
 * Fetches the GPS location log for a specific journey.
 * @param {string} journeyId — UUID of the journey to fetch points for
 * @returns {Promise<{ journey_id: string, total: number, points: Array }>}
 */
export async function getJourneyLocationLog(journeyId, signal) {
  // Fail fast with a clear error rather than hitting the server
  // with a malformed URL like /api/location/journey/undefined
  if (!journeyId) {
    throw new Error('journeyId is required');
  }
  const response = await api.get(
    `/api/location/journey/${journeyId}`,
    { signal }
  );
  return response.data.data;
}
