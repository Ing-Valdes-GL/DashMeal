import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://hopeful-gentleness-production.up.railway.app/api/v1";

export const branchApi = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

branchApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("dm_branch_access_token="))
      ?.split("=")[1];
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

branchApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = document.cookie
          .split("; ")
          .find((row) => row.startsWith("dm_branch_refresh_token="))
          ?.split("=")[1];
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_URL}/branch-auth/refresh`, { refresh_token: refreshToken });
        const { access_token, refresh_token } = data.data;

        const expires7  = new Date(Date.now() + 7  * 864e5).toUTCString();
        const expires30 = new Date(Date.now() + 30 * 864e5).toUTCString();
        document.cookie = `dm_branch_access_token=${access_token};  expires=${expires7};  path=/; SameSite=Strict`;
        document.cookie = `dm_branch_refresh_token=${refresh_token}; expires=${expires30}; path=/; SameSite=Strict`;

        original.headers!.Authorization = `Bearer ${access_token}`;
        return branchApi(original);
      } catch {
        document.cookie = "dm_branch_access_token=;  expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        document.cookie = "dm_branch_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        const path = window.location.pathname.split("/");
        const locale = ["fr", "en"].includes(path[1]) ? path[1] : "fr";
        window.location.href = `/${locale}/branch/login`;
      }
    }
    return Promise.reject(error);
  }
);

export async function branchApiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await branchApi.get<{ success: true; data: T }>(url, { params });
  return data.data;
}

export async function branchApiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await branchApi.post<{ success: true; data: T }>(url, body);
  return data.data;
}

export async function branchApiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await branchApi.patch<{ success: true; data: T }>(url, body);
  return data.data;
}

export async function branchApiPut<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await branchApi.put<{ success: true; data: T }>(url, body);
  return data.data;
}
