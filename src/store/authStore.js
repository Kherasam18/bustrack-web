// src/store/authStore.js — Zustand auth store with localStorage persistence
import { create } from 'zustand';

const STORAGE_KEYS = {
  TOKEN: 'bustrack_token',
  USER: 'bustrack_user',
};

/**
 * Hydrates the initial state from localStorage.
 * Returns { user, token } or defaults if nothing is stored.
 */
function hydrateFromStorage() {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN) || null;
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    const user = raw ? JSON.parse(raw) : null;
    return { user, token };
  } catch (_) {
    return { user: null, token: null };
  }
}

const useAuthStore = create((set) => ({
  ...hydrateFromStorage(),

  /**
   * Persists the authenticated user and JWT token to state and localStorage.
   * @param {{ userId: string, role: string, school_id: string|null, name: string }} user
   * @param {string} token — JWT string
   */
  setAuth: (user, token) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (_) {
      // TODO: add logger
    }
    set({ user, token });
  },

  /**
   * Clears authentication state and removes persisted data from localStorage.
   */
  clearAuth: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (_) {
      // TODO: add logger
    }
    set({ user: null, token: null });
  },
}));

export default useAuthStore;
