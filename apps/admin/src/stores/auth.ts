"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setCookie, clearAuthCookies } from "@/lib/api";

export type AdminRole = "admin" | "superadmin";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: AdminRole;
  brand_id?: string;
  brand_name?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (user, accessToken, refreshToken) => {
        setCookie("dm_access_token", accessToken, 1);       // 1 jour (15min JWT + refresh)
        setCookie("dm_refresh_token", refreshToken, 30);    // 30 jours
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        clearAuthCookies();
        set({ user: null, isAuthenticated: false });
      },

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
    }),
    {
      name: "dash-meal-auth",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
