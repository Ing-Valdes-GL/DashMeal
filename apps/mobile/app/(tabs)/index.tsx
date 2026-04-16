import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import { Colors, Radius, Shadow } from "@/lib/theme";

const BRANCH_TYPES = [
  { key: "all",        label: "Tous",         icon: "apps-outline" as const },
  { key: "restaurant", label: "Restaurant",   icon: "restaurant-outline" as const },
  { key: "supermarket",label: "Supermarché",  icon: "storefront-outline" as const },
  { key: "cafe",       label: "Café",         icon: "cafe-outline" as const },
  { key: "bakery",     label: "Boulangerie",  icon: "pizza-outline" as const },
  { key: "pharmacy",   label: "Pharmacie",    icon: "medkit-outline" as const },
];

interface Branch {
  id: string; name: string; city: string; address: string; type?: string;
  distance_km?: number | null;
  brands?: { id: string; name: string; logo_url: string | null };
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeType, setActiveType] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Request GPS once on mount — silent if denied
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        // GPS unavailable — fall back to showing all branches
      }
    })();
  }, []);

  const { data: branchesRes, isLoading, refetch } = useQuery<{ success: boolean; data: Branch[] }>({
    queryKey: ["branches-home", userCoords?.lat, userCoords?.lng],
    queryFn: () => apiGet("/branches/nearby", userCoords
      ? { lat: userCoords.lat, lng: userCoords.lng }
      : undefined),
  });
  const allBranches = branchesRes?.data ?? [];
  const branches = activeType === "all"
    ? allBranches
    : allBranches.filter((b) => b.type === activeType);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const firstName = user?.name?.split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={Colors.primary} />
            <Text style={styles.locationLabel}>
              {userCoords ? "Agences près de vous" : "Bienvenue !"}
            </Text>
          </View>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>{greeting},{"\n"}{firstName || "Bonne visite"} 👋</Text>
            </View>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push("/(tabs)/profile")}
            >
              {(user as any)?.avatar_url ? (
                <Image
                  source={{ uri: (user as any).avatar_url }}
                  style={styles.avatarCircle}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push("/(tabs)/catalog")}
            activeOpacity={0.8}
          >
            <Ionicons name="search-outline" size={18} color={Colors.text3} />
            <Text style={styles.searchText}>Rechercher un produit ou une agence…</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 90 }}
      >
        {/* ── Catégories ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Toutes les catégories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {BRANCH_TYPES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catPill, activeType === cat.key && styles.catPillActive]}
                onPress={() => setActiveType(cat.key)}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={activeType === cat.key ? "#fff" : Colors.text2}
                />
                <Text style={[styles.catLabel, activeType === cat.key && styles.catLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Agences ────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {userCoords ? "Agences les plus proches" : "Agences ouvertes"}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/catalog")}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : branches.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={40} color={Colors.border} />
              <Text style={styles.emptyText}>Aucune agence disponible</Text>
            </View>
          ) : (
            branches.map((branch) => (
              <TouchableOpacity
                key={branch.id}
                style={styles.card}
                onPress={() => router.push("/(tabs)/catalog")}
                activeOpacity={0.85}
              >
                {/* Image */}
                <View style={styles.cardImg}>
                  {branch.brands?.logo_url ? (
                    <Image
                      source={{ uri: branch.brands.logo_url }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.cardImgFallback}>
                      <Ionicons name="storefront-outline" size={36} color={Colors.primary} />
                    </View>
                  )}
                  {/* Type badge */}
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{branch.type ?? "autre"}</Text>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName}>{branch.brands?.name ?? branch.name}</Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={11} color="#FFC107" />
                      <Text style={styles.ratingText}>4.7</Text>
                    </View>
                  </View>
                  <Text style={styles.cardAddress} numberOfLines={1}>
                    {branch.address}
                  </Text>
                  <View style={styles.cardMeta}>
                    {branch.distance_km != null ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="navigate-outline" size={12} color={Colors.primary} />
                        <Text style={[styles.metaText, { color: Colors.primary, fontWeight: "600" }]}>
                          {branch.distance_km < 1
                            ? `${Math.round(branch.distance_km * 1000)} m`
                            : `${branch.distance_km.toFixed(1)} km`}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={12} color={Colors.text3} />
                        <Text style={styles.metaText}>20 – 30 min</Text>
                      </View>
                    )}
                    <View style={styles.metaDot} />
                    <View style={styles.metaItem}>
                      <Ionicons name="location-outline" size={12} color={Colors.text3} />
                      <Text style={styles.metaText}>{branch.city}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  // Header
  header: {
    backgroundColor: Colors.bg, paddingHorizontal: 20,
    paddingTop: 8, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  locationLabel: { fontSize: 12, color: Colors.text2, fontWeight: "500" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  greeting: { fontSize: 20, fontWeight: "800", color: Colors.text, lineHeight: 26 },
  avatarBtn: {},
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#FFE8D9",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.primary,
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: Colors.primary },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    paddingHorizontal: 14, height: 46,
  },
  searchText: { fontSize: 14, color: Colors.text3 },
  // Sections
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: Colors.text, marginBottom: 14 },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  // Categories
  catRow: { gap: 8, paddingBottom: 4 },
  catPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg,
  },
  catPillActive: { backgroundColor: Colors.primary },
  catLabel: { fontSize: 12, fontWeight: "600", color: Colors.text2 },
  catLabelActive: { color: "#fff" },
  // Cards
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginBottom: 16,
    ...Shadow.sm,
    overflow: "hidden",
  },
  cardImg: { height: 160, backgroundColor: Colors.inputBg },
  cardImgFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  typeBadge: {
    position: "absolute", top: 10, left: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 11, color: "#fff", fontWeight: "600", textTransform: "capitalize" },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: "700", color: Colors.text, flex: 1 },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 12, fontWeight: "700", color: Colors.text },
  cardAddress: { fontSize: 12, color: Colors.text3, marginBottom: 10 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: Colors.text3 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  // Empty
  empty: { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.text3 },
});
