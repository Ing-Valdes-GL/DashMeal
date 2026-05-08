/**
 * Suivi GPS temps réel — /tracking/:orderId
 *
 * Carte react-native-maps avec markers pour la destination et le livreur.
 * Position livreur rafraîchie toutes les 10 s via React Query refetchInterval.
 * Bottom sheet fixe avec: nom du livreur, étapes commande, ETA, bouton appel.
 *
 * API: GET /tracking/delivery/:order_id
 *   → { lat, lng, heading, driver_name, driver_phone, order_status, estimated_minutes }
 *   → 404 si livreur non encore assigné
 */

import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { apiGet } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "preparing" | "ready" | "delivering" | "delivered";

interface TrackingData {
  lat: number | null;
  lng: number | null;
  heading: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  order_status: OrderStatus;
  estimated_minutes: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get("window");
const BOTTOM_SHEET_H = 260;
const MAP_H = SCREEN_H - BOTTOM_SHEET_H;

const ORDER_STEPS: { key: OrderStatus; labelFr: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "preparing",  labelFr: "En préparation", icon: "restaurant-outline" },
  { key: "ready",      labelFr: "Prêt",           icon: "checkmark-circle-outline" },
  { key: "delivering", labelFr: "En livraison",   icon: "bicycle-outline" },
  { key: "delivered",  labelFr: "Livré",           icon: "home-outline" },
];

