import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { AdBanner } from "@/components/AdBanner";

const { width: SCREEN_W } = Dimensions.get("window");
const CAROUSEL_W = SCREEN_W - 32;

interface Branch {
  id: string; name: string; city: string; address: string; type?: string;
  distance_km?: number | null;
  brands?: { id: string; name: string; logo_url: string | null };
  is_sponsored?: boolean;
  rating?: number;
}

const BRANCH_TYPES = [
  { key: "all",         label: "Tout",         icon: "apps-outline" as const },
  { key: "restaurant",  label: "Restaurant",   icon: "restaurant-outline" as const },
  { key: "supermarket", label: "Supermarché",  icon: "storefront-outline" as const },
  { key: "cafe",        label: "Café",         icon: "cafe-outline" as const },
  { key: "bakery",      label: "Boulangerie",  icon: "pizza-outline" as const },
  { key: "pharmacy",    label: "Pharmacie",    icon: "medkit-outline" as const },
];

// ─── Sponsored Carousel ───────────────────────────────────────────────────────
function SponsoredCarousel({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const currentIdx = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (branches.length < 2) return;
    intervalRef.current = setInterval(() => {
      const next = (currentIdx.current + 1) % branches.length;
      scrollRef.current?.scrollTo({ x: next * CAROUSEL_W, animated: true });
      currentIdx.current = next;
    }, 3500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [branches.length]);

  if (branches.length === 0) return null;

  return (
    <View style={carousel.wrap}>
      <Text style={carousel.sectionTitle}>
        <Ionicons name="star" size={15} color={Colors.primary} /> Boutiques sponsorisées
      </Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          currentIdx.current = Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_W);
        }}
        style={{ width: CAROUSEL_W }}
      >
        {branches.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[carousel.card, { width: CAROUSEL_W }]}
            activeOpacity={0.92}
            onPress={() => router.push("/(tabs)/catalog")}
          >
            {/* Background image */}
            {b.brands?.logo_url ? (
              <Image source={{ uri: b.brands.logo_url }} style={carousel.img} contentFit="cover" />
            ) : (
              <View style={[carousel.img, carousel.imgFallback]}>
                <Text style={{ fontSize: 48 }}>🍽️</Text>
              </View>
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.72)"]}
              style={carousel.gradient}
            />
            {/* Sponsored badge */}
            <View style={carousel.sponsoredBadge}>
              <Ionicons name="flash" size={10} color="#FFC107" />
              <Text style={carousel.sponsoredText}>Sponsorisé</Text>
            </View>
            {/* Info */}
            <View style={carousel.info}>
              <Text style={carousel.name} numberOfLines={1}>{b.brands?.name ?? b.name}</Text>
              <View style={carousel.metaRow}>
                <View style={carousel.ratingBadge}>
                  <Ionicons name="star" size={10} color="#FFC107" />
                  <Text style={carousel.ratingText}>{(b.rating ?? 4.7).toFixed(1)}</Text>
                </View>
                <Text style={carousel.metaText}>
                  {b.distance_km != null
                    ? b.distance_km < 1 ? `${Math.round(b.distance_km * 1000)} m` : `${b.distance_km.toFixed(1)} km`
                    : b.city}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Dots */}
      {branches.length > 1 && (
        <View style={carousel.dots}>
          {branches.map((_, i) => (
            <View key={i} style={[carousel.dot, i === 0 && carousel.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const carousel = StyleSheet.create({
  wrap:         { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  card: {
    height: 180, borderRadius: Radius.xl, overflow: "hidden",
    backgroundColor: Colors.inputBg, ...Shadow.md,
  },
  img:         { ...StyleSheet.absoluteFillObject },
  imgFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#FFE8D9" },
  gradient:    { ...StyleSheet.absoluteFillObject },
  sponsoredBadge: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  sponsoredText: { fontSize: 10, color: "#FFC107", fontWeight: "700" },
  info:          { position: "absolute", bottom: 0, left: 0, right: 0, padding: 14 },
  name:          { fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 6 },
  metaRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  ratingBadge:   { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  ratingText:    { fontSize: 11, color: "#fff", fontWeight: "700" },
  metaText:      { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  dots:          { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 10 },
  dot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive:     { backgroundColor: Colors.primary, width: 18 },
});

// ─── Branch Card ──────────────────────────────────────────────────────────────
function BranchCard({ branch, onPress }: { branch: Branch; onPress: () => void }) {
  return (
    <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.85}>
      <View style={card.img}>
        {branch.brands?.logo_url ? (
          <Image source={{ uri: branch.brands.logo_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <View style={card.imgFallback}>
            <Ionicons name="storefront-outline" size={32} color={Colors.primary} />
          </View>
        )}
        <View style={card.typeBadge}>
          <Text style={card.typeBadgeText}>{branch.type ?? "autre"}</Text>
        </View>
      </View>
      <View style={card.body}>
        <View style={card.topRow}>
          <Text style={card.name} numberOfLines={1}>{branch.brands?.name ?? branch.name}</Text>
          <View style={card.ratingBadge}>
            <Ionicons name="star" size={10} color="#FFC107" />
            <Text style={card.ratingText}>{(branch.rating ?? 4.7).toFixed(1)}</Text>
          </View>
        </View>
        <Text style={card.address} numberOfLines={1}>{branch.address}</Text>
        <View style={card.metaRow}>
          {branch.distance_km != null ? (
            <View style={card.metaItem}>
              <Ionicons name="navigate-outline" size={11} color={Colors.primary} />
              <Text style={[card.metaText, { color: Colors.primary, fontWeight: "600" }]}>
                {branch.distance_km < 1 ? `${Math.round(branch.distance_km * 1000)} m` : `${branch.distance_km.toFixed(1)} km`}
              </Text>
            </View>
          ) : (
            <View style={card.metaItem}>
              <Ionicons name="time-outline" size={11} color={Colors.text3} />
              <Text style={card.metaText}>20–30 min</Text>
            </View>
          )}
          <View style={card.metaDot} />
          <View style={card.metaItem}>
            <Ionicons name="location-outline" size={11} color={Colors.text3} />
            <Text style={card.metaText}>{branch.city}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, marginBottom: 14,
    ...Shadow.sm, overflow: "hidden",
  },
  img:         { height: 140, backgroundColor: Colors.inputBg },
  imgFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  typeBadge: {
    position: "absolute", top: 10, left: 10,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 10, color: "#fff", fontWeight: "600", textTransform: "capitalize" },
  body:     { padding: 12 },
  topRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  name:     { fontSize: 15, fontWeight: "700", color: Colors.text, flex: 1 },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText:  { fontSize: 11, fontWeight: "700", color: Colors.text },
  address:  { fontSize: 12, color: Colors.text3, marginBottom: 8 },
  metaRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: Colors.text3 },
  metaDot:  { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuthStore();
  const [activeType, setActiveType] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {}
    })();
  }, []);

  const { data: branchesRes, isLoading, refetch } = useQuery<{ success: boolean; data: Branch[] }>({
    queryKey: ["branches-home", userCoords?.lat, userCoords?.lng],
    queryFn: () => apiGet("/branches/nearby", userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined),
  });

  const allBranches = branchesRes?.data ?? [];
  const sponsored   = allBranches.filter((b) => b.is_sponsored).slice(0, 5);
  const popular     = allBranches.slice(0, 10);
  const filtered    = activeType === "all" ? popular : popular.filter((b) => b.type === activeType);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  };

  const displayName = user?.name?.split(" ")[0] ?? (isGuest ? "Visiteur" : "");

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {userCoords ? "Agences près de vous" : "Yaoundé, Cameroun"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.text2} />
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} style={styles.avatarBtn}>
              {(user as any)?.avatar_url ? (
                <Image source={{ uri: (user as any).avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {isGuest ? "👤" : (user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.greeting}>{greet()}{displayName ? `, ${displayName}` : ""} 👋</Text>

          {/* Search */}
          <TouchableOpacity style={styles.searchBar} onPress={() => router.push("/(tabs)/catalog")} activeOpacity={0.85}>
            <Ionicons name="search-outline" size={18} color={Colors.text3} />
            <Text style={styles.searchText}>Rechercher boutique ou plat…</Text>
            <View style={styles.searchFilter}>
              <Ionicons name="options-outline" size={16} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Sponsored Carousel ─────────────────────────────────────────────── */}
        {(sponsored.length > 0 || allBranches.length > 0) && (
          <SponsoredCarousel branches={sponsored.length > 0 ? sponsored : allBranches.slice(0, 4)} />
        )}

        {/* ── Ad Banner ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16 }}>
          <AdBanner />
        </View>

        {/* ── Categories ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégories</Text>
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

        {/* ── Popular Stores ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {userCoords ? "Boutiques proches" : "Boutiques populaires"}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/marketplace")}>
              <Text style={styles.seeAll}>Voir tout →</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={44} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucune boutique disponible</Text>
              <Text style={styles.emptySubtitle}>Revenez plus tard ou changez de filtre</Text>
            </View>
          ) : (
            filtered.map((b) => (
              <BranchCard key={b.id} branch={b} onPress={() => router.push("/(tabs)/catalog")} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe:      { backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.bg,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  locationText: { fontSize: 13, color: Colors.text2, fontWeight: "500", flexShrink: 1 },

  avatarBtn: {},
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#FFE8D9",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.primary,
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: Colors.primary },

  greeting: { fontSize: 20, fontWeight: "800", color: Colors.text, marginBottom: 12 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    paddingHorizontal: 14, height: 48,
  },
  searchText:   { flex: 1, fontSize: 14, color: Colors.text3 },
  searchFilter: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },

  // Sections
  section:     { paddingHorizontal: 16, marginTop: 20 },
  sectionRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  seeAll:      { fontSize: 13, color: Colors.primary, fontWeight: "600" },

  // Categories
  catRow:     { gap: 8, paddingBottom: 4 },
  catPill:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.inputBg },
  catPillActive: { backgroundColor: Colors.primary },
  catLabel:      { fontSize: 12, fontWeight: "600", color: Colors.text2 },
  catLabelActive: { color: "#fff" },

  // Empty
  empty:       { alignItems: "center", paddingTop: 32, gap: 8 },
  emptyTitle:  { fontSize: 15, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.text3 },
});
