/**
 * Tracking Screen — /tracking/:orderId
 *
 * Suivi en temps réel du livreur sur une carte.
 * La position est rafraîchie toutes les 5 secondes via polling REST.
 * La carte est rendue avec Google Maps Static API (proxy backend) —
 * compatible Expo Go, aucun module natif requis.
 */

import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, RefreshControl, Linking, Alert, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { apiGet } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverPosition {
  lat: number;
  lng: number;
  updated_at: string;
}

interface TrackingData {
  id: string;
  status: string;
  address: string;
  lat: number | null;
  lng: number | null;
  started_at: string | null;
  delivered_at: string | null;
  drivers: { name: string; phone: string } | null;
  driver_positions: DriverPosition | DriverPosition[] | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000; // rafraîchir toutes les 5 secondes
const { width: SCREEN_W } = Dimensions.get("window");
const MAP_W = Math.round(SCREEN_W - 32); // 16px padding each side
const MAP_H = 240;

// URL de base de l'API (sans /api/v1, on l'ajoute manuellement pour le staticmap)
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1")
  .replace(/\/api\/v1\/?$/, "");

function buildStaticMapUrl(
  destLat: number | null,
  destLng: number | null,
  driverLat?: number | null,
  driverLng?: number | null,
): string | null {
  if (destLat == null || destLng == null) return null;
  const params: string[] = [
    `destlat=${destLat}`,
    `destlng=${destLng}`,
    `size=${MAP_W}x${MAP_H}`,
    `zoom=14`,
  ];
  if (driverLat != null && driverLng != null) {
    params.push(`driverlat=${driverLat}`);
    params.push(`driverlng=${driverLng}`);
  }
  return `${API_BASE}/api/v1/maps/staticmap?${params.join("&")}`;
}

// ─── Libellés statut livraison ────────────────────────────────────────────────

const DELIVERY_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: "En attente de livreur",   color: "#FFC107", icon: "time-outline" },
  assigned:   { label: "Livreur assigné",          color: "#2196F3", icon: "bicycle-outline" },
  picked_up:  { label: "Commande récupérée",       color: "#9C27B0", icon: "bag-outline" },
  on_the_way: { label: "Livreur en route",         color: Colors.primary, icon: "navigate-outline" },
  delivered:  { label: "Commande livrée",          color: Colors.success, icon: "checkmark-done-circle" },
  failed:     { label: "Livraison échouée",        color: Colors.error, icon: "close-circle-outline" },
};

// ─── Composant ────────────────────────────────────────────────────────────────