function getStepIndex(status: OrderStatus): number {
  return ORDER_STEPS.findIndex((s) => s.key === status);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TrackingScreen() {
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  // ── Query — polls every 10 s ─────────────────────────────────────────────
  const { data, isLoading, error } = useQuery<{ success: boolean; data: TrackingData }>({
    queryKey: ["tracking", orderId],
    queryFn: () => apiGet(`/tracking/delivery/${orderId}`),
    refetchInterval: 10_000,
    retry: (count, err: any) => {
      // Don't retry on 404 (driver not assigned yet) — just show waiting state
      if (err?.response?.status === 404) return false;
      return count < 3;
    },
  });

  const tracking = data?.data ?? null;
  const noDriver = (error as any)?.response?.status === 404;

  // Delivery address marker (dest)
  const destCoord =
    tracking?.lat && tracking?.lng
      ? { latitude: tracking.lat, longitude: tracking.lng }
      : null;

  // Driver marker
  const driverCoord =
    tracking?.lat && tracking?.lng && tracking?.driver_name
      ? { latitude: tracking.lat, longitude: tracking.lng }
      : null;

  // ── Call driver ──────────────────────────────────────────────────────────
  const handleCall = () => {
    const phone = tracking?.driver_phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert("Erreur", "Impossible d'ouvrir l'application téléphone.")
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Chargement du suivi…</Text>
      </View>
    );
  }

  // ── Error (not 404) ──────────────────────────────────────────────────────
  if (error && !noDriver) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={52} color={Colors.error} />
        <Text style={styles.loadingText}>Impossible de charger le suivi</Text>
        <TouchableOpacity style={styles.backBtnFallback} onPress={() => router.back()}>
          <Text style={styles.backBtnFallbackText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stepIndex = tracking ? getStepIndex(tracking.order_status) : -1;

  // ── Region ───────────────────────────────────────────────────────────────
  const mapRegion = destCoord
    ? {
        latitude: destCoord.latitude,
        longitude: destCoord.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        // Yaoundé default
        latitude: 3.848,
        longitude: 11.502,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={mapRegion}
        region={mapRegion}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Destination marker */}
        {destCoord && (
          <Marker
            coordinate={destCoord}
            title="Adresse de livraison"
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.destMarker}>
              <Ionicons name="location" size={28} color={Colors.error} />
            </View>
          </Marker>
        )}

        {/* Driver marker */}
        {driverCoord && (
          <Marker
            coordinate={driverCoord}
            title={tracking?.driver_name ?? "Livreur"}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Ionicons name="bicycle" size={18} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Route polyline — straight line when we have both coords */}
        {destCoord && driverCoord && (
          <Polyline
            coordinates={[driverCoord, destCoord]}
            strokeColor={Colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>

      {/* ── Back button overlay ──────────────────────────────────────────── */}
      <SafeAreaView style={styles.backOverlay} edges={["top"]} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Bottom sheet ─────────────────────────────────────────────────── */}
      <View style={styles.bottomSheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* ── No driver yet ─────────────────────────────────────────────── */}
        {(noDriver || !tracking?.driver_name) ? (
          <View style={styles.waitingRow}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.waitingTitle}>En attente du livreur</Text>
              <Text style={styles.waitingSubtitle}>
                Un livreur va être assigné à votre commande
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* ── Driver row ────────────────────────────────────────────── */}
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Ionicons name="bicycle" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{tracking.driver_name}</Text>
                {tracking.estimated_minutes != null && (
                  <Text style={styles.eta}>
                    Arrivée estimée : {tracking.estimated_minutes} min
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Ionicons name="call" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* ── Order status steps ────────────────────────────────────── */}
            <View style={styles.stepsRow}>
              {ORDER_STEPS.map((step, i) => {
                const done    = i <= stepIndex;
                const active  = i === stepIndex;
                const isLast  = i === ORDER_STEPS.length - 1;
                return (
                  <React.Fragment key={step.key}>
                    <View style={styles.stepItem}>
                      <View
                        style={[
                          styles.stepCircle,
                          done && styles.stepCircleDone,
                          active && styles.stepCircleActive,
                        ]}
                      >
                        <Ionicons
                          name={step.icon}
                          size={14}
                          color={done ? "#fff" : Colors.border}
                        />
                      </View>
                      <Text
                        style={[styles.stepLabel, done && styles.stepLabelDone]}
                        numberOfLines={1}
                      >
                        {step.labelFr}
                      </Text>
                    </View>
                    {!isLast && (
                      <View
                        style={[styles.stepLine, i < stepIndex && styles.stepLineDone]}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.pageBg },
  centered:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: Colors.pageBg },
  loadingText: { fontSize: 14, color: Colors.text3 },
  backBtnFallback: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  backBtnFallbackText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Map
  map: { width: "100%", height: MAP_H },

  // Back overlay
  backOverlay: { position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "box-none" },
  backBtn: {
    margin: 16,
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    alignItems: "center", justifyContent: "center",
    ...Shadow.md,
  },

  // Custom markers
  destMarker:   { alignItems: "center", justifyContent: "center" },
  driverMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
    ...Shadow.md,
  },

  // Bottom sheet
  bottomSheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: BOTTOM_SHEET_H,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: 20,
    paddingBottom: 24,
    ...Shadow.md,
  },
  handle: {
    alignSelf: "center",
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: 10, marginBottom: 18,
  },

  // Waiting
  waitingRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.lg, padding: 16,
  },
  waitingTitle: { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 2 },
  waitingSubtitle: { fontSize: 12, color: Colors.text3 },

  // Driver row
  driverRow: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18,
  },
  driverAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  driverName: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 2 },
  eta:        { fontSize: 12, color: Colors.text3 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.success,
    alignItems: "center", justifyContent: "center",
    ...Shadow.sm,
  },

  // Steps
  stepsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  stepItem:  { alignItems: "center", gap: 5, flex: 1 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.inputBg,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.border,
  },
  stepCircleDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepCircleActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  stepLabel: {
    fontSize: 9, fontWeight: "600", color: Colors.text3,
    textAlign: "center",
  },
  stepLabelDone: { color: Colors.primary },
  stepLine: {
    flex: 1, height: 2,
    backgroundColor: Colors.border,
    marginTop: 15,
    alignSelf: "flex-start",
  },
  stepLineDone: { backgroundColor: Colors.primary },
});
