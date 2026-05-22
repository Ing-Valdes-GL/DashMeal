import axios, { type AxiosError } from "axios";
import { toast } from "@/hooks/use-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://hopeful-gentleness-production.up.railway.app/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ─── Injecter le token à chaque requête ──────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("dm_access_token="))
      ?.split("=")[1];
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Gérer les erreurs d'authentification ────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = document.cookie
          .split("; ")
          .find((row) => row.startsWith("dm_refresh_token="))
          ?.split("=")[1];
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token } = data.data;

        // Mettre à jour les cookies
        setCookie("dm_access_token", access_token, 7);
        setCookie("dm_refresh_token", refresh_token, 30);

        original.headers!.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        clearAuthCookies();
        toast.warning("Session expirée", "Veuillez vous reconnecter.");
        window.location.href = `/${getCurrentLocale()}/login`;
      }
    }
    return Promise.reject(error);
  }
);

// ─── Helpers cookies ─────────────────────────────────────────────────────────
export function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict${secure}`;
}

export function clearAuthCookies() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `dm_access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict${secure}`;
  document.cookie = `dm_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict${secure}`;
}

function getCurrentLocale() {
  const path = window.location.pathname.split("/");
  return ["fr", "en"].includes(path[1]) ? path[1] : "fr";
}

// ─── Wrappers API ─────────────────────────────────────────────────────────────
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<{ success: true; data: T }>(url, { params });
  return data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<{ success: true; data: T }>(url, body);
  return data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<{ success: true; data: T }>(url, body);
  return data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const { data } = await api.delete<{ success: true; data: T }>(url);
  return data.data;
}

export async function apiUpload<T>(url: string, file: File, fieldName = "image"): Promise<T> {
  const form = new FormData();
  form.append(fieldName, file);
  const { data } = await api.post<{ success: true; data: T }>(url, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}
