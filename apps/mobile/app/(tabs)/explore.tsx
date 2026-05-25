import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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

interface Product {
  id: string; name: string; name_fr?: string; name_en?: string;
  price: number; original_price?: number; image_url?: string;
  unit?: string; branch?: { name: string };
  product_images?: { url: string; is_primary: boolean }[];
}

const CATEGORY_META = [
  { key: "all",         icon: "grid-outline" as const,        bg: Colors.primaryLight, color: Colors.primary },
  { key: "restaurant",  icon: "restaurant-outline" as const,  bg: "#FFF3E0", color: "#FF9800" },
  { key: "supermarket", icon: "storefront-outline" as const,  bg: "#E3F2FD", color: "#2196F3" },
  { key: "bakery",      icon: "cafe-outline" as const,        bg: "#FFF8E1", color: "#FFC107" },
  { key: "cafe",        icon: "wine-outline" as const,        bg: "#EFEBE9", color: "#795548" },
  { key: "pharmacy",    icon: "medkit-outline" as const,      bg: "#E8F5E9", color: Colors.primary },
  { key: "juice",       icon: "water-outline" as const,       bg: "#E0F7FA", color: "#00BCD4" },
  { key: "african",     icon: "globe-outline" as const,       bg: "#F3E5F5", color: "#9C27B0" },
  { key: "fastfood",    icon: "fast-food-outline" as const,   bg: "#FFEBEE", color: "#F44336" },
] as const;

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

export default function ExploreScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { category: initCategory, q: initQ } = useLocalSearchParams<{ category?: string; q?: string }>();
  const addItem = useCartStore((s) => s.addItem);

  const CATEGORIES = CATEGORY_META.map((c) => ({
    ...c,
    label: t(`explore.cat${c.key.charAt(0).toUpperCase() + c.key.slice(1)}` as any),
  }));

  const [search, setSearch] = useState(initQ ?? "");
  const [activeCategory, setActiveCategory] = useState(initCategory ?? "all");
  const [debouncedSearch, setDebouncedSearch] = useState(initQ ?? "");

  const debounce = useCallback((val: string) => {
    setSearch(val);
    const timer = setTimeout(() => setDebouncedSearch(val), 400);
    return () => clearTimeout(timer);
  }, []);

  const { data, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["explore-products", activeCategory, debouncedSearch],
    queryFn: () => apiGet("/products/public", {
      limit: 20,
      ...(activeCategory !== "all" ? { category: activeCategory } : {}),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    staleTime: 60_000,
  });

  const products = data?.data ?? [];

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
          <Text style={s.headerTitle}>{t("explore.title")}</Text>
        </View>

        <View style={s.searchRow}>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.text3} />
            <TextInput
              style={s.searchInput}
              placeholder={t("explore.searchPlaceholder")}
              placeholderTextColor={Colors.text3}
              value={search}
              onChangeText={debounce}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(""); setDebouncedSearch(""); }}>
                <Ionicons name="close-circle" size={18} color={Colors.text3} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category pills */}
        <FlatList
          horizontal data={CATEGORIES} keyExtractor={(i) => i.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
          renderItem={({ item }) => {
            const active = activeCategory === item.key;
            return (
              <TouchableOpacity
                style={[cat.pill, active && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                onPress={() => setActiveCategory(item.key)}
              >
                <View style={[cat.pillIcon, { backgroundColor: active ? "rgba(255,255,255,0.25)" : item.bg }]}>
                  <Ionicons name={item.icon} size={18} color={active ? "#fff" : item.color} />
                </View>
                <Text style={[cat.pillLabel, active && { color: "#fff" }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* Product grid */}
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : products.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="search-outline" size={48} color={Colors.text3} />
            <Text style={s.emptyTitle}>{t("explore.noProducts")}</Text>
            <Text style={s.emptySub}>
              {debouncedSearch ? `${t("explore.noResultsFor")} "${debouncedSearch}"` : t("explore.emptyCategory")}
            </Text>
          </View>
        ) : (
          <View style={s.grid}>
            {products.map((p) => {
              const imageUrl = getProductImage(p);
              const name = getProductName(p, lang);
              const hasDiscount = p.original_price && p.original_price > p.price;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={s.card}
                  onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })}
                  activeOpacity={0.88}
                >
                  <View style={s.cardImgWrap}>
                    {imageUrl
                      ? <Image source={{ uri: imageUrl }} style={s.cardImg} contentFit="cover" />
                      : <View style={[s.cardImg, s.cardImgFallback]}><Ionicons name="fast-food-outline" size={38} color={Colors.primary} /></View>
                    }
                    {hasDiscount && (
                      <View style={s.discountBadge}>
                        <Text style={s.discountText}>-{Math.round((1 - p.price / p.original_price!) * 100)}%</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.cardName} numberOfLines={2}>{name}</Text>
                    {p.unit && <Text style={s.cardUnit}>{p.unit}</Text>}
                    <View style={s.priceRow}>
                      <Text style={s.cardPrice}>{formatCurrency(p.price)}</Text>
                      {hasDiscount && <Text style={s.origPrice}>{formatCurrency(p.original_price!)}</Text>}
                    </View>
                  </View>
                  <TouchableOpacity style={s.addBtn} onPress={() => handleAdd(p)}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  searchRow: { paddingHorizontal: 16, paddingBottom: 4 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.pageBg, borderRadius: Radius.lg, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, color: Colors.text2, fontWeight: "700" },
  emptySub: { fontSize: 13, color: Colors.text3, textAlign: "center", paddingHorizontal: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 14, paddingTop: 4 },
  card: { width: "47%", backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", position: "relative" },
  cardImgWrap: { alignItems: "center", justifyContent: "center", backgroundColor: Colors.pageBg, height: 120 },
  cardImg: { width: "100%", height: 120 },
  cardImgFallback: { alignItems: "center", justifyContent: "center" },
  discountBadge: { position: "absolute", top: 8, left: 8, backgroundColor: Colors.error, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { fontSize: 9, color: "#fff", fontWeight: "800" },
  cardBody: { padding: 10, paddingBottom: 42 },
  cardName: { fontSize: 13, fontWeight: "700", color: Colors.text, lineHeight: 18, marginBottom: 2 },
  cardUnit: { fontSize: 11, color: Colors.text3, marginBottom: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardPrice: { fontSize: 14, fontWeight: "800", color: Colors.text },
  origPrice: { fontSize: 11, color: Colors.text3, textDecorationLine: "line-through" },
  addBtn: { position: "absolute", bottom: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
});

const cat = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  pillIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pillLabel: { fontSize: 12, fontWeight: "600", color: Colors.text2 },
});
