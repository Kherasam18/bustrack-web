/**
 * JourneyFlagBadge.jsx
 * Compact inline badge for a single journey flag. Renders the flag type as a
 * coloured pill with a human-readable label. Used inside BusStatusCard.
 */
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────
 * Flag type → display label + colour class mapping
 * ────────────────────────────────────────────────────────── */
const FLAG_CONFIG = {
  LATE_START:      { label: 'Late Start',     classes: 'bg-red-100 text-red-700' },
  GPS_LOST:        { label: 'GPS Lost',       classes: 'bg-red-100 text-red-700' },
  GPS_WEAK:        { label: 'GPS Weak',       classes: 'bg-amber-100 text-amber-700' },
  SESSION_EXPIRED: { label: 'Expired',        classes: 'bg-slate-100 text-slate-600' },
  DRIVER_CHANGED:  { label: 'Driver Changed', classes: 'bg-blue-100 text-blue-700' },
};

/** Default styling for unknown / unmapped flag types */
const DEFAULT_CONFIG = { classes: 'bg-slate-100 text-slate-600' };

/**
 * Renders a single flag badge.
 * @param {{ type: string }} props
 */
export default function JourneyFlagBadge({ type }) {
  // Look up the config for this flag type, falling back to defaults
  const config = FLAG_CONFIG[type] || DEFAULT_CONFIG;
  const label = config.label || type;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.classes
      )}
    >
      {label}
    </span>
  );
}
