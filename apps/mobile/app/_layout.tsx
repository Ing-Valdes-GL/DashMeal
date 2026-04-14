import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
});

function RootLayoutNav() {
  const { setUser } = useAuthStore();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await SecureStore.getItemAsync("dm_access_token");
        if (!token) { setUser(null); return; }
        const res = await apiGet("/users/me");
        setUser(res.data);
      } catch {
        setUser(null);
      }
    };
    restoreSession();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" options={{ animation: "none" }} />
      <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="product/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="order/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <StatusBar style="light" backgroundColor="#0a0f1e" />
        <RootLayoutNav />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
