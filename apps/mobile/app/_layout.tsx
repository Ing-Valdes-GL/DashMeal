import { useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { apiGet, apiPost } from "@/lib/api";
import { registerForPushNotifications } from "@/lib/notifications";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadow } from "@/lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
});

// ─── Rating Modal ─────────────────────────────────────────────────────────────

interface RatingModalProps {
  orderId: string | null;
  onClose: () => void;
}

function RatingModal({ orderId, onClose }: RatingModalProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!orderId || stars === 0) return;
    setLoading(true);
    try {
      await apiPost(`/orders/${orderId}/rate`, { rating: stars, comment: comment.trim() || undefined });
      setDone(true);
      setTimeout(() => { onClose(); setDone(false); setStars(0); setComment(""); }, 1500);
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer votre note. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={!!orderId} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ratingStyles.overlay}>
        <View style={ratingStyles.card}>
          {done ? (
            <View style={ratingStyles.doneWrap}>
              <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
              <Text style={ratingStyles.doneText}>Merci pour votre avis !</Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={ratingStyles.header}>
                <View style={ratingStyles.iconWrap}>
                  <Ionicons name="star" size={28} color={Colors.primary} />
                </View>
                <TouchableOpacity style={ratingStyles.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={20} color={Colors.text3} />
                </TouchableOpacity>
              </View>

              <Text style={ratingStyles.title}>Comment était votre expérience ?</Text>
              <Text style={ratingStyles.subtitle}>Notez votre commande pour nous aider à nous améliorer</Text>

              {/* Stars */}
              <View style={ratingStyles.stars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setStars(s)} style={ratingStyles.starBtn}>
                    <Ionicons
                      name={s <= stars ? "star" : "star-outline"}
                      size={36}
                      color={s <= stars ? "#FFC107" : Colors.border}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {stars > 0 && (
                <Text style={ratingStyles.ratingLabel}>
                  {["", "Très mauvais", "Mauvais", "Correct", "Bon", "Excellent !"][stars]}
                </Text>
              )}

              {/* Comment */}
              <TextInput
                style={ratingStyles.commentInput}
                placeholder="Laissez un commentaire (optionnel)"
                placeholderTextColor={Colors.text3}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={500}
                numberOfLines={3}
              />

              {/* Submit */}
              <TouchableOpacity
                style={[ratingStyles.submitBtn, (stars === 0 || loading) && ratingStyles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={stars === 0 || loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={ratingStyles.submitText}>Envoyer mon avis</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const ratingStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: {
    backgroundColor: Colors.bg, borderRadius: 24,
    padding: 24, width: "100%", maxWidth: 380, ...Shadow.sm,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  closeBtn: {
    marginLeft: "auto", width: 32, height: 32,
    borderRadius: 16, backgroundColor: Colors.inputBg,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: Colors.text3, lineHeight: 19, marginBottom: 20 },
  stars: { flexDirection: "row", gap: 4, justifyContent: "center", marginBottom: 8 },
  starBtn: { padding: 4 },
  ratingLabel: { textAlign: "center", fontSize: 13, fontWeight: "700", color: "#FFC107", marginBottom: 16 },
  commentInput: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.text, lineHeight: 20,
    minHeight: 80, textAlignVertical: "top", marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 15, alignItems: "center",
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  doneWrap: { alignItems: "center", paddingVertical: 24, gap: 12 },
  doneText: { fontSize: 18, fontWeight: "700", color: Colors.text },
});

// ─── Root navigation ──────────────────────────────────────────────────────────

function RootLayoutNav() {
  const { setUser } = useAuthStore();
  const router = useRouter();
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await SecureStore.getItemAsync("dm_access_token");
        if (!token) { setUser(null); return; }
        const savedRole = await SecureStore.getItemAsync("dm_user_role");
        if (savedRole === "driver") {
          const res = await apiGet("/delivery/me");
          setUser({ ...res.data, role: "driver" });
        } else {
          const res = await apiGet("/users/me");
          setUser(res.data);
          registerForPushNotifications().catch(() => {});
        }
      } catch {
        setUser(null);
      }
    };
    restoreSession();

    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;

      // Order ready → show rating popup
      if (data?.type === "order_ready" && typeof data.orderId === "string") {
        setRatingOrderId(data.orderId);
        return;
      }
      // Order delivered → also show rating popup
      if (data?.rateOrder === true && typeof data.orderId === "string") {
        setRatingOrderId(data.orderId);
        return;
      }
      // Navigate to order detail (stale_order or generic order notification)
      if (data?.screen === "order" && typeof data.orderId === "string") {
        router.push({ pathname: "/order/[id]", params: { id: data.orderId } });
        return;
      }
      // Navigate to chat (legacy: conversationId param)
      if (data?.screen === "chat" && typeof data.conversationId === "string") {
        router.push({ pathname: "/chat/[id]", params: { id: data.conversationId } });
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="product/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="order/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
        <Stack.Screen name="chat/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="tracking/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="(driver)" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="profile/personal"  options={{ presentation: "card" }} />
      <Stack.Screen name="profile/addresses" options={{ presentation: "card" }} />
      <Stack.Screen name="profile/payment"   options={{ presentation: "card" }} />
      <Stack.Screen name="profile/favorites" options={{ presentation: "card" }} />
      </Stack>

      <RatingModal orderId={ratingOrderId} onClose={() => setRatingOrderId(null)} />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <RootLayoutNav />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
