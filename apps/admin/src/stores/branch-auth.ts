"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setCookie, clearAuthCookies } from "@/lib/api";

export interface BranchManager {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  branch_id: string;
  brand_id: string;
}

interface BranchAuthState {
  manager: BranchManager | null;
  isAuthenticated: boolean;
  login: (manager: BranchManager, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useBranchAuthStore = create<BranchAuthState>()(
  persist(
    (set) => ({
      manager: null,
      isAuthenticated: false,

      login: (manager, accessToken, refreshToken) => {
        setCookie("dm_branch_access_token",  accessToken,  7);
        setCookie("dm_branch_refresh_token", refreshToken, 30);
        set({ manager, isAuthenticated: true });
      },

      logout: () => {
        document.cookie = "dm_branch_access_token=;  expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        document.cookie = "dm_branch_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        set({ manager: null, isAuthenticated: false });
      },
    }),
    {
      name: "dash-meal-branch-auth",
      partialize: (state) => ({ manager: state.manager, isAuthenticated: state.isAuthenticated }),
    }
  )
);
