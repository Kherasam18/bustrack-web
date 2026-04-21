/**
 * DashboardPage.jsx
 * School Admin live dashboard page. Renders an overview stats strip at the top
 * followed by a responsive grid of BusStatusCard components showing every bus
 * in the fleet. Data is fetched via useDashboard (parallel API calls + 30s poll).
 *
 * The page title is rendered by Topbar — this component does NOT render an h1.
 */
import { Bus, Navigation, MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import useDashboard from '../../hooks/useDashboard';
import BusStatusCard from '../../components/dashboard/BusStatusCard';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Stat card configuration — drives the stats strip
 * ────────────────────────────────────────────────────────── */
const STAT_CARDS = [
  { key: 'total_buses',      label: 'Total Buses',    icon: Bus,           accent: false },
  { key: 'journeys_active',  label: 'Active Now',     icon: Navigation,    accent: false },
  { key: 'arrived_school',   label: 'Arrived School', icon: MapPin,        accent: false },
  { key: 'buses_with_flags', label: 'With Flags',     icon: AlertTriangle, accent: true  },
];

/**
 * Formats a Date object to "HH:MM:SS" for the "last updated" indicator.
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/* ──────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────── */

/**
 * A single stat card used in the stats strip.
 */
function StatCard({ label, value, icon: Icon, isAccented }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={cn(
          'mb-3 flex h-9 w-9 items-center justify-center rounded-lg',
          isAccented ? 'bg-red-100' : 'bg-slate-100'
        )}
      >
        <Icon
          className={cn('h-5 w-5', isAccented ? 'text-red-600' : 'text-slate-600')}
        />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value ?? '—'}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

/**
 * Skeleton placeholder card shown while the initial fetch is in progress.
 */
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
      <div className="mb-2 h-7 w-16 animate-pulse rounded bg-slate-200" />
      <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

/**
 * Skeleton placeholder for a bus card in the fleet grid.
 */
function BusSkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-14 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-3 flex gap-3">
        <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * Main page component
 * ────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { buses, stats, isLoading, error, lastUpdated, refetch } = useDashboard();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* ── Error banner (inline, non-blocking) ──────── */}
      {error && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="ml-4 shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Stats strip ──────────────────────────────── */}
      {isLoading ? (
        // Skeleton stat cards while initial data loads
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STAT_CARDS.map((card) => {
            // "With Flags" card is accented only when count > 0
            const isAccented = card.accent && (stats[card.key] ?? 0) > 0;
            return (
              <StatCard
                key={card.key}
                label={card.label}
                value={stats[card.key]}
                icon={card.icon}
                isAccented={isAccented}
              />
            );
          })}
        </div>
      ) : null}

      {/* ── Fleet section heading + last updated indicator ── */}
      <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Live Fleet</h2>
          {lastUpdated && (
            <p className="text-xs text-slate-400">
              Last updated: {formatTime(lastUpdated)}
            </p>
          )}
        </div>

        {/* Manual refresh button */}
        <button
          type="button"
          onClick={refetch}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5',
            'text-xs font-medium text-slate-600 transition-colors',
            'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300'
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Fleet grid ───────────────────────────────── */}
      {isLoading ? (
        // Skeleton bus cards while initial data loads
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <BusSkeletonCard key={i} />
          ))}
        </div>
      ) : !error && buses.length === 0 ? (
        // Only show empty state when fetch succeeded but returned no buses —
        // not when the empty array is a result of a fetch error
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Bus className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No buses found for your school.</p>
        </div>
      ) : (
        // Live fleet cards
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buses.map((bus) => (
            <BusStatusCard key={bus.bus_id} bus={bus} />
          ))}
        </div>
      )}
    </div>
  );
}
