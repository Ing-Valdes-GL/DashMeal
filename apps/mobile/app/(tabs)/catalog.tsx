import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ScrollView, Animated, Dimensions,
  RefreshControl, Platform,
} from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius, Shadow } from "@/lib/theme";

const { width: W } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeaturedProduct {
  id: string;
  name: string;
  name_fr: string | null;
  price: number;
  image_url: string | null;
}

interface BranchData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  is_live: boolean;
  category: string;
  image_url: string | null;
  phone: string | null;
  distance_km?: number | null;
}

interface CatalogueBrand {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  created_at: string;
  branches: BranchData[];
  featured_products: FeaturedProduct[];
}

// ─── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function sortBranchesByDistance(
  branches: BranchData[],
  lat: number | null,
  lng: number | null,
): BranchData[] {
  if (lat === null || lng === null) return branches;
  return [...branches]
    .map((b) => ({
      ...b,
      distance_km:
        b.lat != null && b.lng != null ? haversineKm(lat, lng, b.lat, b.lng) : null,
    }))
    .sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return 0;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });
}

// ─── Catégories ───────────────────────────────────────────────────────────────

const CAT: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  restaurant:  { label: "Restaurant",  color: "#EA580C", bg: "#FFF4EE", icon: "restaurant-outline" },
  supermarket: { label: "Supermarché", color: "#16A34A", bg: "#F0FDF4", icon: "cart-outline" },
  superette:   { label: "Supérette",   color: "#059669", bg: "#ECFDF5", icon: "basket-outline" },
  cafe:        { label: "Café",        color: "#B45309", bg: "#FFFBEB", icon: "cafe-outline" },
  bakery:      { label: "Boulangerie", color: "#CA8A04", bg: "#FEFCE8", icon: "pizza-outline" },
  pharmacy:    { label: "Pharmacie",   color: "#2563EB", bg: "#EFF6FF", icon: "medkit-outline" },
  other:       { label: "Autre",       color: "#64748B", bg: "#F8FAFC", icon: "storefront-outline" },
};

function getPrimaryCategory(branches: BranchData[]): string {
  if (!branches.length) return "other";
  const counts: Record<string, number> = {};
  for (const b of branches) counts[b.category] = (counts[b.category] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ width, height, radius = 8, style }: {
  width?: number | string; height: number; radius?: number; style?: any;
}) {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width ?? "100%", height, borderRadius: radius, backgroundColor: Colors.border, opacity: anim },
        style,
      ]}
    />
  );
}

function BrandCardSkeleton() {
  return (
    <View style={card.wrap}>
      {/* Header */}
      <View style={card.header}>
        <SkeletonBox width={52} height={52} radius={Radius.md} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox height={14} width="55%" />
          <SkeletonBox height={10} width={80} radius={Radius.full} />
        </View>
        <SkeletonBox width={32} height={32} radius={Radius.sm} />
      </View>
      {/* Products */}
      <View style={card.sectionWrap}>
        <SkeletonBox height={9} width={110} radius={4} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ gap: 6 }}>
              <SkeletonBox width={84} height={68} radius={Radius.sm} />
              <SkeletonBox width={70} height={9} />
              <SkeletonBox width={44} height={9} />
            </View>
          ))}
        </View>
      </View>
      {/* Branches */}
      <View style={[card.sectionWrap, { borderTopWidth: 1, borderTopColor: Colors.divider }]}>
        <SkeletonBox height={9} width={70} radius={4} style={{ marginBottom: 12 }} />
        {[0, 1].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <SkeletonBox width={34} height={34} radius={Radius.sm} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox height={10} width="60%" />
              <SkeletonBox height={9} width="40%" />
            </View>
            <SkeletonBox width={44} height={9} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Agency Row ───────────────────────────────────────────────────────────────

function AgencyRow({ branch }: { branch: BranchData }) {
  return (
    <View style={ag.row}>
      {/* Icon */}
      <View style={[ag.icon, branch.is_live && ag.iconLive]}>
        <Ionicons
          name="storefront-outline"
          size={16}
          color={branch.is_live ? Colors.primary : Colors.text3}
        />
      </View>

      {/* Info */}
      <View style={ag.info}>
        <Text style={ag.name} numberOfLines={1}>{branch.name}</Text>
        {(branch.address || branch.city) && (
          <Text style={ag.addr} numberOfLines={1}>
            {[branch.address, branch.city].filter(Boolean).join(", ")}
          </Text>
        )}
      </View>

      {/* Distance + live dot */}
      <View style={ag.right}>
        {branch.distance_km != null && (
          <View style={ag.distPill}>
            <Ionicons name="location-outline" size={10} color={Colors.primary} />
            <Text style={ag.distText}>{formatDistance(branch.distance_km)}</Text>
          </View>
        )}
        <View style={[ag.liveDot, { backgroundColor: branch.is_live ? "#22C55E" : Colors.border }]} />
      </View>
    </View>
  );
}

// ─── Product Thumb ────────────────────────────────────────────────────────────

function ProductThumb({ product, onPress }: { product: FeaturedProduct; onPress: () => void }) {
  const { i18n } = useTranslation();
  const label = i18n.language === "fr" && product.name_fr ? product.name_fr : product.name;

  return (
    <TouchableOpacity style={pt.wrap} onPress={onPress} activeOpacity={0.82}>
      <View style={pt.imgWrap}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={pt.img} contentFit="cover" />
        ) : (
          <View style={pt.imgFallback}>
            <Ionicons name="cube-outline" size={22} color={Colors.text3} />
          </View>
        )}
      </View>
      <Text style={pt.name} numberOfLines={2}>{label}</Text>
      <Text style={pt.price}>{formatCurrency(product.price)}</Text>
    </TouchableOpacity>
  );
}

