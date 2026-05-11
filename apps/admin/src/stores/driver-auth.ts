"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setCookie, clearAuthCookies } from "@/lib/api";

export interface DriverUser {
  id: string;
  name: string;
  phone: string;
  avatar_url?: string;
  is_available: boolean;
  vehicle_type?: string;
  brand_id: string;
}

interface DriverAuthState {
  driver: DriverUser | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  login: (driver: DriverUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateDriver: (partial: Partial<DriverUser>) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useDriverAuthStore = create<DriverAuthState>()(
  persist(
    (set) => ({
      driver: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      login: (driver, accessToken, refreshToken) => {
        setCookie("dm_driver_access_token", accessToken, 7);
        setCookie("dm_driver_refresh_token", refreshToken, 30);
        set({ driver, isAuthenticated: true });
      },

      logout: () => {
        clearAuthCookies();
        set({ driver: null, isAuthenticated: false });
      },

      updateDriver: (partial) =>
        set((state) => ({
          driver: state.driver ? { ...state.driver, ...partial } : null,
        })),
    }),
    {
      name: "dash-meal-driver-auth",
      partialize: (state) => ({ driver: state.driver, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
