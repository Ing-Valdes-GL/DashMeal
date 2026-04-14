import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { clearTokens } from "@/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  is_verified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync("dm_access_token", accessToken);
    await SecureStore.setItemAsync("dm_refresh_token", refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
