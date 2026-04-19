// src/pages/auth/LoginPage.jsx — Two-mode login page for School Admin (2-step) and Super Admin (single-step) flows
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { ROLES, getDefaultRoute } from '../../utils/roles';
import { loginSchoolAdmin, loginSuperAdmin } from '../../api/auth.api';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Eye, EyeOff, Bus, ShieldCheck } from 'lucide-react';

// Basic email validation pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

// Delays execution for a given duration — used for the post-success pause
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { token, user, setAuth } = useAuthStore();

  // Form state
  const [mode, setMode] = useState('school-admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation and feedback state
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect guard — if already authenticated, send to dashboard
  useEffect(() => {
    if (token && user) {
      navigate(getDefaultRoute(user.role), { replace: true });
    }
  }, [token, user, navigate]);

  // Clears field-level error when user starts typing
  const handleEmailChange = useCallback((e) => {
    setEmail(e.target.value);
    setFieldErrors((prev) => ({ ...prev, email: '' }));
  }, []);

  const handlePasswordChange = useCallback((e) => {
    setPassword(e.target.value);
    setFieldErrors((prev) => ({ ...prev, password: '' }));
  }, []);

  // Switches login mode and resets all form state
  function switchMode(newMode) {
    setMode(newMode);
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setFieldErrors({});
    setApiError('');
  }

  // Validates inputs and returns true if the form is valid
  function validateForm() {
    const errors = {};

    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Handles form submission for both login modes
  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (mode === 'school-admin') {
        // Step 1 of 2-step flow — get the twoFactorToken, then navigate to OTP
        const { twoFactorToken } = await loginSchoolAdmin(email.trim(), password);
        await wait(800);
        navigate('/verify-otp', { state: { twoFactorToken } });
      } else {
        // Single-step Super Admin flow — authenticate and redirect
        const { token: authToken, user: authUser } = await loginSuperAdmin(email.trim(), password);
        setAuth(authUser, authToken);
        await wait(800);
        navigate(getDefaultRoute(ROLES.SUPER_ADMIN), { replace: true });
      }
    } catch (err) {
      const message =
        err.response?.data?.message || 'Login failed. Please check your credentials.';
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex">
      {/* Loading overlay — covers full page during API call and post-success pause */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-slate-600">Signing in…</span>
          </div>
        </div>
      )}

      {/* ── Left panel — brand area (hidden on mobile) ── */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] flex-col justify-between bg-slate-900 p-10 lg:p-16 text-white">
        <div>
          {/* Brand mark */}
          <div className="flex items-center gap-3 mb-16">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Bus className="h-6 w-6 text-amber-400" />
            </div>
            <span className="text-xl font-bold tracking-tight">BusTrack</span>
          </div>

          {/* Hero copy */}
          <div className="max-w-md">
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
              School Bus Tracking Platform
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed">
              Real-time visibility for every journey. Monitor routes, track buses, and keep students safe — all from one dashboard.
            </p>
          </div>
        </div>

        {/* Footer accent */}
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <div className="h-px flex-1 bg-slate-700" />
          <span>Trusted by schools across the country</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex w-full md:w-1/2 lg:w-[45%] items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile-only brand header */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
              <Bus className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-lg font-bold text-slate-900">BusTrack</span>
          </div>

          {/* Form card */}
          <div
            className={`rounded-xl border bg-white p-6 sm:p-8 shadow-sm transition-colors ${
              mode === 'super-admin' ? 'border-amber-300' : 'border-slate-200'
            }`}
          >
            {/* Mode heading */}
            <div className="mb-6">
              {mode === 'super-admin' && (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Platform Admin
                </span>
              )}
              <h2 className="text-2xl font-semibold text-slate-900">
                {mode === 'school-admin' ? 'School Admin Login' : 'Platform Admin Login'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your credentials to access the dashboard.
              </p>
            </div>

            {/* API-level error message */}
            {apiError && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100"
              >
                {apiError}
              </div>
            )}

            {/* Login form */}
            <form onSubmit={handleSubmit} noValidate>
              {/* Email field */}
              <div className="mb-4">
                <Label htmlFor="login-email" className="mb-1.5 block text-slate-700">
                  Email address
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="admin@school.com"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  autoComplete="email"
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  className={fieldErrors.email ? 'border-red-400 focus-visible:ring-red-300' : ''}
                />
                {fieldErrors.email && (
                  <p id="login-email-error" className="mt-1 text-xs text-red-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password field with show/hide toggle */}
              <div className="mb-6">
                <Label htmlFor="login-password" className="mb-1.5 block text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    autoComplete="current-password"
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    className={`pr-10 ${fieldErrors.password ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {fieldErrors.password && (
                  <p id="login-password-error" className="mt-1 text-xs text-red-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 text-sm font-semibold"
              >
                {isLoading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>

            {/* Mode-specific links below the form */}
            <div className="mt-6 space-y-2 text-center text-sm">
              {mode === 'school-admin' ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="block w-full text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('super-admin')}
                    className="block w-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Platform Admin? Sign in here
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode('school-admin')}
                  className="block w-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Back to School Admin login
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} BusTrack. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
