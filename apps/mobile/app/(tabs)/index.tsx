import { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Dimensions, Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius } from "@/lib/theme";

const { width: W } = Dimensions.get("window");

interface Product {
  id: string; name: string; name_fr?: string; name_en?: string;
  price: number; original_price?: number; image_url?: string;
  discount_pct?: number; branch?: { name: string; category?: string }; unit?: string;
  product_images?: { url: string; is_primary: boolean }[];
}

interface Ad {
  id: string; title: string; image_url?: string; video_url?: string;
  cta_url?: string; brand_id?: string;
}

interface Notification { id: string; is_read: boolean; }

// ─── Catégories avec vraies images ───────────────────────────────────────────
const CATEGORIES = [
  {
    key: "restaurant",
    label: "Restaurants",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&q=80",
    bg: "#FFF3E0",
  },
  {
    key: "supermarket",
    label: "Supermarché",
    image: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=300&q=80",
    bg: "#E3F2FD",
  },
  {
    key: "bakery",
    label: "Boulangerie",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80",
    bg: "#FFF8E1",
  },
  {
    key: "cafe",
    label: "Cafés & Bars",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&q=80",
    bg: "#EFEBE9",
  },
  {
    key: "pharmacy",
    label: "Pharmacies",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=80",
    bg: "#E8F5E9",
  },
];

const BANNERS = [
  { id: "1", bg: Colors.primaryLight, title: "Légumes frais",     sub: "Jusqu'à 40% de réduction !", icon: "leaf-outline" as const,    iconColor: Colors.primary },
  { id: "2", bg: "#FFF3E0",           title: "Flash Sales",       sub: "Offres limitées du jour",    icon: "flash-outline" as const,   iconColor: "#FF9800" },
  { id: "3", bg: "#E3F2FD",           title: "Livraison offerte", sub: "Sur votre 1re commande",     icon: "bicycle-outline" as const, iconColor: "#2196F3" },
];

