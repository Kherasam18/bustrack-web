/**
 * BusStatusCard.jsx
 * Card component for a single bus in the live fleet grid. Displays bus number,
 * driver, route, scheduled departure, journey statuses (pickup / drop),
 * tracking status, flags, and a "last seen" indicator for degraded tracking.
 * The entire card is clickable and navigates to the bus detail page.
 */
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import JourneyFlagBadge from './JourneyFlagBadge';

/* ──────────────────────────────────────────────────────────
 * Tracking status severity — higher number = more severe
 * ────────────────────────────────────────────────────────── */
const TRACKING_SEVERITY = { ACTIVE: 1, WEAK: 2, LOST: 3 };

/** Visual config keyed by tracking status */
const TRACKING_DISPLAY = {
  ACTIVE: { label: 'Active', dotClass: 'bg-green-500', textClass: 'text-green-600' },
  WEAK: { label: 'Weak', dotClass: 'bg-amber-500', textClass: 'text-amber-600' },
  LOST: { label: 'Lost', dotClass: 'bg-red-500', textClass: 'text-red-600' },
};

/* ──────────────────────────────────────────────────────────
 * Journey status → display label + colour class mapping
 * ────────────────────────────────────────────────────────── */
const JOURNEY_STATUS_DISPLAY = {
  PICKUP_STARTED: { label: 'En Route', classes: 'bg-green-100 text-green-700' },
  ARRIVED_SCHOOL: { label: 'At School', classes: 'bg-blue-100 text-blue-700' },
  DROP_STARTED: { label: 'Returning', classes: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Done', classes: 'bg-slate-200 text-slate-600' },
  EXPIRED: { label: 'Expired', classes: 'bg-red-100 text-red-600' },
};

/** Default for null / NOT_STARTED journey status */
const DEFAULT_JOURNEY_STATUS = { label: 'Not Started', classes: 'bg-slate-100 text-slate-500' };

/** Maximum flags shown inline before collapsing to "+N more" */
const MAX_VISIBLE_FLAGS = 3;

/**
 * Derives the worst (most severe) tracking status between pickup and drop.
 * Returns the tracking status string or null if neither journey has tracking.
 */
function getWorstTrackingStatus(pickup, drop) {
  const pickupSeverity = TRACKING_SEVERITY[pickup?.tracking_status] ?? 0;
  const dropSeverity = TRACKING_SEVERITY[drop?.tracking_status] ?? 0;

  if (pickupSeverity === 0 && dropSeverity === 0) return null;

  // Return whichever is more severe
  return pickupSeverity >= dropSeverity
    ? pickup.tracking_status
    : drop.tracking_status;
}

/**
 * Formats "HH:MM:SS" to "HH:MM" by stripping the seconds portion.
 * Returns "—" if the input is null or undefined.
 */
function formatDeparture(time) {
  if (!time) return '—';
  return time.slice(0, 5);
}

/**
 * Computes "X min ago" from journey timestamps.
 * Returns "Last seen: unknown" when no valid timestamp is available.
 */
function getLastSeenText(pickup, drop) {
  // Parse candidate timestamps from both journey legs
  const pickupAt = pickup?.last_location_at ? new Date(pickup.last_location_at) : null;
  const dropAt = drop?.last_location_at ? new Date(drop.last_location_at) : null;

  // Filter out null and invalid Date objects before computing latest
  const candidates = [pickupAt, dropAt].filter(
    (d) => d !== null && !Number.isNaN(d.getTime())
  );

  // Pick the most recent valid date
  const latest = candidates.length > 0
    ? new Date(Math.max(...candidates.map((d) => d.getTime())))
    : null;

  if (!latest) return 'Last seen: unknown';

  const minutesAgo = Math.max(0, Math.round((Date.now() - latest.getTime()) / 60_000));
  return `Last seen ${minutesAgo} min ago`;
}

/**
 * Renders a journey status badge for either pickup (P) or drop (D).
 * @param {{ label: string, status: string|null }} props
 */
function JourneyStatusBadge({ label, status }) {
  const config = JOURNEY_STATUS_DISPLAY[status] || DEFAULT_JOURNEY_STATUS;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          config.classes
        )}
      >
        {config.label}
      </span>
    </div>
  );
}

/**
 * BusStatusCard component.
 * @param {{ bus: object }} props — one item from the /api/dashboard/live buses array
 */
export default function BusStatusCard({ bus }) {
  // Derive the worst tracking status across both journey legs
  const worstTracking = getWorstTrackingStatus(bus.pickup, bus.drop);
  const trackingDisplay = worstTracking ? TRACKING_DISPLAY[worstTracking] : null;

  // Collect all flags from both journey legs
  const allFlags = [
    ...(bus.pickup?.flags ?? []),
    ...(bus.drop?.flags ?? []),
  ];

  // Determine whether the "last seen" line should be shown
  const showLastSeen = worstTracking === 'WEAK' || worstTracking === 'LOST';

  return (
    <Link
      to={`/school-admin/buses/${bus.bus_id}`}
      className={cn(
        'cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        'transition-shadow hover:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-slate-300'
      )}
    >
      {/* ── Top row: bus number + tracking badge ──────── */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900">{bus.bus_number}</span>

        {trackingDisplay && (
          <span className={cn('flex items-center gap-1.5 text-xs font-medium', trackingDisplay.textClass)}>
            <span className={cn('inline-block h-2 w-2 rounded-full', trackingDisplay.dotClass)} />
            {trackingDisplay.label}
          </span>
        )}
      </div>

      {/* ── Middle: driver, route, departure ──────────── */}
      <div className="mt-3 space-y-1">
        <p className={cn('text-xs', bus.driver_name ? 'text-slate-700' : 'text-slate-400')}>
          <span className="font-medium text-slate-500">Driver: </span>
          {bus.driver_name || 'No driver assigned'}
        </p>
        <p className={cn('text-xs', bus.route_name ? 'text-slate-700' : 'text-slate-400')}>
          <span className="font-medium text-slate-500">Route: </span>
          {bus.route_name || 'No route assigned'}
        </p>
        <p className="text-xs text-slate-700">
          <span className="font-medium text-slate-500">Departure: </span>
          {formatDeparture(bus.scheduled_departure)}
        </p>
      </div>

      {/* ── Journey status badges (P / D) ─────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <JourneyStatusBadge label="P" status={bus.pickup?.status} />
        <JourneyStatusBadge label="D" status={bus.drop?.status} />
      </div>

      {/* ── Flags row ─────────────────────────────────── */}
      {allFlags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {allFlags.slice(0, MAX_VISIBLE_FLAGS).map((flag) => (
            <JourneyFlagBadge key={flag.flag_id} type={flag.type} />
          ))}
          {allFlags.length > MAX_VISIBLE_FLAGS && (
            <span className="text-xs text-slate-500">
              +{allFlags.length - MAX_VISIBLE_FLAGS} more
            </span>
          )}
        </div>
      )}

      {/* ── Last seen indicator (WEAK / LOST only) ───── */}
      {showLastSeen && (
        <p className="mt-2 text-xs text-slate-500">
          {getLastSeenText(bus.pickup, bus.drop)}
        </p>
      )}
    </Link>
  );
}
