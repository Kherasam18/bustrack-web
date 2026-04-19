// src/hooks/useAuth.js — Bridge hook — exposes authStore state and actions via a single import
import useAuthStore from '../store/authStore';

// Returns auth state and actions from the central Zustand store
export default function useAuth() {
  return useAuthStore();
}
