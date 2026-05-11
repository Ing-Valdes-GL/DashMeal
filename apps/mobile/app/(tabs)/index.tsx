import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useCartStore } from "@/stores/cart";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius } from "@/lib/theme";

const { width: W } = Dimensions.get("window");

interface Product {
  id: string; name: string; name_fr?: string; name_en?: string;
  price: number; original_price?: number; image_url?: string;
  discount_pct?: number; branch?: { name: string }; unit?: string;
  product_images?: { url: string; is_primary: boolean }[];
}

const CATEGORIES = [
  { key: "restaurant",  label: "Restaurants",    icon: "restaurant-outline" as const,  bg: "#FFF3E0", color: "#FF9800" },
  { key: "supermarket", label: "Supermarché",    icon: "storefront-outline" as const,  bg: "#E3F2FD", color: "#2196F3" },
  { key: "bakery",      label: "Boulangerie",    icon: "cafe-outline" as const,        bg: "#FFF8E1", color: "#FFC107" },
  { key: "cafe",        label: "Cafés & Bars",   icon: "wine-outline" as const,        bg: "#EFEBE9", color: "#795548" },
  { key: "pharmacy",    label: "Pharmacies",     icon: "medkit-outline" as const,      bg: "#E8F5E9", color: Colors.primary },
  { key: "juice",       label: "Jus & Boissons", icon: "water-outline" as const,       bg: "#E0F7FA", color: "#00BCD4" },
  { key: "african",     label: "Cuisine locale", icon: "globe-outline" as const,       bg: "#F3E5F5", color: "#9C27B0" },
  { key: "fastfood",    label: "Fast-food",      icon: "fast-food-outline" as const,   bg: "#FFEBEE", color: "#F44336" },
];

const BANNERS = [
  { id: "1", bg: Colors.primaryLight, title: "Légumes frais",    sub: "Jusqu'à 40% de réduction !", icon: "leaf-outline" as const,    iconColor: Colors.primary },
  { id: "2", bg: "#FFF3E0",           title: "Flash Sales",      sub: "Offres limitées du jour",    icon: "flash-outline" as const,   iconColor: "#FF9800" },
  { id: "3", bg: "#E3F2FD",           title: "Livraison offerte",sub: "Sur votre 1re commande",     icon: "bicycle-outline" as const, iconColor: "#2196F3" },
];

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

function ProductCard({ item, onPress, onAdd, lang }: { item: Product; onPress: () => void; onAdd: () => void; lang: string }) {
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

export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const addItem = useCartStore((s) => s.addItem);

  const { data: promoRes, isLoading: l1, refetch, isRefetching } = useQuery<{ data: Product[] }>({
    queryKey: ["home-promo"],
    queryFn: () => apiGet("/products/public", { promo: true, limit: 8 }),
    staleTime: 120_000,
  });
  const { data: featRes, isLoading: l2 } = useQuery<{ data: Product[] }>({
    queryKey: ["home-featured"],
    queryFn: () => apiGet("/products/public", { limit: 8 }),
    staleTime: 120_000,
  });

  const promo    = promoRes?.data ?? [];
  const featured = featRes?.data ?? [];

  const handleAdd = (p: Product) => addItem({
    product_id: p.id,
    product_name: getProductName(p, lang),
    product_image: getProductImage(p),
    unit_price: p.price,
    quantity: 1,
  });

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity style={s.locationRow}>
            <Ionicons name="location" size={18} color={Colors.primary} />
            <Text style={s.city}>Yaoundé, Cameroun</Text>
            <Ionicons name="chevron-down" size={14} color={Colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity style={s.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.searchBar} onPress={() => router.push("/(tabs)/explore" as any)}>
          <Ionicons name="search-outline" size={18} color={Colors.text3} />
          <Text style={s.searchPlaceholder}>Search Store</Text>
          <View style={s.filterIcon}><Ionicons name="options-outline" size={18} color={Colors.primary} /></View>
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <BannerCarousel />
        </View>

        {/* Exclusive Offer */}
        <Section title="Exclusive Offer" onSeeAll={() => router.push("/(tabs)/explore" as any)}>
          {l1 ? <ProductListSkeleton /> : promo.length === 0 ? null : (
            <FlatList
              horizontal data={promo} keyExtractor={(i) => i.id}
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

        {/* Best Selling */}
        <Section title="Best Selling" onSeeAll={() => router.push("/(tabs)/explore" as any)}>
          {l2 ? <ProductListSkeleton /> : featured.length === 0 ? (
            <View style={s.emptySection}>
              <Text style={s.emptySectionText}>Aucun produit disponible</Text>
            </View>
          ) : (
            <FlatList
              horizontal data={featured} keyExtractor={(i) => i.id}
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

        {/* Groceries categories */}
        <Section title="Groceries" onSeeAll={() => router.push("/(tabs)/explore" as any)}>
          <FlatList
            horizontal data={CATEGORIES} keyExtractor={(i) => i.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={cat.chip} onPress={() => router.push({ pathname: "/(tabs)/explore", params: { category: item.key } } as any)}>
                <View style={[cat.iconWrap, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={30} color={item.color} />
                </View>
                <Text style={cat.label}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: Colors.bg },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  city: { fontSize: 16, fontWeight: "700", color: Colors.text },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 16, height: 52, backgroundColor: Colors.pageBg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  searchPlaceholder: { flex: 1, fontSize: 14, color: Colors.text3 },
  filterIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  seeAll: { fontSize: 14, fontWeight: "600", color: Colors.primary },
  emptySection: { paddingHorizontal: 16, paddingVertical: 20, alignItems: "center" },
  emptySectionText: { fontSize: 14, color: Colors.text3 },
});

const pc = StyleSheet.create({
  wrap: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", position: "relative" },
  imgWrap: { alignItems: "center", justifyContent: "center", backgroundColor: Colors.pageBg, height: 125 },
  img: { width: "100%", height: 125 },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 8, left: 8, backgroundColor: Colors.error, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, color: "#fff", fontWeight: "800" },
  body: { padding: 10, paddingBottom: 44 },
  name: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 2, lineHeight: 18 },
  unit: { fontSize: 11, color: Colors.text3, marginBottom: 2 },
  branch: { fontSize: 11, color: Colors.text3, marginBottom: 6 },
  price: { fontSize: 14, fontWeight: "800", color: Colors.text },
  origPrice: { fontSize: 11, color: Colors.text3, textDecorationLine: "line-through" },
  addBtn: { position: "absolute", bottom: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
});

const bn = StyleSheet.create({
  card: { height: 115, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  sub: { fontSize: 12, color: Colors.text2, lineHeight: 18 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, borderRadius: 4, backgroundColor: Colors.primary },
});

const cat = StyleSheet.create({
  chip: { alignItems: "center", gap: 8, padding: 12, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, width: 90 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 10, fontWeight: "600", color: Colors.text2, textAlign: "center" },
});
