/**
 * LiveMap.jsx
 * Google Maps component showing a bus's last known location with a marker.
 * Displays tracking status banners for WEAK/LOST signals and gracefully
 * handles missing location data and map load errors.
 */
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { cn } from '../../lib/utils';

/** Default map centre — geographic centre of India */
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

/** Map container style — uses full width from parent */
const CONTAINER_STYLE = { width: '100%', height: '100%' };

/** Map options — minimal UI with only zoom control */
const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
};

/**
 * Computes a "X min ago" string from an ISO timestamp.
 * Returns "unknown" when the timestamp is null or invalid.
 * @param {string|null} isoTimestamp
 * @returns {string}
 */
function getMinutesAgoText(isoTimestamp) {
  if (!isoTimestamp) return 'unknown';

  const date = new Date(isoTimestamp);

  // Guard against invalid Date objects
  if (Number.isNaN(date.getTime())) return 'unknown';

  const minutesAgo = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  return `${minutesAgo} min ago`;
}

/**
 * Checks whether a value is a valid, finite number suitable for lat/lng.
 * @param {*} val
 * @returns {boolean}
 */
// Validate finite number and geographic range
// isLat=true enforces -90..90, isLat=false enforces -180..180
function isValidCoord(val, isLat = false) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return false;
  if (isLat) return val >= -90 && val <= 90;
  return val >= -180 && val <= 180;
}

/**
 * LiveMap component.
 * @param {{ lat: number|null, lng: number|null, trackingStatus: string|null, lastLocationAt: string|null }} props
 */
export default function LiveMap({ lat, lng, trackingStatus, lastLocationAt }) {
  // Load the Google Maps script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
  });

  // Determine whether we have valid coordinates to show
  const hasLocation = isValidCoord(lat, true) && isValidCoord(lng, false);

  // Compute map centre and zoom based on location availability
  const center = hasLocation ? { lat, lng } : DEFAULT_CENTER;
  const zoom = hasLocation ? 15 : 5;

  // Determine whether to show a tracking status banner
  const showBanner = hasLocation && (trackingStatus === 'WEAK' || trackingStatus === 'LOST');
  const bannerText = trackingStatus === 'LOST'
    ? `Signal lost — Last seen ${getMinutesAgoText(lastLocationAt)}`
    : `Signal weak — Last seen ${getMinutesAgoText(lastLocationAt)}`;

  // Map load error state
  if (loadError) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-xl bg-slate-100">
        <p className="text-sm text-slate-500">Map unavailable</p>
      </div>
    );
  }

  // Map script loading state
  if (!isLoaded) {
    return (
      <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />
    );
  }

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl">
      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={center}
        zoom={zoom}
        options={MAP_OPTIONS}
      >
        {/* Marker — only rendered when coordinates are valid */}
        {hasLocation && <Marker position={{ lat, lng }} />}
      </GoogleMap>

      {/* No-location overlay — shown when lat/lng are not available */}
      {!hasLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <p className="rounded-lg bg-white/90 px-4 py-2 text-sm text-slate-500">
            No location data available
          </p>
        </div>
      )}

      {/* Tracking status banner — shown for WEAK or LOST */}
      {showBanner && (
        <div
          className={cn(
            'absolute bottom-0 left-0 px-3 py-1 text-xs font-medium text-white rounded-t',
            trackingStatus === 'LOST' ? 'bg-red-500' : 'bg-amber-500'
          )}
        >
          {bannerText}
        </div>
      )}
    </div>
  );
}
