import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius, Shadow } from "@/lib/theme";

type MarketTab = "for_you" | "flash" | "promos" | "categories";

const TABS: { key: MarketTab; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "for_you",    label: "Pour vous",   icon: "sparkles-outline" },
  { key: "flash",      label: "Flash Sales", icon: "flash-outline" },
  { key: "promos",     label: "Promos",      icon: "pricetag-outline" },
  { key: "categories", label: "Catégories",  icon: "grid-outline" },
];

interface Product {
  id: string; name: string; price: number;
  original_price?: number;
  image_url?: string;
  branch?: { name: string };
  category?: string;
  discount_pct?: number;
  flash_ends_at?: string;
}

const CATEGORIES: { key: string; icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; bg: string; label: string }[] = [
  { key: "restaurant",  icon: "restaurant-outline",   color: "#FF7A2F", bg: "#FFF0E8", label: "Restaurants" },
  { key: "supermarket", icon: "storefront-outline",   color: "#2196F3", bg: "#E3F2FD", label: "Supermarchés" },
  { key: "bakery",      icon: "cafe-outline",         color: "#FF9800", bg: "#FFF3E0", label: "Boulangeries" },
  { key: "cafe",        icon: "beer-outline",         color: "#795548", bg: "#EFEBE9", label: "Cafés & Bars" },
  { key: "pharmacy",    icon: "medkit-outline",       color: "#4CAF50", bg: "#E8F5E9", label: "Pharmacies" },
  { key: "juice",       icon: "water-outline",        color: "#00BCD4", bg: "#E0F7FA", label: "Jus & Boissons" },
  { key: "african",     icon: "globe-outline",        color: "#9C27B0", bg: "#F3E5F5", label: "Cuisine Africaine" },
  { key: "pizza",       icon: "fast-food-outline",    color: "#F44336", bg: "#FFEBEE", label: "Fast-food" },
];