// ─── Hook géolocalisation dynamique ──────────────────────────────────────────
function useCurrentLocation() {
  const [locationLabel, setLocationLabel] = useState<string>("Localisation...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) { setLocationLabel("Yaoundé, Cameroun"); setLoading(false); }
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [place] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (!cancelled && place) {
          const city    = place.city || place.district || place.subregion || place.region || "";
          const country = place.country || "";
          setLocationLabel(city && country ? `${city}, ${country}` : city || country || "Localisation inconnue");
        }
      } catch {
        if (!cancelled) setLocationLabel("Yaoundé, Cameroun");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { locationLabel, loading };
}

// ─── Helpers produits ─────────────────────────────────────────────────────────
function getProductImage(p: Product): string | undefined {
  if (p.image_url) return p.image_url;
  const primary = p.product_images?.find((i) => i.is_primary);
  return primary?.url ?? p.product_images?.[0]?.url;
}

function getProductName(p: Product, lang: string) {
  if (lang === "en" && p.name_en) return p.name_en;
  if (p.name_fr) return p.name_fr;
  return p.name ?? "";
}

// ─── Composant carte produit ──────────────────────────────────────────────────
function ProductCard({ item, onPress, onAdd, lang }: {
  item: Product; onPress: () => void; onAdd: () => void; lang: string;
}) {
  const hasDiscount = item.original_price && item.original_price > item.price;
  const pct = hasDiscount ? Math.round((1 - item.price / item.original_price!) * 100) : item.discount_pct;
  const imageUrl = getProductImage(item);
  const name = getProductName(item, lang);

  return (
    <TouchableOpacity style={pc.wrap} onPress={onPress} activeOpacity={0.88}>
      <View style={pc.imgWrap}>
        {imageUrl
          ? <Image source={{ uri: imageUrl }} style={pc.img} contentFit="cover" />
          : <View style={[pc.img, pc.imgFallback]}><Ionicons name="fast-food-outline" size={40} color={Colors.primary} /></View>
        }
        {pct ? <View style={pc.badge}><Text style={pc.badgeText}>-{pct}%</Text></View> : null}
      </View>
      <View style={pc.body}>
        <Text style={pc.name} numberOfLines={2}>{name}</Text>
        {item.unit && <Text style={pc.unit}>{item.unit}</Text>}
        {item.branch && <Text style={pc.branch} numberOfLines={1}>{item.branch.name}</Text>}
        <Text style={pc.price}>{formatCurrency(item.price)}</Text>
        {hasDiscount && <Text style={pc.origPrice}>{formatCurrency(item.original_price!)}</Text>}
      </View>
      <TouchableOpacity style={pc.addBtn} onPress={onAdd}>
        <Ionicons name="add" size={20} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Carrousel bannières ──────────────────────────────────────────────────────
function BannerCarousel() {
  const scrollRef = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      const next = (idx + 1) % BANNERS.length;
      scrollRef.current?.scrollTo({ x: next * (W - 32), animated: true });
      setIdx(next);
    }, 3500);
    return () => clearInterval(t);
  }, [idx]);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        snapToInterval={W - 32} decelerationRate="fast"
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / (W - 32)))}
        style={{ borderRadius: Radius.lg, overflow: "hidden" }}
      >
        {BANNERS.map((b) => (
          <View key={b.id} style={[bn.card, { backgroundColor: b.bg, width: W - 32 }]}>
            <View style={{ flex: 1 }}>
              <Text style={bn.title}>{b.title}</Text>
              <Text style={bn.sub}>{b.sub}</Text>
            </View>
            <View style={[bn.iconCircle, { backgroundColor: b.iconColor + "22" }]}>
              <Ionicons name={b.icon} size={52} color={b.iconColor} />
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={bn.dots}>
        {BANNERS.map((_, i) => <View key={i} style={[bn.dot, i === idx && bn.dotActive]} />)}
      </View>
    </View>
  );
}

// ─── Skeleton chargement produits ─────────────────────────────────────────────
function ProductListSkeleton() {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 14 }}>
      {[1, 2, 3].map((k) => (
        <View key={k} style={[pc.wrap, { width: 160, opacity: 0.4 }]}>
          <View style={[pc.imgWrap, { backgroundColor: Colors.pageBg }]} />
          <View style={pc.body}>
            <View style={{ height: 12, backgroundColor: Colors.border, borderRadius: 6, marginBottom: 6 }} />
            <View style={{ height: 10, backgroundColor: Colors.border, borderRadius: 6, width: "60%" }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const CARD_W = (W - 48) / 2; // 16 padding × 2 + 16 gap

// ─── Composant publicité (image ou vidéo) ────────────────────────────────────
function AdCard({ ad }: { ad: Ad }) {
  const AW = W - 64; // ~311px sur iPhone 375
  if (ad.video_url) {
    return (
      <View style={[adS.wrap, { width: AW }]}>
        <Video
          source={{ uri: ad.video_url }}
          style={adS.media}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
        />
        {ad.title && <View style={adS.overlay}><Text style={adS.title} numberOfLines={2}>{ad.title}</Text></View>}
      </View>
    );
  }
  return (
    <View style={[adS.wrap, { width: AW }]}>
      {ad.image_url
        ? <Image source={{ uri: ad.image_url }} style={adS.media} contentFit="cover" transition={300} />
        : <View style={[adS.media, { backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="megaphone-outline" size={40} color={Colors.primary} />
          </View>
      }
      {ad.title && <View style={adS.overlay}><Text style={adS.title} numberOfLines={2}>{ad.title}</Text></View>}
    </View>
  );
}

// ─── Composant catégorie ──────────────────────────────────────────────────────
function CategoryCard({ item, onPress }: { item: typeof CATEGORIES[0]; onPress: () => void }) {
  return (
    <TouchableOpacity style={[cat.chip, { width: CARD_W }]} onPress={onPress} activeOpacity={0.8}>
      <View style={cat.imgWrap}>
        <Image
          source={{ uri: item.image }}
          style={cat.img}
          contentFit="cover"
          transition={300}
        />
      </View>
      <Text style={cat.label} numberOfLines={2}>{item.label}</Text>
    </TouchableOpacity>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const addItem = useCartStore((s) => s.addItem);
  const { isAuthenticated } = useAuthStore();

  const { locationLabel, loading: locLoading } = useCurrentLocation();

  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key);

  // Publicités actives
  const { data: adsRes, isLoading: lAds, refetch, isRefetching } = useQuery<{ data: Ad[] }>({
    queryKey: ["home-ads"],
    queryFn: () => apiGet("/ads/public/active"),
    staleTime: 120_000,
  });

  // Best sellers par catégorie
  const { data: bsRes, isLoading: lBs } = useQuery<{ data: Product[] }>({
    queryKey: ["home-best-sellers", activeCategory],
    queryFn: () => apiGet("/products/public/best-sellers", { category: activeCategory, limit: 5 }),
    staleTime: 120_000,
  });

  // Notifications non lues
  const { data: notifRes } = useQuery<{ data: Notification[] }>({
    queryKey: ["notifications-unread"],
    queryFn: () => apiGet("/notifications", { limit: 50 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const unreadCount  = (notifRes?.data ?? []).filter((n) => !n.is_read).length;
  const ads          = adsRes?.data ?? [];
  const bestSellers  = bsRes?.data ?? [];

  const handleAdd = useCallback((p: Product) => addItem({
    product_id: p.id,
    product_name: getProductName(p, lang),
    product_image: getProductImage(p),
    unit_price: p.price,
    quantity: 1,
  }), [lang, addItem]);

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={["top"]}>

        {/* ─── Header ───────────────────────────────────────────────────── */}
        <View style={s.header}>
          {/* Localisation dynamique */}
          <TouchableOpacity style={s.locationRow}>
            <Ionicons name="location" size={18} color={Colors.primary} />
            {locLoading
              ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 4 }} />
              : <Text style={s.city}>{locationLabel}</Text>
            }
            <Ionicons name="chevron-down" size={14} color={Colors.text2} />
          </TouchableOpacity>

          {/* Logo + cloche */}
          <View style={s.headerRight}>
            <Image
              source={require("../../assets/logo.png")}
              style={s.logo}
              contentFit="contain"
            />
            <TouchableOpacity
              style={s.notifBtn}
              onPress={() => router.push("/profile/settings" as any)}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Barre de recherche ───────────────────────────────────────── */}
        <TouchableOpacity style={s.searchBar} onPress={() => router.push("/(tabs)/explore" as any)}>
          <Ionicons name="search-outline" size={18} color={Colors.text3} />
          <Text style={s.searchPlaceholder}>Search Store</Text>
          <View style={s.filterIcon}>
            <Ionicons name="options-outline" size={18} color="#fff" />
          </View>
        </TouchableOpacity>

      </SafeAreaView>

      {/* ─── Contenu scrollable ───────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Bannières */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <BannerCarousel />
        </View>

        {/* ── Exclusive Offer : publicités actives ──────────────────────── */}
        {(lAds || ads.length > 0) && (
          <Section title="Exclusive Offer" onSeeAll={() => router.push("/(tabs)/explore" as any)}>
            {lAds ? <ProductListSkeleton /> : (
              <FlatList
                horizontal data={ads} keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                renderItem={({ item }) => <AdCard ad={item} />}
              />
            )}
          </Section>
        )}

        {/* ── Best Selling : top 5 par catégorie ───────────────────────── */}
        <Section title="Best Selling" onSeeAll={() => router.push("/(tabs)/explore" as any)}>
          {/* Onglets catégorie */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
          >
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[bs.tab, activeCategory === c.key && bs.tabActive]}
                onPress={() => setActiveCategory(c.key)}
                activeOpacity={0.8}
              >
                <Text style={[bs.tabText, activeCategory === c.key && bs.tabTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {lBs ? <ProductListSkeleton /> : bestSellers.length === 0 ? (
            <View style={s.emptySection}>
              <Text style={s.emptySectionText}>Aucun produit disponible</Text>
            </View>
          ) : (
            <FlatList
              horizontal data={bestSellers} keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
              renderItem={({ item }) => (
                <View style={{ width: 160 }}>
                  <ProductCard
                    item={item} lang={lang}
                    onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
                    onAdd={() => handleAdd(item)}
                  />
                </View>
              )}
            />
          )}
        </Section>

        {/* Catégories — grille verticale 2 par ligne */}
        <Section title="Catégories" onSeeAll={() => router.push("/(tabs)/explore" as any)}>
          <View style={cat.grid}>
            {CATEGORIES.map((item) => (
              <CategoryCard
                key={item.key}
                item={item}
                onPress={() => router.push({ pathname: "/(tabs)/explore", params: { category: item.key } } as any)}
              />
            ))}
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={onSeeAll}><Text style={s.seeAll}>See all</Text></TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.pageBg },
  safe:            { backgroundColor: Colors.bg },
  header:          {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: Colors.bg,
  },
  locationRow:     { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  city:            { fontSize: 15, fontWeight: "700", color: Colors.text },
  headerRight:     { flexDirection: "row", alignItems: "center", gap: 10 },
  logo:            { width: 44, height: 44 },
  notifBtn:        {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center",
  },
  badge:           {
    position: "absolute", top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText:       { fontSize: 9, fontWeight: "800", color: "#fff" },
  searchBar:       {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 16, height: 52,
    backgroundColor: Colors.pageBg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: Colors.text3 },
  filterIcon:      {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  sectionRow:      {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 14,
  },
  sectionTitle:    { fontSize: 18, fontWeight: "800", color: Colors.text },
  seeAll:          { fontSize: 14, fontWeight: "600", color: Colors.primary },
  emptySection:    { paddingHorizontal: 16, paddingVertical: 20, alignItems: "center" },
  emptySectionText:{ fontSize: 14, color: Colors.text3 },
});

const pc = StyleSheet.create({
  wrap:      {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden", position: "relative",
  },
  imgWrap:   { alignItems: "center", justifyContent: "center", backgroundColor: Colors.pageBg, height: 125 },
  img:       { width: "100%", height: 125 },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  badge:     {
    position: "absolute", top: 8, left: 8, backgroundColor: Colors.error,
    borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { fontSize: 9, color: "#fff", fontWeight: "800" },
  body:      { padding: 10, paddingBottom: 44 },
  name:      { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 2, lineHeight: 18 },
  unit:      { fontSize: 11, color: Colors.text3, marginBottom: 2 },
  branch:    { fontSize: 11, color: Colors.text3, marginBottom: 6 },
  price:     { fontSize: 14, fontWeight: "800", color: Colors.text },
  origPrice: { fontSize: 11, color: Colors.text3, textDecorationLine: "line-through" },
  addBtn:    {
    position: "absolute", bottom: 10, right: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
});

const bn = StyleSheet.create({
  card:       { height: 115, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 10 },
  title:      { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  sub:        { fontSize: 12, color: Colors.text2, lineHeight: 18 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  dots:       { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive:  { width: 24, borderRadius: 4, backgroundColor: Colors.primary },
});

const adS = StyleSheet.create({
  wrap:    {
    height: 160, borderRadius: Radius.lg, overflow: "hidden",
    backgroundColor: Colors.pageBg,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  media:   { width: "100%", height: "100%" },
  overlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 12, paddingVertical: 8,
  },
  title:   { color: "#fff", fontSize: 13, fontWeight: "700" },
});

const bs = StyleSheet.create({
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  tabActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText:       { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  tabTextActive: { color: "#fff" },
});

const cat = StyleSheet.create({
  grid:    {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 16, gap: 16,
  },
  chip:    {
    alignItems: "center", gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 16, paddingHorizontal: 10,
    overflow: "hidden",
  },
  imgWrap: { width: 90, height: 90, borderRadius: 45, overflow: "hidden", backgroundColor: Colors.pageBg },
  img:     { width: 90, height: 90 },
  label:   { fontSize: 13, fontWeight: "700", color: Colors.text2, textAlign: "center", lineHeight: 18 },
});
