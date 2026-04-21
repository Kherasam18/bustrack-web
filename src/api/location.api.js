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
export async function getJourneyLocationLog(journeyId) {
  const response = await api.get(`/api/location/journey/${journeyId}`);
  return response.data.data;
}
