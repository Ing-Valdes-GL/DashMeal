import { useState } from "react";
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
  id: string; name: string; price: number;
  original_price?: number; image_url?: string;
  unit?: string; branch?: { name: string };
}

const CATEGORIES = [
  { key: "all",         label: "Tout",          icon: "grid-outline" as const,         bg: Colors.primaryLight, color: Colors.primary },
  { key: "restaurant",  label: "Restaurants",   icon: "restaurant-outline" as const,   bg: "#FFF3E0", color: "#FF9800" },
  { key: "supermarket", label: "Supermarché",   icon: "storefront-outline" as const,   bg: "#E3F2FD", color: "#2196F3" },
  { key: "bakery",      label: "Boulangerie",   icon: "cafe-outline" as const,         bg: "#FFF8E1", color: "#FFC107" },
  { key: "cafe",        label: "Cafés",         icon: "wine-outline" as const,         bg: "#EFEBE9", color: "#795548" },
  { key: "pharmacy",    label: "Pharmacies",    icon: "medkit-outline" as const,       bg: "#E8F5E9", color: Colors.primary },
  { key: "juice",       label: "Jus",           icon: "water-outline" as const,        bg: "#E0F7FA", color: "#00BCD4" },
  { key: "african",     label: "Cuisine locale",icon: "globe-outline" as const,        bg: "#F3E5F5", color: "#9C27B0" },
  { key: "fastfood",    label: "Fast-food",     icon: "fast-food-outline" as const,   bg: "#FFEBEE", color: "#F44336" },
];

const MOCK: Product[] = [
  { id: "m1", name: "Diet Coke",         price: 900,  unit: "355ml",  branch: { name: "Hypermarché" } },
  { id: "m2", name: "Sprite Can",        price: 900,  unit: "325ml",  branch: { name: "Hypermarché" } },
  { id: "m3", name: "Apple & Grape Juice",price: 7500, unit: "2L",    branch: { name: "Fresh Bar" } },
  { id: "m4", name: "Orange Juice",      price: 5000, unit: "2L",    branch: { name: "Fresh Bar" } },
  { id: "m5", name: "Coca Cola Can",     price: 900,  unit: "330ml",  branch: { name: "Hypermarché" } },
  { id: "m6", name: "Pepsi Can",         price: 900,  unit: "330ml",  branch: { name: "Hypermarché" } },
  { id: "m7", name: "Ndolé aux crevettes",price: 2500, branch: { name: "Saveurs du Pays" } },
  { id: "m8", name: "Poulet braisé",     price: 3500, original_price: 5000, branch: { name: "Chez Paul" } },
  { id: "m9", name: "Pizza Margherita",  price: 5000, branch: { name: "La Bella Napoli" } },
  { id: "m10", name: "Jus tropical",     price: 1500, unit: "500ml",  branch: { name: "Fresh Bar" } },
  { id: "m11", name: "Pastels",          price: 800,  branch: { name: "Street Food" } },
  { id: "m12", name: "Beignets haricots",price: 600,  branch: { name: "Tradition" } },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { category: initCategory, q: initQ } = useLocalSearchParams<{ category?: string; q?: string }>();
  const addItem = useCartStore((s) => s.addItem);

  const [search, setSearch] = useState(initQ ?? "");
  const [activeCategory, setActiveCategory] = useState(initCategory ?? "all");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["explore-products", activeCategory, search],
    queryFn: () => apiGet("/products/public", {
      limit: 20,
      ...(activeCategory !== "all" ? { category: activeCategory } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    staleTime: 60_000,
  });

  const products = data?.data?.length ? data.data : MOCK.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAdd = (p: Product) => addItem({ product_id: p.id, product_name: p.name, product_image: p.image_url, unit_price: p.price, quantity: 1 });

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Find Products</Text>
          <TouchableOpacity style={s.filterBtn} onPress={() => setShowFilters(!showFilters)}>
            <Ionicons name="options-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.text3} />
            <TextInput
              style={s.searchInput}
              placeholder="Search Store"
              placeholderTextColor={Colors.text3}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
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
            <Text style={s.emptyText}>Aucun produit trouvé</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {products.map((p) => {
              const hasDiscount = p.original_price && p.original_price > p.price;
              return (
                <TouchableOpacity key={p.id} style={s.card} onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })} activeOpacity={0.88}>
                  <View style={s.cardImgWrap}>
                    {p.image_url
                      ? <Image source={{ uri: p.image_url }} style={s.cardImg} contentFit="cover" />
                      : <View style={[s.cardImg, s.cardImgFallback]}><Ionicons name="fast-food-outline" size={38} color={Colors.primary} /></View>
                    }
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.cardName} numberOfLines={2}>{p.name}</Text>
                    {p.unit && <Text style={s.cardUnit}>{p.unit}, Prix</Text>}
                    <View style={s.priceRow}>
                      <Text style={s.cardPrice}>{formatCurrency(p.price)}</Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  filterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center" },
  searchRow: { paddingHorizontal: 16, paddingBottom: 4 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.pageBg, borderRadius: Radius.lg, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, color: Colors.text3, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 14, paddingTop: 4 },
  card: { width: "47%", backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", position: "relative" },
  cardImgWrap: { alignItems: "center", justifyContent: "center", backgroundColor: Colors.pageBg, height: 120 },
  cardImg: { width: "100%", height: 120 },
  cardImgFallback: { alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 10, paddingBottom: 42 },
  cardName: { fontSize: 13, fontWeight: "700", color: Colors.text, lineHeight: 18, marginBottom: 2 },
  cardUnit: { fontSize: 11, color: Colors.text3, marginBottom: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardPrice: { fontSize: 14, fontWeight: "800", color: Colors.text },
  addBtn: { position: "absolute", bottom: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
});

const cat = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  pillIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pillLabel: { fontSize: 12, fontWeight: "600", color: Colors.text2 },
});
