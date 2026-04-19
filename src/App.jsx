// src/App.jsx — Root application component with React Router v6 role-based routing
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuthStore from './store/authStore';
import { ROLES, getDefaultRoute, hasRole } from './utils/roles';

import LoginPage from './pages/auth/LoginPage';
import VerifyOTPPage from './pages/auth/VerifyOTPPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

import SchoolsPage from './pages/super-admin/SchoolsPage';
import SchoolDetailPage from './pages/super-admin/SchoolDetailPage';

import DashboardPage from './pages/school-admin/DashboardPage';
import BusesPage from './pages/school-admin/BusesPage';
import BusDetailPage from './pages/school-admin/BusDetailPage';
import StudentsPage from './pages/school-admin/StudentsPage';
import DriversPage from './pages/school-admin/DriversPage';
import NotificationsPage from './pages/school-admin/NotificationsPage';

/**
 * ProtectedRoute — guards child routes behind authentication and role checks.
 * @param {{ requiredRole: string }} props
 */
function ProtectedRoute({ requiredRole }) {
  const { token, user } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole(user?.role, requiredRole)) {
    return <Navigate to={getDefaultRoute(user?.role)} replace />;
  }

  return <Outlet />;
}

/**
 * RootRedirect — redirects the root path based on the user's authentication
 * state and role.
 */
function RootRedirect() {
  const { token, user } = useAuthStore();

  if (token && user) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-otp" element={<VerifyOTPPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Super Admin routes */}
        <Route element={<ProtectedRoute requiredRole={ROLES.SUPER_ADMIN} />}>
          <Route path="/super-admin/schools" element={<SchoolsPage />} />
          <Route path="/super-admin/schools/:id" element={<SchoolDetailPage />} />
        </Route>

        {/* School Admin routes */}
        <Route element={<ProtectedRoute requiredRole={ROLES.SCHOOL_ADMIN} />}>
          <Route path="/school-admin/dashboard" element={<DashboardPage />} />
          <Route path="/school-admin/buses" element={<BusesPage />} />
          <Route path="/school-admin/buses/:id" element={<BusDetailPage />} />
          <Route path="/school-admin/students" element={<StudentsPage />} />
          <Route path="/school-admin/drivers" element={<DriversPage />} />
          <Route path="/school-admin/notifications" element={<NotificationsPage />} />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
