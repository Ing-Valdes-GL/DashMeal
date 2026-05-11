"use client";
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { clearTokens } from "@/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  is_verified: boolean;
  role?: string;
  avatar_url?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isGuest: false,
  isLoading: true,

  login: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync("dm_access_token", accessToken);
    await SecureStore.setItemAsync("dm_refresh_token", refreshToken);
    set({ user, isAuthenticated: true, isGuest: false });
  },

  logout: async () => {
    await clearTokens();
    await SecureStore.deleteItemAsync("dm_user_role");
    set({ user: null, isAuthenticated: false, isGuest: false });
  },

  continueAsGuest: () => {
    set({ user: null, isAuthenticated: false, isGuest: true, isLoading: false });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
