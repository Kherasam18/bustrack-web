/**
 * NotificationsPage.jsx
 * Notifications history page for the School Admin role.
 * Shows all notifications sent to parents today, with optional
 * journey filter and 60-second auto-refresh.
 * Read-only — no mutations on this page.
 * Page title rendered by Topbar — no page-level h1.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, RefreshCw, Loader2, Filter, X } from 'lucide-react';
import { getSchoolNotificationsToday } from '../../api/notifications.api';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 60000; // 60 seconds

/* ──────────────────────────────────────────────────────────
 * Config maps — notification type + delivery status styling
 * ────────────────────────────────────────────────────────── */

// Maps notification type to a human label and Tailwind badge classes
const TYPE_CONFIG = {
  PICKUP_STARTED: {
    label: 'Pickup Started',
    classes: 'bg-green-100 text-green-700',
  },
  ARRIVED_SCHOOL: {
    label: 'Arrived School',
    classes: 'bg-blue-100 text-blue-700',
  },
  DROP_STARTED: {
    label: 'Drop Started',
    classes: 'bg-amber-100 text-amber-700',
  },
  JOURNEY_ENDED: {
    label: 'Journey Ended',
    classes: 'bg-slate-100 text-slate-600',
  },
};

// Maps delivery status to a human label and Tailwind badge classes
const DELIVERY_CONFIG = {
  PENDING: { label: 'Pending', classes: 'bg-amber-100 text-amber-700' },
  SENT:    { label: 'Sent',    classes: 'bg-green-100 text-green-700' },
  FAILED:  { label: 'Failed',  classes: 'bg-red-100 text-red-700'    },
};

/* ──────────────────────────────────────────────────────────
 * Utility helpers
 * ────────────────────────────────────────────────────────── */

// Formats ISO timestamp as HH:MM:SS for today's log
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/* ──────────────────────────────────────────────────────────
 * Main component
 * ────────────────────────────────────────────────────────── */