export default function TrackingScreen() {
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [mapKey, setMapKey] = useState(0); // force re-render de l'image map
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTracking = async (silent = false) => {
    try {
      const resp = await apiGet(`/delivery/track/${orderId}`);
      const data: TrackingData = resp?.data;
      setTracking(data);
      setLastUpdate(new Date());
      setMapKey((k) => k + 1); // force l'image à se rafraîchir
    } catch (err: any) {
      if (!silent) {
        Alert.alert("Erreur", "Impossible de charger le suivi. Vérifiez votre connexion.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTracking();
    pollingRef.current = setInterval(() => fetchTracking(true), POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [orderId]);

  // Arrêter le polling si livraison terminée
  useEffect(() => {
    if (tracking?.status === "delivered" || tracking?.status === "failed") {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  }, [tracking?.status]);

  // ── Données dérivées ───────────────────────────────────────────────────────
  const driverPos = tracking?.driver_positions
    ? Array.isArray(tracking.driver_positions)
      ? tracking.driver_positions[0]
      : tracking.driver_positions
    : null;

  const destLat = tracking?.lat;
  const destLng = tracking?.lng;
  const mapUrl = buildStaticMapUrl(destLat ?? null, destLng ?? null, driverPos?.lat, driverPos?.lng);

  const statusInfo = DELIVERY_STATUS[tracking?.status ?? ""] ?? {
    label: tracking?.status ?? "—",
    color: Colors.text3,
    icon: "ellipsis-horizontal",
  };

  const isActive = tracking && !["delivered", "failed"].includes(tracking.status);

  // ── Appeler le livreur ─────────────────────────────────────────────────────
  const callDriver = () => {
    const phone = tracking?.drivers?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert("Erreur", "Impossible d'ouvrir l'application téléphone.")
    );
  };

  // ── Rendu chargement initial ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loaderText}>Chargement du suivi…</Text>
      </View>
    );
  }

  if (!tracking) {
    return (
      <View style={styles.loader}>
        <Ionicons name="location-outline" size={56} color={Colors.border} />
        <Text style={styles.loaderText}>Suivi introuvable</Text>
        <TouchableOpacity style={styles.backBtnCenter} onPress={() => router.back()}>
          <Text style={styles.backBtnCenterText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Suivi de livraison</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchTracking(); }}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── Carte ────────────────────────────────────────────────────────── */}
        <View style={styles.mapContainer}>
          {mapUrl ? (
            <Image
              key={mapKey}
              source={{ uri: mapUrl }}
              style={styles.mapImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map-outline" size={40} color={Colors.border} />
              <Text style={styles.mapPlaceholderText}>
                {driverPos ? "Carte indisponible" : "En attente de la position du livreur…"}
              </Text>
            </View>
          )}

          {/* Légende */}
          {mapUrl && (
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#2196F3" }]} />
                <Text style={styles.legendText}>Livreur</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                <Text style={styles.legendText}>Destination</Text>
              </View>
            </View>
          )}

          {/* Badge rafraîchissement */}
          {isActive && lastUpdate && (
            <View style={styles.refreshBadge}>
              <Ionicons name="sync-outline" size={10} color={Colors.text3} />
              <Text style={styles.refreshText}>
                màj {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </Text>
            </View>
          )}
        </View>

        {/* ── Statut ───────────────────────────────────────────────────────── */}
        <View style={styles.statusCard}>
          <View style={[styles.statusIconWrap, { backgroundColor: statusInfo.color + "18" }]}>
            <Ionicons name={statusInfo.icon as any} size={26} color={statusInfo.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Statut</Text>
            <Text style={[styles.statusValue, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
          {isActive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* ── Livreur ──────────────────────────────────────────────────────── */}
        {tracking.drivers ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Votre livreur</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverAvatar}>
                <Ionicons name="bicycle" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{tracking.drivers.name}</Text>
                <Text style={styles.driverPhone}>{tracking.drivers.phone}</Text>
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={callDriver}>
                <Ionicons name="call" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.waitingCard}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.waitingText}>Recherche d'un livreur disponible…</Text>
            </View>
          </View>
        )}

        {/* ── Adresse de livraison ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adresse de livraison</Text>
          <View style={styles.addressCard}>
            <View style={styles.addressIconWrap}>
              <Ionicons name="location" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.addressText}>{tracking.address}</Text>
          </View>
        </View>

        {/* ── Position livreur ─────────────────────────────────────────────── */}
        {driverPos && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Position en temps réel</Text>
            <View style={styles.coordsCard}>
              <View style={styles.coordRow}>
                <Ionicons name="navigate-outline" size={14} color={Colors.text3} />
                <Text style={styles.coordText}>
                  {driverPos.lat.toFixed(5)}, {driverPos.lng.toFixed(5)}
                </Text>
              </View>
              <Text style={styles.coordTime}>
                Dernière mise à jour :{" "}
                {new Date(driverPos.updated_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </Text>
            </View>
          </View>
        )}

        {/* ── Livraison terminée ───────────────────────────────────────────── */}
        {tracking.status === "delivered" && (
          <View style={styles.section}>
            <View style={styles.doneCard}>
              <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.doneTitle}>Commande livrée !</Text>
                {tracking.delivered_at && (
                  <Text style={styles.doneTime}>
                    {new Date(tracking.delivered_at).toLocaleString("fr-FR", {
                      hour: "2-digit", minute: "2-digit", day: "numeric", month: "short",
                    })}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: Colors.pageBg },
  loaderText: { fontSize: 14, color: Colors.text3 },
  backBtnCenter: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  backBtnCenterText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  headerSafe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },

  // Map
  mapContainer: {
    margin: 16,
    borderRadius: Radius.lg,
    overflow: "hidden",
    height: MAP_H,
    backgroundColor: Colors.inputBg,
    position: "relative",
    ...Shadow.sm,
  },
  mapImage: { width: "100%", height: "100%" },
  mapPlaceholder: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 10,
  },
  mapPlaceholderText: { fontSize: 13, color: Colors.text3, textAlign: "center", paddingHorizontal: 24 },
  mapLegend: {
    position: "absolute", bottom: 10, right: 10,
    flexDirection: "row", gap: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: "600", color: Colors.text2 },
  refreshBadge: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4,
  },
  refreshText: { fontSize: 9, color: Colors.text3 },

  // Status
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.sm,
  },
  statusIconWrap: {
    width: 52, height: 52, borderRadius: Radius.md,
    alignItems: "center", justifyContent: "center",
  },
  statusLabel: { fontSize: 11, color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statusValue: { fontSize: 15, fontWeight: "700" },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFF0E8", borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  liveText: { fontSize: 10, fontWeight: "800", color: Colors.primary, letterSpacing: 1 },

  // Section
  section: { paddingHorizontal: 16, marginTop: 12 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: Colors.text3,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
  },

  // Driver card
  driverCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 14, ...Shadow.sm,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  driverName: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 2 },
  driverPhone: { fontSize: 13, color: Colors.text3 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.success, alignItems: "center", justifyContent: "center",
    ...Shadow.sm,
  },

  waitingCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 14, ...Shadow.sm,
  },
  waitingText: { flex: 1, fontSize: 13, color: Colors.text2 },

  // Address
  addressCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 14, ...Shadow.sm,
  },
  addressIconWrap: {
    width: 32, height: 32, borderRadius: Radius.xs,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  addressText: { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 20 },

  // Coords
  coordsCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 14, gap: 6, ...Shadow.sm,
  },
  coordRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  coordText: { fontSize: 13, color: Colors.text, fontFamily: "monospace" },
  coordTime: { fontSize: 11, color: Colors.text3 },

  // Done
  doneCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.success + "12",
    borderRadius: Radius.lg, padding: 16,
    borderWidth: 1, borderColor: Colors.success + "40",
  },
  doneTitle: { fontSize: 15, fontWeight: "700", color: Colors.success },
  doneTime: { fontSize: 12, color: Colors.text3, marginTop: 2 },
});
