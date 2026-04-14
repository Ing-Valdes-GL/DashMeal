import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — attach token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("dm_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = await SecureStore.getItemAsync("dm_refresh_token");
        if (!refresh) throw new Error("No refresh token");
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
        const tokens = data.data as { access_token: string; refresh_token: string };
        await SecureStore.setItemAsync("dm_access_token", tokens.access_token);
        await SecureStore.setItemAsync("dm_refresh_token", tokens.refresh_token);
        original.headers.Authorization = `Bearer ${tokens.access_token}`;
        return api(original);
      } catch {
        await clearTokens();
        // Navigation to login handled by auth store listener
      }
    }
    return Promise.reject(error);
  }
);

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync("dm_access_token");
  await SecureStore.deleteItemAsync("dm_refresh_token");
};

export const apiGet = <T = any>(url: string, params?: Record<string, any>) =>
  api.get<T>(url, { params }).then((r) => r.data);

export const apiPost = <T = any>(url: string, data?: any) =>
  api.post<T>(url, data).then((r) => r.data);

export const apiPatch = <T = any>(url: string, data?: any) =>
  api.patch<T>(url, data).then((r) => r.data);

export const apiDelete = <T = any>(url: string) =>
  api.delete<T>(url).then((r) => r.data);
