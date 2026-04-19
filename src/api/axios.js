// src/api/axios.js — Configured Axios instance with JWT and 401 interceptors
import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor — attaches the JWT Bearer token from the auth store
 * to every outgoing request when a token is available.
 */
api.interceptors.request.use(
  (config) => {
    // Skip auth header injection if the request opts out (e.g. twoFactorToken flows)
    if (config.skipAuth) return config;

    const { token } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Response interceptor — on a 401 Unauthorized response from an active session,
 * clears auth state and redirects to login. Unauthenticated 401s (e.g. login
 * form wrong-password) are passed through so calling code can handle them.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const { token } = useAuthStore.getState();
      if (token) {
        // Active session got a 401 — force logout
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
      // No active session — let the calling code handle the 401 (e.g. login form)
    }
    return Promise.reject(error);
  },
);

export default api;
