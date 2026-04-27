/**
 * notifications.api.js
 * API functions for the Notifications module.
 * School Admin: view today's school notifications with optional
 * journey_id filter.
 */
import api from './axios';

/** Fetches all notifications sent today for the school. */
export async function getSchoolNotificationsToday(journeyId, signal) {
  const params = {};
  if (journeyId) params.journey_id = journeyId;
  const response = await api.get('/api/notifications/school/today', {
    params,
    ...(signal ? { signal } : {}),
  });
  return response.data.data;
}
