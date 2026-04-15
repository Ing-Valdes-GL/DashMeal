import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { registerForPushNotifications } from "@/lib/notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
});

function RootLayoutNav() {
  const { setUser } = useAuthStore();
  const router = useRouter();
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await SecureStore.getItemAsync("dm_access_token");
        if (!token) { setUser(null); return; }
        const res = await apiGet("/users/me");
        setUser(res.data);
        // Enregistrer pour les notifications push après restauration de session
        registerForPushNotifications().catch(() => {});
      } catch {
        setUser(null);
      }
    };
    restoreSession();

    // Listener : notif reçue en premier plan (affichage géré par setNotificationHandler)
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    // Listener : utilisateur clique sur une notification → naviguer vers la commande
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.screen === "order" && typeof data.orderId === "string") {
        router.push({ pathname: "/order/[id]", params: { id: data.orderId } });
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
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
