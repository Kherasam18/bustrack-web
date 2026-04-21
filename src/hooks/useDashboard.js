/**
 * useDashboard.js
 * Custom hook that fetches live fleet data and dashboard stats in parallel,
 * polls every 30 seconds, and exposes loading / error / refetch state for
 * the DashboardPage.
 *
 * isLoading is true only during the very first fetch — subsequent background
 * polls update the data silently without re-triggering the loading skeleton.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getLiveFleet, getDashboardStats } from '../api/dashboard.api';

/** Polling interval in milliseconds (30 s) */
const POLL_INTERVAL_MS = 30_000;

export default function useDashboard() {
  const [buses, setBuses] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Track whether the initial fetch has completed so background polls
  // don't flip isLoading back to true.
  const hasFetchedOnce = useRef(false);

  // Guards against overlapping in-flight fetches from setInterval ticks
  const isFetchingRef = useRef(false);

  /**
   * Fetches both live fleet and stats endpoints in parallel.
   * On success: updates buses + stats, clears any previous error, records timestamp.
   * On failure: sets a user-facing error message.
   */
  const fetchDashboard = useCallback(async () => {
    // Skip if a fetch is already in flight — prevents overlapping requests
    // and out-of-order state updates from slow responses
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Only show loading skeleton before the first fetch attempt
    if (!hasFetchedOnce.current) {
      setIsLoading(true);
    }

    try {
      const [fleetData, statsData] = await Promise.all([
        getLiveFleet(),
        getDashboardStats(),
      ]);

      setBuses(fleetData.buses ?? []);
      setStats(statsData);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Derive a user-friendly error message from the API response
      const message =
        err.response?.data?.message || 'Failed to load dashboard data';
      setError(message);
    } finally {
      isFetchingRef.current = false;
      // Mark as fetched regardless of success/failure so the loading
      // skeleton never re-appears after the first fetch attempt
      hasFetchedOnce.current = true;
      // Always clear loading after first attempt regardless of outcome
      setIsLoading(false);
    }
  }, []);

  /**
   * Sets up the initial fetch on mount and a 30-second polling interval.
   * Cleans up the interval on unmount to prevent memory leaks.
   */
  useEffect(() => {
    // Fetch immediately on mount
    fetchDashboard();

    // Start background polling
    const intervalId = setInterval(fetchDashboard, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchDashboard]);

  return { buses, stats, isLoading, error, lastUpdated, refetch: fetchDashboard };
}
