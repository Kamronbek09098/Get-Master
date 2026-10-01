import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env } from '@/lib/env';
import type { Role } from '@/types/common';

interface AuthState {
  hasSession: boolean;
  preferredRole: Role | null;
  pendingPhone: string | null;
  devCode: string | null;
  deviceLimit: { max: number; active: number } | null;
  setDeviceLimit: (limit: { max: number; active: number } | null) => void;
  setDevCode: (code: string | null) => void;
  setSession: (hasSession: boolean) => void;
  setPreferredRole: (role: Role | null) => void;
  setPendingPhone: (phone: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hasSession: false,
      preferredRole: null,
      pendingPhone: null,
      devCode: null,
      deviceLimit: null,
      setDeviceLimit: (deviceLimit) => set({ deviceLimit }),
      setDevCode: (devCode) => set({ devCode }),
      setSession: (hasSession) => set({ hasSession }),
      setPreferredRole: (preferredRole) => set({ preferredRole: env.appRole ?? preferredRole }),
      setPendingPhone: (pendingPhone) => set({ pendingPhone }),
      clear: () => set({ hasSession: false, pendingPhone: null, devCode: null, deviceLimit: null }),
    }),
    {
      name: 'getmaster.auth-ui',
      partialize: (state) => ({ hasSession: state.hasSession, preferredRole: state.preferredRole }),
    },
  ),
);

if (env.appRole) useAuthStore.setState({ preferredRole: env.appRole });
