// src/pages/auth/ForgotPasswordPage.jsx — 3-step School Admin password reset: email → OTP → new password
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { getDefaultRoute } from '../../utils/roles';
import {
  forgotPasswordSchoolAdmin,
  resetPasswordSchoolAdmin,
  resendForgotPasswordOtp,
} from '../../api/auth.api';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Bus, Eye, EyeOff, Check } from 'lucide-react';

// Constants
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Step definitions for the progress indicator
const STEPS = [
  { key: 'email', label: 'Email' },
  { key: 'otp', label: 'Verify OTP' },
  { key: 'password', label: 'New Password' },
];

// Delays execution for a given duration — used for the post-success pause
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();

  // Multi-step flow state
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [verifiedOtp, setVerifiedOtp] = useState('');

  // OTP digit values and refs
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef(Array(OTP_LENGTH).fill(null));

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI feedback state
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Explicit flag for OTP expiry in Step 3 — drives restart button visibility
  const [otpExpired, setOtpExpired] = useState(false);

  // Resend cooldown timer (seconds remaining)
  const [cooldown, setCooldown] = useState(0);

  // Temporary success message for resend confirmation
  const [resendSuccess, setResendSuccess] = useState('');

  // ── Entry guard — redirect if already authenticated ──
  useEffect(() => {
    if (token && user) {
      navigate(getDefaultRoute(user.role), { replace: true });
    }
  }, [token, user, navigate]);

  // ── Resend cooldown countdown timer ──
  useEffect(() => {
    if (step !== 'otp' || cooldown <= 0) return;

    const intervalId = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [step, cooldown]);

  // ── Clear resend success message after 3 seconds ──
  useEffect(() => {
    if (!resendSuccess) return;

    const timeoutId = setTimeout(() => setResendSuccess(''), 3000);
    return () => clearTimeout(timeoutId);
  }, [resendSuccess]);

  // ── Returns the index of the current step (0-based) ──
  function getStepIndex() {
    return STEPS.findIndex((s) => s.key === step);
  }

  // ────────────────────────────────────────────────────────────
  // Step 1: Email
  // ────────────────────────────────────────────────────────────

  // Validates the email field and returns true if valid
  function validateEmail() {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Handles Step 1 submission — sends OTP to email
  async function handleEmailSubmit(e) {
    e.preventDefault();
    setApiError('');
    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      await forgotPasswordSchoolAdmin(email.trim());
      // Advance to OTP step and start the resend timer
      setOtpExpired(false);
      setStep('otp');
      setCooldown(RESEND_COOLDOWN);
      setFieldErrors({});
    } catch (err) {
      const message =
        err.response?.data?.message || 'Failed to send OTP. Please check your email address.';
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────
  // Step 2: OTP
  // ────────────────────────────────────────────────────────────

  // Handles typing a digit in a single OTP box
  const handleDigitChange = useCallback((index, value) => {
    if (value && !/^\d$/.test(value)) return;

    setFieldErrors((prev) => ({ ...prev, otp: '' }));
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

  // Handles keyboard navigation between OTP boxes
  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  // Handles pasting a multi-digit OTP string
  const handlePaste = useCallback((index, e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;

    setFieldErrors((prev) => ({ ...prev, otp: '' }));
    setApiError('');

    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < pasted.length && index + i < OTP_LENGTH; i++) {
        next[index + i] = pasted[i];
      }
      return next;
    });

    const lastFilledIndex = Math.min(index + pasted.length - 1, OTP_LENGTH - 1);
    inputRefs.current[lastFilledIndex]?.focus();
  }, []);

  // Clears all OTP boxes
  function resetOtpInputs() {
    setDigits(Array(OTP_LENGTH).fill(''));
  }

  // Handles Step 2 submission — validates OTP format and advances to password step
  async function handleOtpSubmit(e) {
    e.preventDefault();
    setApiError('');

    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setFieldErrors({ otp: 'Please enter the complete 6-digit code.' });
      return;
    }

    // Store the OTP for the final reset call in Step 3
    setVerifiedOtp(otp);
    setStep('password');
    setFieldErrors({});
  }

  // Handles resend OTP — calls API and restarts cooldown
  async function handleResend() {
    setApiError('');
    setIsLoading(true);
    try {
      await resendForgotPasswordOtp(email);
      setCooldown(RESEND_COOLDOWN);
      resetOtpInputs();
      setResendSuccess('A new code has been sent to your email.');
    } catch (err) {
      const message =
        err.response?.data?.message || 'Failed to resend OTP. Please try again.';
      setApiError(message);
    } finally {
      setIsLoading(false);
      // Focus first input after re-enabling
      inputRefs.current[0]?.focus();
    }
  }

  // ────────────────────────────────────────────────────────────
  // Step 3: New Password
  // ────────────────────────────────────────────────────────────

  // Validates password fields and returns true if valid
  function validatePasswords() {
    const errors = {};
    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Handles Step 3 submission — resets password via backend
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setApiError('');
    if (!validatePasswords()) return;

    setIsLoading(true);
    try {
      await resetPasswordSchoolAdmin(email, verifiedOtp, newPassword);
      // Brief loading pause for visual feedback before redirect
      await wait(800);
      navigate('/login', {
        state: { successMessage: 'Password reset successful. Please log in with your new password.' },
      });
    } catch (err) {
      const baseMessage =
        err.response?.data?.message ||
        'Failed to reset password. Your OTP may have expired — please try again.';

      const finalMessage =
        err.response?.status === 401
          ? `${baseMessage} Please try again from the beginning.`
          : baseMessage;

      setApiError(finalMessage);

      // Set otpExpired flag when backend returns 401 (OTP invalid or expired)
      if (err.response?.status === 401) {
        setOtpExpired(true);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Navigates back one step, clearing relevant state
  function goBack(targetStep) {
    setApiError('');
    setFieldErrors({});
    if (targetStep === 'email') {
      resetOtpInputs();
      setVerifiedOtp('');
    }
    if (targetStep === 'otp') {
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
    setOtpExpired(false);
    setStep(targetStep);
  }

  const handleRestart = () => {
    setOtpExpired(false);
    setStep('email');
    setEmail('');
    setVerifiedOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setApiError('');
    setFieldErrors({});
  };

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────

  const currentStepIndex = getStepIndex();

  return (
    <div className="relative min-h-screen flex">
      {/* Loading overlay — covers full page during API calls and post-success pause */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-slate-600">
              {step === 'password' ? 'Resetting password…' : 'Please wait…'}
            </span>
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
              Account Recovery
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed">
              Reset your password securely. We&apos;ll verify your identity with a one-time code sent to your registered email.
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

      {/* ── Right panel — step form ── */}
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            {/* ── Step indicator ── */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {STEPS.map((s, index) => (
                  <div key={s.key} className="flex items-center flex-1 last:flex-none">
                    {/* Step circle */}
                    <div className="flex flex-col items-center">
                      <div
                        aria-label={`Step ${index + 1} of 3: ${s.label}`}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                          index < currentStepIndex
                            ? 'bg-slate-800 text-white'
                            : index === currentStepIndex
                              ? 'bg-slate-800 text-white ring-2 ring-slate-300 ring-offset-2'
                              : 'border-2 border-slate-300 text-slate-400'
                        }`}
                      >
                        {index < currentStepIndex ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span className={`mt-1.5 text-[10px] font-medium ${
                        index <= currentStepIndex ? 'text-slate-700' : 'text-slate-400'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                    {/* Connector line between circles */}
                    {index < STEPS.length - 1 && (
                      <div className={`mx-2 h-px flex-1 -mt-4 ${
                        index < currentStepIndex ? 'bg-slate-700' : 'bg-slate-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* API-level error message */}
            {apiError && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100"
              >
                {apiError}
                {/* Offer restart link on OTP-expired errors in Step 3 */}
                {step === 'password' && otpExpired && (
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="mt-2 block font-medium text-red-800 underline underline-offset-2 hover:text-red-900"
                  >
                    Try again from the beginning
                  </button>
                )}
              </div>
            )}

            {/* Resend success message */}
            {resendSuccess && (
              <div
                role="status"
                className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-100"
              >
                {resendSuccess}
              </div>
            )}

            {/* ── Step 1: Email ── */}
            {step === 'email' && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-slate-900">Forgot Password</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Enter your registered email address and we&apos;ll send you a verification code.
                  </p>
                </div>

                <form onSubmit={handleEmailSubmit} noValidate>
                  <div className="mb-6">
                    <Label htmlFor="fp-email" className="mb-1.5 block text-slate-700">
                      Email address
                    </Label>
                    <Input
                      id="fp-email"
                      type="email"
                      placeholder="admin@school.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setApiError('');
                        setFieldErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      disabled={isLoading}
                      autoComplete="email"
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? 'fp-email-error' : undefined}
                      className={fieldErrors.email ? 'border-red-400 focus-visible:ring-red-300' : ''}
                    />
                    {fieldErrors.email && (
                      <p id="fp-email-error" className="mt-1 text-xs text-red-600">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 text-sm font-semibold"
                  >
                    {isLoading ? 'Sending…' : 'Send OTP'}
                  </Button>
                </form>

                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← Back to Login
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-slate-900">Enter Verification Code</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    A 6-digit code has been sent to{' '}
                    <span className="font-medium text-slate-700">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleOtpSubmit} noValidate>
                  {/* 6-digit OTP input group */}
                  <div className="mb-6">
                    <Label className="mb-2 block text-slate-700" id="fp-otp-group-label">
                      One-time password
                    </Label>
                    <div
                      className="flex items-center justify-between gap-2"
                      role="group"
                      aria-labelledby="fp-otp-group-label"
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
                          aria-invalid={!!fieldErrors.otp}
                          autoFocus={index === 0}
                          className={`h-12 w-10 sm:h-14 sm:w-12 rounded-lg border text-center text-lg font-semibold text-slate-900 outline-none transition-colors
                            focus:border-slate-500 focus:ring-2 focus:ring-slate-200
                            disabled:cursor-not-allowed disabled:opacity-50
                            ${fieldErrors.otp ? 'border-red-400' : 'border-slate-300'}
                          `}
                        />
                      ))}
                    </div>
                    {fieldErrors.otp && (
                      <p className="mt-2 text-xs text-red-600" role="alert">
                        {fieldErrors.otp}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 text-sm font-semibold"
                  >
                    Verify Code
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
                        disabled={isLoading}
                        className="font-medium text-slate-700 hover:text-slate-900 transition-colors underline underline-offset-2 disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    </div>
                  )}
                </div>

                {/* Back to email step */}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => goBack('email')}
                    className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: New Password ── */}
            {step === 'password' && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-slate-900">Set New Password</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose a strong password for your account.
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} noValidate>
                  {/* New password field */}
                  <div className="mb-4">
                    <Label htmlFor="fp-new-password" className="mb-1.5 block text-slate-700">
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="fp-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setApiError('');
                          setFieldErrors((prev) => ({ ...prev, newPassword: '' }));
                        }}
                        disabled={isLoading}
                        autoComplete="new-password"
                        aria-invalid={!!fieldErrors.newPassword}
                        aria-describedby={fieldErrors.newPassword ? 'fp-new-password-error' : undefined}
                        className={`pr-10 ${fieldErrors.newPassword ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {fieldErrors.newPassword && (
                      <p id="fp-new-password-error" className="mt-1 text-xs text-red-600">
                        {fieldErrors.newPassword}
                      </p>
                    )}
                  </div>

                  {/* Confirm password field */}
                  <div className="mb-6">
                    <Label htmlFor="fp-confirm-password" className="mb-1.5 block text-slate-700">
                      Confirm password
                    </Label>
                    <div className="relative">
                      <Input
                        id="fp-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setApiError('');
                          setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                        }}
                        disabled={isLoading}
                        autoComplete="new-password"
                        aria-invalid={!!fieldErrors.confirmPassword}
                        aria-describedby={fieldErrors.confirmPassword ? 'fp-confirm-password-error' : undefined}
                        className={`pr-10 ${fieldErrors.confirmPassword ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p id="fp-confirm-password-error" className="mt-1 text-xs text-red-600">
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 text-sm font-semibold"
                  >
                    {isLoading ? 'Resetting…' : 'Reset Password'}
                  </Button>
                </form>

                {/* Back to OTP step */}
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => goBack('otp')}
                    className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </>
            )}
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
