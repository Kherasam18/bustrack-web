// src/pages/auth/VerifyOTPPage.jsx — 6-digit OTP verification for School Admin 2-step login flow
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { ROLES, getDefaultRoute } from '../../utils/roles';
import { verifySchoolAdminOtp } from '../../api/auth.api';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Bus, ShieldCheck } from 'lucide-react';

// Number of OTP digits expected by the backend
const OTP_LENGTH = 6;

// Cooldown duration (seconds) before the user can request a new OTP
const RESEND_COOLDOWN = 60;

// Delays execution for a given duration — used for the post-success pause
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, setAuth } = useAuthStore();

  // Extract twoFactorToken from Router state passed by LoginPage
  const twoFactorToken = location.state?.twoFactorToken || null;

  // OTP digit values stored as an array of single-character strings
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));

  // Ref array for each OTP input element — allows programmatic focus control
  const inputRefs = useRef(Array(OTP_LENGTH).fill(null));

  // UI feedback state
  const [fieldError, setFieldError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Resend cooldown timer (seconds remaining)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  // ── Entry guard — redirect if no twoFactorToken or already authenticated ──
  useEffect(() => {
    if (token && user) {
      navigate(getDefaultRoute(user.role), { replace: true });
      return;
    }
    if (!twoFactorToken) {
      navigate('/login', { replace: true });
    }
  }, [token, user, twoFactorToken, navigate]);

  // ── Resend cooldown countdown timer ──
  useEffect(() => {
    if (cooldown <= 0) return;

    const intervalId = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Clean up interval on unmount — prevents memory leaks
    return () => clearInterval(intervalId);
  }, [cooldown]);

  // ── Handles typing a digit in a single OTP box ──
  const handleDigitChange = useCallback((index, value) => {
    // Allow only single numeric digits
    if (value && !/^\d$/.test(value)) return;

    setFieldError('');
    setApiError('');

    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    // Auto-advance focus to the next box after entering a digit
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  // ── Handles keyboard navigation between OTP boxes ──
  const handleKeyDown = useCallback((index, e) => {
    // On Backspace in an empty box, move focus to the previous box
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  // ── Handles pasting a multi-digit OTP string ──
  const handlePaste = useCallback((index, e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;

    setFieldError('');
    setApiError('');

    setDigits((prev) => {
      const next = [...prev];
      // Distribute pasted digits starting from the focused box
      for (let i = 0; i < pasted.length && index + i < OTP_LENGTH; i++) {
        next[index + i] = pasted[i];
      }
      return next;
    });

    // Move focus to the last filled box or the end
    const lastFilledIndex = Math.min(index + pasted.length - 1, OTP_LENGTH - 1);
    inputRefs.current[lastFilledIndex]?.focus();
  }, []);

  // ── Clears all OTP boxes and moves focus to the first one ──
  function resetOtpInputs() {
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  }

  // ── Handles form submission — validates, calls API, stores auth ──
  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');
    setFieldError('');

    // Validate all 6 digits are filled
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setFieldError('Please enter the complete 6-digit code.');
      return;
    }

    setIsLoading(true);

    try {
      // Verify OTP with the backend using the twoFactorToken from Step 1
      const { token: authToken, user: authUser } = await verifySchoolAdminOtp(otp, twoFactorToken);

      // Persist authentication state
      setAuth(authUser, authToken);

      // Brief loading pause for visual feedback before redirect
      await wait(800);

      navigate(getDefaultRoute(ROLES.SCHOOL_ADMIN), { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid or expired OTP. Please try again.';
      setApiError(message);

      // Clear inputs so the user can re-enter
      resetOtpInputs();
    } finally {
      setIsLoading(false);
    }
  }

  // ── Resend handler — navigates back to login with a message ──
  function handleResend() {
    navigate('/login', {
      state: { resendMessage: 'Session expired. Please log in again to receive a new OTP.' },
    });
  }

  // Guard: don't render anything if we're about to redirect
  if (!twoFactorToken || (token && user)) {
    return null;
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
            <span className="text-sm font-medium text-slate-600">Verifying…</span>
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
              Two-Factor Authentication
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed">
              One last step to secure your account. Enter the verification code sent to your registered email.
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

      {/* ── Right panel — OTP form ── */}
      <div className="flex w-full md:w-1/2 lg:w-[45%] items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile-only brand header */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
              <Bus className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-lg font-bold text-slate-900">BusTrack</span>
          </div>

          {/* OTP form card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            {/* 2FA badge and heading */}
            <div className="mb-6">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Two-Factor Verification
              </span>
              <h2 className="text-2xl font-semibold text-slate-900">Verify Your Identity</h2>
              <p className="mt-1 text-sm text-slate-500">
                A 6-digit code has been sent to your registered email address.
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

            {/* OTP form */}
            <form onSubmit={handleSubmit} noValidate>
              {/* 6-digit OTP input group */}
              <div className="mb-6">
                <Label className="mb-2 block text-slate-700" id="otp-group-label">
                  One-time password
                </Label>
                <div
                  className="flex items-center justify-between gap-2"
                  role="group"
                  aria-labelledby="otp-group-label"
                >
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      pattern="[0-9]"
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={(e) => handlePaste(index, e)}
                      disabled={isLoading}
                      aria-label={`Digit ${index + 1}`}
                      aria-invalid={!!fieldError}
                      autoFocus={index === 0}
                      className={`h-12 w-10 sm:h-14 sm:w-12 rounded-lg border text-center text-lg font-semibold text-slate-900 outline-none transition-colors
                        focus:border-slate-500 focus:ring-2 focus:ring-slate-200
                        disabled:cursor-not-allowed disabled:opacity-50
                        ${fieldError ? 'border-red-400' : 'border-slate-300'}
                      `}
                    />
                  ))}
                </div>
                {/* Field-level validation error */}
                {fieldError && (
                  <p className="mt-2 text-xs text-red-600" role="alert">
                    {fieldError}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 text-sm font-semibold"
              >
                {isLoading ? 'Verifying…' : 'Verify'}
              </Button>
            </form>

            {/* Resend OTP section */}
            <div className="mt-5 text-center text-sm">
              {cooldown > 0 ? (
                <p className="text-slate-400">
                  Resend available in <span className="font-medium tabular-nums">{cooldown}s</span>
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-slate-500">Didn&apos;t receive the code?</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    className="font-medium text-slate-700 hover:text-slate-900 transition-colors underline underline-offset-2"
                  >
                    Resend OTP
                  </button>
                </div>
              )}
            </div>

            {/* Back to login link */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Back to Login
              </button>
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
