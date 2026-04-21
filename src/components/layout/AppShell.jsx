/**
 * AppShell.jsx
 * Outermost layout wrapper for all authenticated pages. Composes the Sidebar
 * and Topbar around the page content area rendered via React Router's <Outlet />.
 *
 * Responsive behaviour:
 *  - Desktop (≥ lg): Sidebar is fixed at the left (w-64). Main content is offset
 *    with a left margin of the same width.
 *  - Mobile (< lg): Sidebar overlays as a drawer with a dark semi-transparent
 *    backdrop. Tapping the backdrop closes the sidebar.
 */
import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { cn } from '../../lib/utils';

export default function AppShell() {
  // Sidebar open state — defaults to closed on mobile; on desktop the sidebar
  // is always visible via CSS regardless of this state value.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /** Toggle the mobile sidebar drawer */
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  /** Close the mobile sidebar drawer */
  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      {/* ── Mobile backdrop ──────────────────────────────── */}
      {/* Semi-transparent overlay behind the sidebar on mobile; clicking it
          closes the drawer. Hidden on desktop (lg:hidden). */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 lg:hidden',
          isSidebarOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* ── Main content area ────────────────────────────── */}
      {/* On desktop the main pane is offset by the sidebar width (lg:ml-64).
          On mobile it spans the full viewport width. */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Top bar */}
        <Topbar onMenuToggle={toggleSidebar} />

        {/* Page content rendered by React Router */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
