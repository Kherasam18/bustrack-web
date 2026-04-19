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
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Response interceptor — on a 401 Unauthorized response, clears auth state
 * and redirects the user to the login page. All other errors are re-thrown
 * so calling code can handle them.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
