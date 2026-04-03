import { create } from 'zustand';

interface AuthState {
  token: string | null;
  userId: string | null;
  displayName: string | null;
  isGuest: boolean;
  setAuth: (token: string, userId: string, displayName: string, isGuest: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  displayName: null,
  isGuest: false,
  setAuth: (token, userId, displayName, isGuest) =>
    set({ token, userId, displayName, isGuest }),
  clearAuth: () =>
    set({ token: null, userId: null, displayName: null, isGuest: false }),
}));
