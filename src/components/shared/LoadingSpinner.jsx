// src/components/shared/LoadingSpinner.jsx — Accessible loading spinner — use wherever an async operation is in progress
export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-2">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-slate-700"
        aria-hidden="true"
      />
      <span className="text-sm text-gray-500">{message}</span>
    </div>
  );
}
