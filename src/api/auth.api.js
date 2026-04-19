// src/api/auth.api.js — Authentication API calls for login flows
import api from './axios';

/**
 * Sends School Admin login request (Step 1 of 2-step flow).
 * On success the backend sends an OTP to the admin's email and returns
 * a short-lived twoFactorToken that must be forwarded to /verify-otp.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ twoFactorToken: string }>}
 */
export async function loginSchoolAdmin(email, password) {
  const response = await api.post('/api/auth/school-admin/login', { email, password });
  return response.data.data;
}

/**
 * Sends Super Admin login request (single-step flow).
 * Returns the final JWT token and user object immediately.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: { userId: string, role: string, name: string } }>}
 */
export async function loginSuperAdmin(email, password) {
  const response = await api.post('/api/auth/super-admin/login', { email, password });
  return response.data.data;
}

/**
 * Verifies the School Admin OTP using the short-lived twoFactorToken (Step 2 of 2-step flow).
 * The twoFactorToken is passed as an explicit Authorization header on this request only —
 * it is NOT read from authStore because the user is not yet fully authenticated.
 * @param {string} otp — 6-digit OTP string
 * @param {string} twoFactorToken — short-lived JWT from Step 1 login
 * @returns {Promise<{ token: string, user: { userId: string, role: string, school_id: string, name: string } }>}
 */
export async function verifySchoolAdminOtp(otp, twoFactorToken) {
  const response = await api.post(
    '/api/auth/school-admin/verify-otp',
    { otp },
    { headers: { Authorization: `Bearer ${twoFactorToken}` } },
  );
  return response.data.data;
}