// ─── Brand Card ───────────────────────────────────────────────────────────────

function BrandCard({
  brand, userLat, userLng,
}: {
  brand: CatalogueBrand;
  userLat: number | null;
  userLng: number | null;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const primaryCat = getPrimaryCategory(brand.branches);
  const cat = CAT[primaryCat] ?? CAT.other;
  const sortedBranches = sortBranchesByDistance(brand.branches, userLat, userLng);
  const visibleBranches = expanded ? sortedBranches : sortedBranches.slice(0, 2);
  const extra = sortedBranches.length - 2;
  const initials = getInitials(brand.name);

  return (
    <View style={card.wrap}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={card.header}>
        {/* Logo */}
        {brand.logo_url ? (
          <View style={card.logoWrap}>
            <Image source={{ uri: brand.logo_url }} style={card.logo} contentFit="cover" />
          </View>
        ) : (
          <View style={[card.logoPlaceholder, { backgroundColor: cat.bg }]}>
            <Text style={[card.logoInitials, { color: cat.color }]}>{initials}</Text>
          </View>
        )}

        {/* Name + badge */}
        <View style={card.meta}>
          <Text style={card.brandName} numberOfLines={1}>{brand.name}</Text>
          <View style={[card.badge, { backgroundColor: cat.bg }]}>
            <View style={[card.badgeDot, { backgroundColor: cat.color }]} />
            <Text style={[card.badgeText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          {brand.description ? (
            <Text style={card.desc} numberOfLines={1}>{brand.description}</Text>
          ) : null}
        </View>

        {/* Branch count */}
        <View style={card.counter}>
          <Text style={card.counterNum}>{brand.branches.length}</Text>
          <Text style={card.counterLabel}>{brand.branches.length > 1 ? "agences" : "agence"}</Text>
        </View>
      </View>

      {/* ── Featured products ───────────────────────────────────────── */}
      {brand.featured_products.length > 0 ? (
        <View style={card.sectionWrap}>
          <Text style={card.sectionLabel}>PRODUITS VEDETTES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 4 }}
          >
            {brand.featured_products.slice(0, 4).map((p) => (
              <ProductThumb
                key={p.id}
                product={p}
                onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Agencies ────────────────────────────────────────────────── */}
      {sortedBranches.length > 0 && (
        <View style={[card.sectionWrap, { borderTopWidth: 1, borderTopColor: Colors.divider }]}>
          <View style={card.agHeader}>
            <Text style={card.sectionLabel}>
              AGENCES
              {userLat !== null && (
                <Text style={card.geoTag}>  · proches de vous</Text>
              )}
            </Text>
          </View>

          {visibleBranches.map((b) => (
            <AgencyRow key={b.id} branch={b} />
          ))}

          {extra > 0 && (
            <TouchableOpacity
              style={card.expandBtn}
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={13}
                color={Colors.primary}
              />
              <Text style={card.expandText}>
                {expanded ? "Réduire" : `${extra} agence${extra > 1 ? "s" : ""} de plus`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "denied" | "ok">("idle");
  const [refreshing, setRefreshing] = useState(false);

  // ── Géolocalisation ─────────────────────────────────────────────────────
  const requestGeo = useCallback(async () => {
    setGeoStatus("loading");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setGeoStatus("denied"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLat(loc.coords.latitude);
      setUserLng(loc.coords.longitude);
      setGeoStatus("ok");
    } catch {
      setGeoStatus("denied");
    }
  }, []);

  useEffect(() => { requestGeo(); }, [requestGeo]);

  // ── Données catalogue ───────────────────────────────────────────────────
  const { data, isLoading, error, refetch, isFetching } = useQuery<CatalogueBrand[]>({
    queryKey: ["catalogue-mobile"],
    queryFn: () => apiGet<CatalogueBrand[]>("/brands/catalogue"),
    staleTime: 5 * 60_000,
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const brands = data ?? [];

  // ── Filtrage ────────────────────────────────────────────────────────────
  const filtered = brands.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const catLabel = (CAT[getPrimaryCategory(b.branches)] ?? CAT.other).label;
    return (
      b.name.toLowerCase().includes(q) ||
      catLabel.toLowerCase().includes(q) ||
      (b.description ?? "").toLowerCase().includes(q)
    );
  });

  const totalBranches = brands.reduce((s, b) => s + b.branches.length, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // ── Header ──────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View>
      {/* Stats bar */}
      {!isLoading && brands.length > 0 && (
        <View style={pg.statsBar}>
          <View style={pg.statItem}>
            <Ionicons name="business-outline" size={13} color={Colors.primary} />
            <Text style={pg.statText}>{brands.length} marque{brands.length > 1 ? "s" : ""}</Text>
          </View>
          <View style={pg.statDot} />
          <View style={pg.statItem}>
            <Ionicons name="storefront-outline" size={13} color={Colors.text3} />
            <Text style={pg.statText}>{totalBranches} agence{totalBranches > 1 ? "s" : ""}</Text>
          </View>
          {geoStatus === "ok" && (
            <>
              <View style={pg.statDot} />
              <View style={pg.statItem}>
                <Ionicons name="navigate-outline" size={13} color={Colors.primary} />
                <Text style={[pg.statText, { color: Colors.primary }]}>Position active</Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Geo denied banner */}
      {geoStatus === "denied" && (
        <TouchableOpacity style={pg.geoBanner} onPress={requestGeo} activeOpacity={0.8}>
          <Ionicons name="location-outline" size={15} color="#92400E" />
          <Text style={pg.geoBannerText}>
            Activez la position pour trier les agences par distance
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#92400E" />
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Empty / error states ─────────────────────────────────────────────────
  if (!isLoading && error) {
    return (
      <View style={pg.container}>
        <StatusBar style="dark" />
        <SafeAreaView edges={["top"]} style={pg.safe}>
          <View style={pg.topBar}>
            <Text style={pg.pageTitle}>{t("catalog.title")}</Text>
          </View>
          <SearchBar value={search} onChangeText={setSearch} />
        </SafeAreaView>
        <View style={pg.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.border} />
          <Text style={pg.emptyTitle}>Impossible de charger</Text>
          <Text style={pg.emptySub}>Vérifiez votre connexion et réessayez</Text>
          <TouchableOpacity style={pg.retryBtn} onPress={() => refetch()}>
            <Text style={pg.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={pg.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={pg.safe}>
        <View style={pg.topBar}>
          <Text style={pg.pageTitle}>{t("catalog.title")}</Text>
          <TouchableOpacity
            style={[pg.geoBtn, geoStatus === "ok" && pg.geoBtnActive]}
            onPress={requestGeo}
            disabled={geoStatus === "loading"}
          >
            {geoStatus === "loading" ? (
              <Ionicons name="navigate-circle-outline" size={18} color={Colors.primary} />
            ) : (
              <Ionicons
                name={geoStatus === "ok" ? "navigate" : "navigate-outline"}
                size={18}
                color={geoStatus === "ok" ? Colors.primary : Colors.text3}
              />
            )}
          </TouchableOpacity>
        </View>
        <SearchBar value={search} onChangeText={setSearch} />
      </SafeAreaView>

      {/* Skeletons */}
      {isLoading && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}
        >
          {[0, 1, 2].map((i) => <BrandCardSkeleton key={i} />)}
        </ScrollView>
      )}

      {/* Catalogue */}
      {!isLoading && (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          contentContainerStyle={pg.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListHeaderComponent={renderHeader}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          renderItem={({ item }) => (
            <BrandCard brand={item} userLat={userLat} userLng={userLng} />
          )}
          ListEmptyComponent={
            <View style={pg.center}>
              <Ionicons name="business-outline" size={52} color={Colors.border} />
              <Text style={pg.emptyTitle}>
                {search ? `Aucun résultat pour "${search}"` : t("catalog.empty")}
              </Text>
              {search && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Text style={pg.clearSearch}>Effacer la recherche</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Search bar component ─────────────────────────────────────────────────────

function SearchBar({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  return (
    <View style={pg.searchWrap}>
      <Ionicons name="search-outline" size={16} color={Colors.text3} style={{ marginLeft: 14 }} />
      <TextInput
        style={pg.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="Rechercher une marque ou catégorie…"
        placeholderTextColor={Colors.text3}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {value.length > 0 && Platform.OS === "android" && (
        <TouchableOpacity onPress={() => onChangeText("")} style={{ paddingRight: 12 }}>
          <Ionicons name="close-circle" size={16} color={Colors.text3} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pg = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe:      { backgroundColor: Colors.bg },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
  },
  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.text, letterSpacing: -0.3 },
  geoBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.pageBg,
    alignItems: "center", justifyContent: "center",
  },
  geoBtnActive: { backgroundColor: Colors.primaryLight },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    height: 46, borderWidth: 1, borderColor: Colors.border,
    overflow: "hidden",
  },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  list: { padding: 16, paddingBottom: 110 },
  statsBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 14, gap: 8,
  },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText:  { fontSize: 12, fontWeight: "600", color: Colors.text2 },
  statDot:   { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.border },
  geoBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 12, padding: 12,
    backgroundColor: "#FEF3C7", borderRadius: Radius.md,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  geoBannerText: { flex: 1, fontSize: 12, fontWeight: "600", color: "#92400E", lineHeight: 18 },
  center:    { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle:{ fontSize: 15, fontWeight: "700", color: Colors.text2, textAlign: "center" },
  emptySub:  { fontSize: 13, color: Colors.text3, textAlign: "center" },
  retryBtn:  { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.primary },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  clearSearch: { fontSize: 13, color: Colors.primary, fontWeight: "700", marginTop: 4 },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bg, borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadow.sm,
  },
  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 16,
  },
  logoWrap: {
    width: 52, height: 52, borderRadius: Radius.md,
    overflow: "hidden", backgroundColor: Colors.pageBg,
    borderWidth: 1, borderColor: Colors.border,
  },
  logo:  { width: 52, height: 52 },
  logoPlaceholder: {
    width: 52, height: 52, borderRadius: Radius.md,
    alignItems: "center", justifyContent: "center",
  },
  logoInitials: { fontSize: 18, fontWeight: "800" },
  meta: { flex: 1, gap: 5 },
  brandName: { fontSize: 15, fontWeight: "800", color: Colors.text, letterSpacing: -0.2 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  desc: { fontSize: 11, color: Colors.text3, marginTop: 1 },
  counter: { alignItems: "center" },
  counterNum:   { fontSize: 22, fontWeight: "900", color: Colors.text, lineHeight: 24 },
  counterLabel: { fontSize: 9, fontWeight: "600", color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.5 },
  // Section
  sectionWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  sectionLabel: {
    fontSize: 9, fontWeight: "800", color: Colors.text3,
    textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12,
  },
  // Agencies header
  agHeader: { marginBottom: 0 },
  geoTag: { color: Colors.primary, fontWeight: "700" },
  // Expand button
  expandBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  expandText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
});

const ag = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  icon: {
    width: 34, height: 34, borderRadius: Radius.sm,
    backgroundColor: Colors.pageBg,
    alignItems: "center", justifyContent: "center",
  },
  iconLive: { backgroundColor: Colors.primaryLight },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 13, fontWeight: "700", color: Colors.text },
  addr: { fontSize: 11, color: Colors.text3 },
  right: { alignItems: "flex-end", gap: 4 },
  distPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  distText: { fontSize: 10, fontWeight: "700", color: Colors.primary },
  liveDot:  { width: 7, height: 7, borderRadius: 3.5 },
});

const pt = StyleSheet.create({
  wrap:      { width: 84, gap: 5 },
  imgWrap:   { width: 84, height: 68, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: Colors.pageBg, borderWidth: 1, borderColor: Colors.border },
  img:       { width: "100%", height: "100%" },
  imgFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  name:      { fontSize: 11, fontWeight: "600", color: Colors.text, lineHeight: 14 },
  price:     { fontSize: 11, fontWeight: "800", color: Colors.primary },
});
