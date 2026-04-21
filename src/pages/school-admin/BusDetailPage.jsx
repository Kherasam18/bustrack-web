/**
 * BusDetailPage.jsx
 * Single bus detail page for the School Admin role. Shows full information for
 * one bus including today's pickup and drop journey statuses, a live map with
 * the bus's last known location, journey flags, and the GPS location log.
 *
 * The page title ("Bus Detail") is rendered by Topbar — this component does
 * NOT render a page-level h1.
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Users, Route, UserCheck, Bus } from 'lucide-react';
import api from '../../api/axios';
import { getJourneyLocationLog } from '../../api/location.api';
import LiveMap from '../../components/dashboard/LiveMap';
import JourneyFlagBadge from '../../components/dashboard/JourneyFlagBadge';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Journey status → display label + colour class mapping
 * (same mapping used in BusStatusCard — repeated here to
 * keep this file self-contained)
 * ────────────────────────────────────────────────────────── */
const JOURNEY_STATUS_DISPLAY = {
  PICKUP_STARTED: { label: 'En Route', classes: 'bg-green-100 text-green-700' },
  ARRIVED_SCHOOL: { label: 'At School', classes: 'bg-blue-100 text-blue-700' },
  DROP_STARTED: { label: 'Returning', classes: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Done', classes: 'bg-slate-200 text-slate-600' },
  EXPIRED: { label: 'Expired', classes: 'bg-red-100 text-red-600' },
};

/** Default when status is null (no journey started today) */
const DEFAULT_JOURNEY_STATUS = { label: 'Not Started', classes: 'bg-slate-100 text-slate-500' };

/** Tracking status visual config */
const TRACKING_DISPLAY = {
  ACTIVE: { label: 'Active', dotClass: 'bg-green-500', textClass: 'text-green-600' },
  WEAK: { label: 'Weak', dotClass: 'bg-amber-500', textClass: 'text-amber-600' },
  LOST: { label: 'Lost', dotClass: 'bg-red-500', textClass: 'text-red-600' },
};

/** Maximum location log rows shown in the table */
const MAX_LOG_ROWS = 100;

/* ──────────────────────────────────────────────────────────
 * Utility functions
 * ────────────────────────────────────────────────────────── */

/**
 * Formats "HH:MM:SS" to "HH:MM" by stripping the seconds portion.
 * Returns "—" if null/undefined.
 */
function formatTimeShort(time) {
  if (!time) return '—';
  // Split on ':' and pad hour to handle both HH:MM:SS and H:MM:SS
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  }
  return time.slice(0, 5);
}

/**
 * Formats an ISO timestamp to "DD MMM, HH:MM" (e.g. "21 Apr, 14:30").
 * Returns "—" if null/undefined/invalid.
 */
function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';

  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
}

/**
 * Formats an ISO timestamp to "HH:MM:SS" for the location log table.
 * Returns "—" if null/undefined/invalid.
 */