/** Notifications history page — read-only with 60s auto-refresh. */
export default function NotificationsPage() {
  /* ── State ── */
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState(null);
  const [journeyIdFilter, setJourneyIdFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  /* ── Refs ── */
  const hasFetchedRef = useRef(false);
  const pollIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  // Keeps journeyIdFilter in sync for the poll interval callback
  // so it always reads the current value without stale closure
  const journeyIdFilterRef = useRef('');

  // Sync ref with state
  useEffect(() => {
    journeyIdFilterRef.current = journeyIdFilter;
  }, [journeyIdFilter]);

  /* ── Data fetching ── */

  // Fetches notifications — aborts any previous in-flight request first
  const fetchNotifications = useCallback(async (journeyId) => {
    // Abort any existing in-flight request
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Skeleton on initial load, subtle indicator on subsequent fetches
    if (!hasFetchedRef.current) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }
    setError(null);

    try {
      const data = await getSchoolNotificationsToday(
        journeyId || null,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setNotifications(data.notifications || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
        hasFetchedRef.current = true;
      }
    } catch (err) {
      // Ignore abort errors — request superseded or component unmounted
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, []);

  // Initial fetch + 60-second poll interval
  useEffect(() => {
    fetchNotifications(journeyIdFilterRef.current);

    // Start polling — reads current filter from ref to avoid stale closure
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications(journeyIdFilterRef.current);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollIntervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchNotifications]);

  /* ── Handlers ── */

  // Updates filter input — does NOT trigger fetch (Apply button does)
  function handleFilterChange(value) {
    setJourneyIdFilter(value);
  }

  // Fetches with the current journey ID filter applied
  function handleApplyFilter() {
    fetchNotifications(journeyIdFilter);
  }

  // Clears filter and fetches unfiltered results
  function handleClearFilter() {
    setJourneyIdFilter('');
    fetchNotifications('');
  }

  // Manual refresh with current filter
  function handleManualRefresh() {
    fetchNotifications(journeyIdFilter);
  }

  /* ── Render ── */

  const COL_COUNT = 6;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

      {/* Header row */}
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xl font-semibold text-slate-800">
            Today's Notifications
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {total} notification{total !== 1 ? 's' : ''} sent today
          </p>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isLoading || isRefetching}
          aria-label="Refresh notifications"
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Last updated timestamp */}
      {lastUpdated && (
        <p className="mb-4 text-xs text-slate-400">
          Last updated: {fmtTime(lastUpdated.toISOString())}
        </p>
      )}

      {/* Journey ID filter row */}
      <div className="mb-4">
        <label
          htmlFor="journey-filter"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Filter by Journey ID
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="journey-filter"
            type="text"
            value={journeyIdFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder="Paste journey UUID to filter..."
            aria-label="Filter notifications by journey ID"
            className="min-w-0 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:flex-1"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyFilter}
              disabled={!journeyIdFilter.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-40"
            >
              <Filter className="h-4 w-4" />
              Apply
            </button>
            {journeyIdFilter && (
              <button
                type="button"
                onClick={handleClearFilter}
                aria-label="Clear journey filter"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Leave empty to show all of today's notifications
        </p>
      </div>

      {/* Subtle refetch indicator */}
      {isRefetching && !isLoading && (
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Retry
          </button>
        </div>
      )}

      {/* Notifications table — hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Recipient</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Delivery</th>
              <th className="px-4 py-3 font-medium">Read</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">

            {/* Loading skeleton */}
            {isLoading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: COL_COUNT }).map((__, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))}

            {/* Empty state */}
            {!isLoading && !error && notifications.length === 0 && (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <Bell className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No notifications sent today</p>
                    {journeyIdFilter && (
                      <p className="mt-1 text-xs text-slate-400">
                        No notifications found for this journey ID.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* Notification rows */}
            {!isLoading && notifications.map((n) => {
              const typeConf = TYPE_CONFIG[n.type] || {
                label: n.type,
                classes: 'bg-slate-100 text-slate-600',
              };
              const deliveryConf = DELIVERY_CONFIG[n.delivery_status] || {
                label: n.delivery_status,
                classes: 'bg-slate-100 text-slate-600',
              };

              return (
                <tr key={n.id} className="hover:bg-slate-50">
                  {/* Time */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {fmtTime(n.created_at)}
                  </td>

                  {/* Recipient */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{n.recipient_name}</p>
                    <p className="text-xs text-slate-400">
                      {n.recipient_user_id?.substring(0, 8)}...
                    </p>
                  </td>

                  {/* Type badge */}
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      typeConf.classes
                    )}>
                      {typeConf.label}
                    </span>
                  </td>

                  {/* Message body */}
                  <td className="max-w-xs px-4 py-3 text-sm text-slate-600">
                    <span className="block truncate" title={n.body}>
                      {n.body}
                    </span>
                  </td>

                  {/* Delivery status badge */}
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      deliveryConf.classes
                    )}>
                      {deliveryConf.label}
                    </span>
                  </td>

                  {/* Read status */}
                  <td className="px-4 py-3">
                    {n.is_read ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <span className="text-green-500">●</span> Read
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <span className="text-slate-300">●</span> Unread
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

          </tbody>
        </table>
      </div>
      </div>

      {/* Mobile card list — visible on mobile, hidden on md+ */}
      <div className="md:hidden space-y-3">
        {/* Loading skeleton cards */}
        {isLoading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-200" />
            <div className="h-3 w-full rounded bg-slate-200" />
          </div>
        ))}

        {/* Empty state */}
        {!isLoading && !error && notifications.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center">
            <div className="flex flex-col items-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Bell className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">
                {journeyIdFilter
                  ? 'No notifications found for this journey ID.'
                  : 'No notifications sent today'}
              </p>
            </div>
          </div>
        )}

        {/* Notification cards */}
        {!isLoading && notifications.map((n) => {
          const typeConf = TYPE_CONFIG[n.type] || {
            label: n.type,
            classes: 'bg-slate-100 text-slate-600',
          };
          const deliveryConf = DELIVERY_CONFIG[n.delivery_status] || {
            label: n.delivery_status,
            classes: 'bg-slate-100 text-slate-600',
          };

          return (
            <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-4">
              {/* Card header: time + type badge */}
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">
                  {fmtTime(n.created_at)}
                </span>
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  typeConf.classes
                )}>
                  {typeConf.label}
                </span>
              </div>

              {/* Recipient */}
              <div className="mb-2">
                <p className="text-sm font-medium text-slate-800">
                  {n.recipient_name}
                </p>
                <p className="font-mono text-xs text-slate-400">
                  {n.recipient_user_id?.substring(0, 8)}...
                </p>
              </div>

              {/* Message body */}
              <p className="mb-3 text-sm text-slate-600">
                {n.body}
              </p>

              {/* Footer: delivery badge + read status */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  deliveryConf.classes
                )}>
                  {deliveryConf.label}
                </span>
                {n.is_read ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <span className="text-green-500">●</span> Read
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <span className="text-slate-300">●</span> Unread
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
