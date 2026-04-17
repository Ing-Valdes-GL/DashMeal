import { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Linking, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { useAuthStore } from "@/stores/auth";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";

const SCREEN_W = Dimensions.get("window").width;
const MAP_W = Math.round(SCREEN_W - 32);
const MAP_H = 220;
const GPS_INTERVAL_MS = 15_000;

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1")
  .replace(/\/api\/v1\/?$/, "");

type Status = "assigned" | "picked_up" | "on_the_way" | "delivered" | "failed";
const ACTIVE_STATUSES: Status[] = ["assigned", "picked_up", "on_the_way"];

interface DeliveryDetail {
  id: string;
  status: Status;
  address: string;
  lat: number | null;
  lng: number | null;
  driver_id: string | null;
  conversation_id?: string | null;
  orders: {
    id: string;
    total: number;
    notes: string | null;
    user_id: string;
    users: { name: string; phone: string };
    order_items: Array<{ quantity: number; unit_price: number; products: { name_fr: string } }>;
    branches: { name: string; address: string; lat: number; lng: number; phone: string };
  };
}

const STATUS_COLOR: Record<Status, string> = {
  assigned:   "#6366f1",
  picked_up:  "#f59e0b",
  on_the_way: Colors.primary,
  delivered:  Colors.success,
  failed:     Colors.error,
};

const STATUS_LABEL: Record<Status, string> = {
  assigned:   "En route vers l'agence",
  picked_up:  "Commande récupérée — en route",
  on_the_way: "Livraison en cours",
  delivered:  "Livrée",
  failed:     "Échouée",
};

function buildMapUrl(destLat: number, destLng: number, driverLat?: number, driverLng?: number) {
  const params = new URLSearchParams({
    destlat: String(destLat),
    destlng: String(destLng),
    w: String(MAP_W),
    h: String(MAP_H),
    zoom: "14",
  });
  if (driverLat !== undefined && driverLng !== undefined) {
    params.append("driverlat", String(driverLat));
    params.append("driverlng", String(driverLng));
  }
  return `${API_BASE}/api/v1/maps/staticmap?${params.toString()}`;
}

function formatCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function openGoogleMapsNavigation(lat: number | null, lng: number | null, address: string) {
  let url: string;
  if (lat != null && lng != null) {
    // Precise coordinates → direct Google Maps navigation
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  } else {
    // Fallback to address search
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  Linking.openURL(url).catch(() =>
    Alert.alert("Erreur", "Impossible d'ouvrir Google Maps. Vérifiez qu'il est installé.")
  );
}

export default function DriverDeliveryDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const isAvailableMode = mode === "available";

  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch the right endpoint depending on mode
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["driver-delivery", id, mode],
    queryFn: () =>
      isAvailableMode
        ? apiGet<{ data: DeliveryDetail }>(`/delivery/available/${id}`)
        : apiGet<{ data: DeliveryDetail }>(`/delivery/my-deliveries/${id}`),
    enabled: !!id,
  });

  const delivery = data?.data;
  const isMyDelivery = !isAvailableMode && delivery?.driver_id === user?.id;
  const isActive = isMyDelivery && (delivery?.status === "assigned" || delivery?.status === "on_the_way");

  // ─── GPS sending ──────────────────────────────────────────────────────────────
  const sendPosition = async (lat: number, lng: number) => {
    try {
      await apiPost(`/delivery/${id}/position`, { lat, lng });
      setDriverPos({ lat, lng });
    } catch {}
  };

  const startGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    sendPosition(loc.coords.latitude, loc.coords.longitude);

    gpsIntervalRef.current = setInterval(async () => {
      try {
        const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        sendPosition(l.coords.latitude, l.coords.longitude);
      } catch {}
    }, GPS_INTERVAL_MS);
  };

  const stopGps = () => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
  };

  // Start GPS as soon as driver has an active delivery (any non-terminal status)
  useEffect(() => {
    if (isMyDelivery && delivery?.status && ACTIVE_STATUSES.includes(delivery.status)) {
      startGps();
    } else {
      stopGps();
    }
    return () => stopGps();
  }, [delivery?.status, isMyDelivery]);

  // ─── Accept delivery ──────────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: () => apiPost(`/delivery/${id}/accept`),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["driver-available"] });
      qc.invalidateQueries({ queryKey: ["driver-deliveries"] });
      // Navigate to the delivery in "mine" mode
      router.replace({ pathname: "/(driver)/delivery/[id]", params: { id, mode: "mine" } });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? "Impossible d'accepter cette livraison.";
      Alert.alert("Erreur", msg);
    },
  });

  // ─── Status update ────────────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: (newStatus: Status) =>
      apiPatch(`/delivery/${id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-delivery", id] });
      qc.invalidateQueries({ queryKey: ["driver-deliveries"] });
      refetch();
    },
    onError: (err: any) => {
      Alert.alert("Erreur", err?.response?.data?.error?.message ?? "Impossible de mettre à jour.");
    },
  });

  const handleStatusChange = (newStatus: Status) => {
    if (newStatus === "failed") {
      Alert.alert("Confirmer l'échec", "Marquer cette livraison comme échouée ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", style: "destructive", onPress: () => statusMutation.mutate(newStatus) },
      ]);
      return;
    }
    statusMutation.mutate(newStatus);
  };

  const openChat = () => {
    const convId = delivery?.conversation_id;
    if (convId) {
      router.push({ pathname: "/chat/[id]", params: { id: convId } });
    } else {
      Alert.alert("Chat", "La conversation sera disponible après acceptation.");
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Livraison introuvable</Text>
        <TouchableOpacity onPress={() => router.replace("/(driver)/deliveries")} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = isAvailableMode ? Colors.success : STATUS_COLOR[delivery.status];
  // Show map if we have destination GPS OR driver's own GPS position
  const mapUrl = delivery.lat && delivery.lng
    ? buildMapUrl(delivery.lat, delivery.lng, driverPos?.lat, driverPos?.lng)
    : driverPos?.lat && driverPos?.lng
      ? buildMapUrl(driverPos.lat, driverPos.lng, driverPos.lat, driverPos.lng)
      : null;

  const isDone = delivery.status === "delivered" || delivery.status === "failed";

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backCircle}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(driver)/deliveries")}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isAvailableMode ? "Livraison disponible" : "Ma livraison"}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]}>
            {isAvailableMode ? "Nouvelle" : STATUS_LABEL[delivery.status].split("—")[0].trim()}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Map */}
        {mapUrl ? (
          <View style={styles.mapWrap}>
            <Image source={{ uri: mapUrl }} style={styles.map} contentFit="cover" />
            {isMyDelivery && ACTIVE_STATUSES.includes(delivery.status) && (
              <View style={styles.liveChip}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>GPS actif</Text>
              </View>
            )}
          </View>
        ) : isMyDelivery && ACTIVE_STATUSES.includes(delivery.status) ? (
          <View style={[styles.mapWrap, styles.mapWaiting]}>
            <Ionicons name="navigate-circle-outline" size={36} color={Colors.primary} />
            <Text style={styles.mapWaitingText}>Localisation en cours…</Text>
          </View>
        ) : null}

        {/* Status banner (for my deliveries) */}
        {isMyDelivery && !isAvailableMode && (
          <View style={[styles.statusBanner, { backgroundColor: `${statusColor}12`, borderColor: `${statusColor}30` }]}>
            <Ionicons name="information-circle-outline" size={16} color={statusColor} />
            <Text style={[styles.statusBannerText, { color: statusColor }]}>
              {STATUS_LABEL[delivery.status]}
            </Text>
          </View>
        )}

        {/* Customer card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Client</Text>
          <View style={styles.row}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {delivery.orders?.users?.name?.slice(0, 2).toUpperCase() ?? "CL"}
              </Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.customerName}>{delivery.orders?.users?.name}</Text>
              <Text style={styles.customerPhone}>{delivery.orders?.users?.phone}</Text>
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${delivery.orders?.users?.phone}`)}
            >
              <Ionicons name="call" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color={Colors.text3} />
            <Text style={styles.addressText}>{delivery.address}</Text>
          </View>

          {/* Navigate button — visible on active deliveries */}
          {isMyDelivery && !isDone && (
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={() => openGoogleMapsNavigation(delivery.lat, delivery.lng, delivery.address)}
            >
              <Ionicons name="navigate" size={16} color="#fff" />
              <Text style={styles.navigateBtnText}>Naviguer vers le client</Text>
              <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}

          {delivery.orders?.notes && (
            <View style={[styles.row, { marginTop: 8 }]}>
              <Ionicons name="chatbubble-outline" size={14} color={Colors.text3} />
              <Text style={styles.notesText}>{delivery.orders.notes}</Text>
            </View>
          )}
        </View>

        {/* Order items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Commande</Text>
          {delivery.orders?.order_items?.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}×</Text>
              <Text style={styles.itemName}>{item.products?.name_fr}</Text>
              <Text style={styles.itemPrice}>{formatCFA(item.unit_price * item.quantity)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Text style={[styles.itemName, { fontWeight: "700" }]}>Total</Text>
            <Text style={[styles.itemPrice, { color: Colors.primary, fontWeight: "800" }]}>
              {formatCFA(delivery.orders?.total ?? 0)}
            </Text>
          </View>
        </View>

        {/* Branch (pickup point) */}
        {delivery.orders?.branches && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Point de récupération</Text>
            <Text style={styles.branchName}>{delivery.orders.branches.name}</Text>
            <View style={styles.row}>
              <Ionicons name="location-outline" size={14} color={Colors.text3} />
              <Text style={styles.branchAddress}>{delivery.orders.branches.address}</Text>
            </View>
            <TouchableOpacity
              style={styles.callBranchBtn}
              onPress={() => Linking.openURL(`tel:${delivery.orders.branches.phone}`)}
            >
              <Ionicons name="call-outline" size={14} color={Colors.primary} />
              <Text style={styles.callBranchText}>Appeler l'agence</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chat button (for my deliveries only) */}
        {isMyDelivery && !isDone && (
          <TouchableOpacity style={styles.chatBtn} onPress={openChat}>
            <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} />
            <Text style={styles.chatBtnText}>Chat avec le client</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actionsBar}>
        {/* Available → Accept */}
        {isAvailableMode && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary, acceptMutation.isPending && styles.actionBtnDisabled]}
            onPress={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Accepter cette livraison</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {/* Assigned → Picked up (at branch) */}
        {isMyDelivery && delivery.status === "assigned" && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary, statusMutation.isPending && styles.actionBtnDisabled]}
            onPress={() => handleStatusChange("picked_up")}
            disabled={statusMutation.isPending}
          >
            {statusMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="bag-check-outline" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Commande récupérée à l'agence</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {/* Picked up → On the way */}
        {isMyDelivery && delivery.status === "picked_up" && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary, statusMutation.isPending && styles.actionBtnDisabled]}
            onPress={() => handleStatusChange("on_the_way")}
            disabled={statusMutation.isPending}
          >
            {statusMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="navigate-outline" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>En route vers le client</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {/* On the way → Delivered / Failed */}
        {isMyDelivery && delivery.status === "on_the_way" && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, statusMutation.isPending && styles.actionBtnDisabled]}
              onPress={() => handleStatusChange("delivered")}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="checkmark-done-circle-outline" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Livraison effectuée</Text>
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger, statusMutation.isPending && styles.actionBtnDisabled]}
              onPress={() => handleStatusChange("failed")}
              disabled={statusMutation.isPending}
            >
              <Ionicons name="close-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Signaler un échec</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Done */}
        {isMyDelivery && isDone && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.border }]} onPress={() => router.replace("/(driver)/deliveries")}>
            <Ionicons name="arrow-back-outline" size={18} color={Colors.text2} />
            <Text style={[styles.actionBtnText, { color: Colors.text2 }]}>Retour aux livraisons</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  errorText: { fontSize: 16, color: Colors.text2 },
  backBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  backBtnText: { color: "#fff", fontWeight: "700" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    gap: 12,
  },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: Colors.text },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusPillText: { fontSize: 11, fontWeight: "700" },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  mapWrap: {
    borderRadius: Radius.lg, overflow: "hidden",
    height: MAP_H, position: "relative", ...Shadow.sm,
  },
  map: { width: "100%", height: MAP_H },
  mapWaiting: {
    alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primaryLight,
  },
  mapWaitingText: { fontSize: 13, fontWeight: "600", color: Colors.primary },
  liveChip: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { fontSize: 11, fontWeight: "700", color: "#fff" },

  statusBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: Radius.md, borderWidth: 1,
  },
  statusBannerText: { flex: 1, fontSize: 13, fontWeight: "600" },

  card: {
    backgroundColor: "#fff", borderRadius: Radius.lg,
    padding: 16, ...Shadow.sm,
  },
  cardTitle: {
    fontSize: 11, fontWeight: "700", color: Colors.text3,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },

  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  flex1: { flex: 1 },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  customerName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  customerPhone: { fontSize: 13, color: Colors.text3 },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.success, alignItems: "center", justifyContent: "center",
  },

  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },

  addressText: { flex: 1, fontSize: 14, color: Colors.text2, lineHeight: 20 },
  navigateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, paddingVertical: 11, borderRadius: Radius.md,
    backgroundColor: "#1A73E8",
  },
  navigateBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", flex: 1, textAlign: "center" },
  notesText: { flex: 1, fontSize: 13, color: Colors.text2, fontStyle: "italic" },

  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  itemQty: { fontSize: 13, fontWeight: "700", color: Colors.primary, width: 24 },
  itemName: { flex: 1, fontSize: 14, color: Colors.text },
  itemPrice: { fontSize: 13, fontWeight: "600", color: Colors.text2 },

  branchName: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 6 },
  branchAddress: { flex: 1, fontSize: 13, color: Colors.text2 },
  callBranchBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 10, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, alignSelf: "flex-start",
  },
  callBranchText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  chatBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 14, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  chatBtnText: { fontSize: 15, fontWeight: "700", color: Colors.primary },

  actionsBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: Colors.divider,
    padding: 16, paddingBottom: 32, gap: 10,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: Radius.full,
  },
  actionBtnPrimary: { backgroundColor: Colors.primary, ...Shadow.primary },
  actionBtnDanger: { backgroundColor: Colors.error },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