function formatTimeFromISO(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Selects the journey whose location log should be fetched, based on
 * active/completed status priority.
 * Returns the journey object or null if no suitable journey exists.
 */
function selectActiveJourney(pickup, drop) {
  // Prefer the currently active journey
  if (pickup?.status === 'PICKUP_STARTED') return pickup;
  if (drop?.status === 'DROP_STARTED') return drop;

  // Fallback to completed/arrived journeys
  if (pickup?.status === 'COMPLETED' || pickup?.status === 'ARRIVED_SCHOOL') return pickup;
  if (drop?.status === 'COMPLETED') return drop;

  return null;
}

/* ──────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────── */

/**
 * Renders a single labelled stat in the bus info header.
 */
function InfoStat({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
      </div>
    </div>
  );
}

/**
 * Renders a journey card (pickup or drop) with status, tracking, times, and flags.
 */
function JourneyCard({ title, journey }) {
  // Resolve display config for journey and tracking status
  const statusConfig = JOURNEY_STATUS_DISPLAY[journey?.status] || DEFAULT_JOURNEY_STATUS;
  const trackingConfig = journey?.tracking_status ? TRACKING_DISPLAY[journey.tracking_status] : null;
  const flags = journey?.flags ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      {/* Header with title and status badges */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <div className="flex items-center gap-2">
          {/* Journey status badge */}
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              statusConfig.classes
            )}
          >
            {statusConfig.label}
          </span>

          {/* Tracking status badge */}
          {trackingConfig && (
            <span className={cn('flex items-center gap-1.5 text-xs font-medium', trackingConfig.textClass)}>
              <span className={cn('inline-block h-2 w-2 rounded-full', trackingConfig.dotClass)} />
              {trackingConfig.label}
            </span>
          )}
        </div>
      </div>

      {/* Times */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500">Started at</p>
          <p className="text-sm font-medium text-slate-800">
            {formatDateTime(journey?.started_at)}
            {journey?.is_auto_started && (
              <span className="ml-1 text-xs text-slate-400">(auto)</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Ended at</p>
          <p className="text-sm font-medium text-slate-800">
            {formatDateTime(journey?.ended_at)}
            {journey?.is_auto_ended && (
              <span className="ml-1 text-xs text-slate-400">(auto)</span>
            )}
          </p>
        </div>
      </div>

      {/* Flags */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-slate-500">Flags</p>
        {flags.length === 0 ? (
          <p className="text-xs text-slate-400">No flags</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {flags.map((flag) => {
              // Resolved flags are shown with reduced opacity and a check mark
              // Use Boolean() so undefined resolved_at is treated as unresolved
              const isResolved = Boolean(flag.resolved_at);
              return (
                <div key={flag.flag_id} className="flex items-center gap-1">
                  <span className={isResolved ? 'opacity-50' : ''}>
                    <JourneyFlagBadge type={flag.type} />
                  </span>
                  {isResolved && (
                    <span className="text-xs text-slate-400">✓ Resolved</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the full page.
 */
function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Back link skeleton */}
      <div className="mb-4 h-4 w-32 animate-pulse rounded bg-slate-200" />

      {/* Header card skeleton */}
      <div className="mb-6 h-32 w-full animate-pulse rounded-xl bg-slate-200" />

      {/* Journey card skeletons */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
      </div>

      {/* Map skeleton */}
      <div className="h-64 w-full animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * Main page component
 * ────────────────────────────────────────────────────────── */

export default function BusDetailPage() {
  const { id: busId } = useParams();

  const [bus, setBus] = useState(null);
  const [locationLog, setLocationLog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetches bus detail and (conditionally) the location log on mount.
   */
  useEffect(() => {
    // Create abort controller to cancel in-flight requests on unmount
    const controller = new AbortController();

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch bus detail
        const busResponse = await api.get(`/api/dashboard/buses/${busId}`,
          { signal: controller.signal }
        );
        const busData = busResponse.data.data.bus;
        setBus(busData);

        // Determine which journey to fetch the location log for
        const activeJourney = selectActiveJourney(busData.pickup, busData.drop);

        // Fetch location log only when a valid journey_id exists
        if (activeJourney?.journey_id) {
          try {
            const logData = await getJourneyLocationLog(activeJourney.journey_id, controller.signal);
            setLocationLog(logData);
          } catch (_) {
            // Location log fetch failure is non-critical — page still renders
            setLocationLog(null);
          }
        }
      } catch (err) {
        // Ignore abort errors — component unmounted before fetch completed
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        const message =
          err.response?.data?.message || 'Failed to load bus details';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();

    // Abort any in-flight requests when the component unmounts
    return () => controller.abort();
  }, [busId]);

  // Determine which journey provides the map data
  const activeJourney = bus ? selectActiveJourney(bus.pickup, bus.drop) : null;
  const mapLat = activeJourney?.last_known_lat ?? null;
  const mapLng = activeJourney?.last_known_lng ?? null;
  const mapTrackingStatus = activeJourney?.tracking_status ?? null;
  const mapLastLocationAt = activeJourney?.last_location_at ?? null;

  // Loading skeleton
  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* ── Back link ──────────────────────────────────── */}
      <Link
        to="/school-admin/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1 rounded"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* ── Error banner ─────────────────────────────── */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Not found state ──────────────────────────── */}
      {!error && !bus && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Bus className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">Bus not found</p>
        </div>
      )}

      {/* ── Bus detail content ───────────────────────── */}
      {bus && (
        <>
          {/* Bus info header card */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-2xl font-bold text-slate-900">{bus.bus_number}</p>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <InfoStat label="Driver" value={bus.driver_name} icon={UserCheck} />
              <InfoStat label="Route" value={bus.route_name} icon={Route} />
              <InfoStat label="Capacity" value={bus.capacity} icon={Users} />
              <InfoStat label="Students" value={bus.student_count} icon={Users} />
              <InfoStat label="Departure" value={formatTimeShort(bus.scheduled_departure)} icon={Clock} />
            </div>
          </div>

          {/* Journey status cards — pickup and drop side by side */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <JourneyCard title="Pickup Journey" journey={bus.pickup} />
            <JourneyCard title="Drop Journey" journey={bus.drop} />
          </div>

          {/* Live map section */}
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">Live Location</h2>
            <LiveMap
              lat={mapLat}
              lng={mapLng}
              trackingStatus={mapTrackingStatus}
              lastLocationAt={mapLastLocationAt}
            />
          </div>

          {/* GPS location log section */}
          {locationLog && locationLog.points && locationLog.points.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-1 text-lg font-semibold text-slate-800">Location Log</h2>
              <p className="mb-3 text-sm text-slate-500">
                {locationLog.total} points recorded
                {locationLog.total > MAX_LOG_ROWS && (
                  <span className="ml-1 text-slate-400">
                    — Showing last {MAX_LOG_ROWS} of {locationLog.total} points
                  </span>
                )}
              </p>

              {/* Location log table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Lat</th>
                      <th className="px-4 py-2 font-medium">Lng</th>
                      <th className="px-4 py-2 font-medium">Speed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      // Offset row numbers to reflect true position in full points array
                      const startIndex = Math.max(
                        0,
                        locationLog.points.length - MAX_LOG_ROWS
                      );

                      return locationLog.points.slice(-MAX_LOG_ROWS).map((point, index) => (
                        <tr key={point.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-500">{startIndex + index + 1}</td>
                        <td className="px-4 py-2 text-slate-700">
                          {formatTimeFromISO(point.recorded_at)}
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-700">
                          {typeof point.lat === 'number' ? point.lat.toFixed(6) : '—'}
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-700">
                          {typeof point.lng === 'number' ? point.lng.toFixed(6) : '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {point.speed !== null && point.speed !== undefined
                            ? `${point.speed} km/h`
                            : '—'}
                        </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
