import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getStorage } from '../lib/storage';

export type AuthProvider = 'email' | 'google' | 'apple';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'dealer' | 'collector' | 'admin';
  verified: boolean;
  approved: boolean;
  auth_provider?: AuthProvider;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  _hasHydrated: boolean;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      _hasHydrated: false,

      setUser: (user) => set({
        user,
        isAuthenticated: true,
        isAdmin: user.role === 'admin'
      }),

      setToken: (token) => set({ token }),

      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
        isAdmin: user.role === 'admin'
      }),

      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        isAdmin: false
      }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => getStorage()),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
      }),
    }
  )
);