// ─── Product card ─────────────────────────────────────────────────────────────
function ProductCard({ item, onPress }: { item: Product; onPress: () => void }) {
  const hasDiscount = item.original_price && item.original_price > item.price;
  const discountPct = hasDiscount
    ? Math.round((1 - item.price / item.original_price!) * 100)
    : item.discount_pct;

  return (
    <TouchableOpacity style={prodCard.wrap} onPress={onPress} activeOpacity={0.85}>
      <View style={prodCard.imgWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={prodCard.img} contentFit="cover" />
        ) : (
          <View style={[prodCard.img, prodCard.imgFallback]}>
            <Ionicons name="fast-food-outline" size={36} color={Colors.primary} />
          </View>
        )}
        {discountPct ? (
          <View style={prodCard.discountBadge}>
            <Text style={prodCard.discountText}>-{discountPct}%</Text>
          </View>
        ) : null}
      </View>
      <View style={prodCard.body}>
        <Text style={prodCard.name} numberOfLines={2}>{item.name}</Text>
        {item.branch && (
          <Text style={prodCard.branch} numberOfLines={1}>{item.branch.name}</Text>
        )}
        <View style={prodCard.priceRow}>
          <Text style={prodCard.price}>{formatCurrency(item.price)}</Text>
          {hasDiscount && (
            <Text style={prodCard.originalPrice}>{formatCurrency(item.original_price!)}</Text>
          )}
        </View>
        <TouchableOpacity style={prodCard.addBtn} onPress={onPress}>
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const prodCard = StyleSheet.create({
  wrap: {
    width: "47%", backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginBottom: 14, ...Shadow.sm, overflow: "hidden",
  },
  imgWrap:     { position: "relative" },
  img:         { width: "100%", height: 120, backgroundColor: Colors.inputBg },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  discountBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "#FF4D6D", borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  discountText: { fontSize: 10, color: "#fff", fontWeight: "800" },
  body:         { padding: 10 },
  name:         { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 2, lineHeight: 18 },
  branch:       { fontSize: 11, color: Colors.text3, marginBottom: 6 },
  priceRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  price:        { fontSize: 14, fontWeight: "800", color: Colors.primary },
  originalPrice: { fontSize: 11, color: Colors.text3, textDecorationLine: "line-through" },
  addBtn: {
    position: "absolute", bottom: 10, right: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
});

// ─── Flash timer ──────────────────────────────────────────────────────────────
function FlashTimer() {
  return (
    <View style={flash.wrap}>
      <View style={flash.timerRow}>
        <Ionicons name="flash" size={16} color="#FFC107" />
        <Text style={flash.label}>Se termine dans</Text>
        {["02", "45", "18"].map((t, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={flash.timeBox}><Text style={flash.timeText}>{t}</Text></View>
            {i < 2 && <Text style={flash.colon}>:</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const flash = StyleSheet.create({
  wrap:     { backgroundColor: "#FFF9C4", borderRadius: Radius.md, padding: 12, marginBottom: 14 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label:    { fontSize: 12, fontWeight: "600", color: "#92400E", flex: 1 },
  timeBox:  { backgroundColor: "#1C1C1E", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  timeText: { fontSize: 14, fontWeight: "800", color: "#FFC107" },
  colon:    { fontSize: 14, fontWeight: "800", color: "#92400E", marginHorizontal: 2 },
});

// ─── Tab content ──────────────────────────────────────────────────────────────
function TabContent({ tab, products, isLoading }: { tab: MarketTab; products: Product[]; isLoading: boolean }) {
  const router = useRouter();

  if (tab === "categories") {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={catGrid.container}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity key={cat.key} style={catGrid.item} activeOpacity={0.8}>
            <View style={[catGrid.iconWrap, { backgroundColor: cat.bg }]}>
              <Ionicons name={cat.icon} size={26} color={cat.color} />
            </View>
            <Text style={catGrid.label} numberOfLines={1}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  if (isLoading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />;

  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="storefront-outline" size={48} color={Colors.border} />
        <Text style={styles.emptyTitle}>
          {tab === "flash" ? "Aucune offre flash en ce moment" :
           tab === "promos" ? "Aucune promotion disponible" :
           "Aucun produit disponible"}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {tab === "flash" && <FlashTimer />}
      <View style={styles.productsGrid}>
        {products.map((p) => (
          <ProductCard
            key={p.id}
            item={p}
            onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const catGrid = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingBottom: 100 },
  item: { width: "22%", alignItems: "center", gap: 6 },
  iconWrap: {
    width: 64, height: 64, borderRadius: Radius.xl,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
    ...Shadow.sm,
  },
  label: { fontSize: 11, fontWeight: "600", color: Colors.text2, textAlign: "center" },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MarketplaceScreen() {
  const [activeTab, setActiveTab] = useState<MarketTab>("for_you");
  const [search, setSearch] = useState("");

  const { data: productsRes, isLoading, refetch, isRefetching } = useQuery<{ success: boolean; data: Product[] }>({
    queryKey: ["marketplace-products", activeTab],
    queryFn: () => apiGet("/products/public", {
      ...(activeTab === "flash" ? { flash: true } : {}),
      ...(activeTab === "promos" ? { promo: true } : {}),
      limit: 20,
    }),
    staleTime: 1000 * 60 * 2,
  });

  const products = productsRes?.data ?? [];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Marketplace</Text>
          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color={Colors.text3} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un produit…"
              placeholderTextColor={Colors.text3}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={17} color={Colors.text3} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tab bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, activeTab === t.key && styles.tabActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Ionicons
                  name={t.icon}
                  size={15}
                  color={activeTab === t.key ? Colors.primary : Colors.text3}
                />
                <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {activeTab === "flash" && <FlashTimer />}

        {activeTab === "categories" ? (
          <View style={catGrid.container}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.key} style={catGrid.item} activeOpacity={0.8}>
                <View style={[catGrid.iconWrap, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={26} color={cat.color} />
                </View>
                <Text style={catGrid.label} numberOfLines={1}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.productsGrid}>
            {(products.length > 0 ? products : Array.from({ length: 6 }, (_, i) => ({
              id: `mock-${i}`,
              name: ["Poulet braisé", "Ndolé", "Pizza Margherita", "Jus de fruit", "Pastels", "Beignets haricots"][i],
              price: [3500, 2500, 5000, 1000, 800, 600][i],
              original_price: (activeTab === "promos" || activeTab === "flash") ? [5000, 3500, 7000, 1500, 1200, 1000][i] : undefined,
              branch: { name: ["Chez Paul", "Saveurs du Pays", "La Bella Napoli", "Fresh Bar", "Street Food", "Tradition"][i] },
            } as Product))).map((p) => (
              <ProductCard
                key={p.id}
                item={p}
                onPress={() => {}}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe:      { backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.bg,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 0,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.text, marginBottom: 12 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    paddingHorizontal: 14, height: 44, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  tabsRow: { flexDirection: "row", gap: 8, paddingBottom: 1 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 2.5, borderBottomColor: "transparent",
  },
  tabActive:      { borderBottomColor: Colors.primary },
  tabLabel:       { fontSize: 13, fontWeight: "600", color: Colors.text3 },
  tabLabelActive: { color: Colors.primary },

  productsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 0 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: Colors.text3, textAlign: "center", paddingHorizontal: 32 },
});
