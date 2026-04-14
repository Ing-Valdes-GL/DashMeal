"use client";
import { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

interface Branch {
  id: string; name: string; city: string; address: string;
  brands?: { id: string; name: string; logo_url: string | null };
}

interface Product {
  id: string; name_fr: string; name_en: string; price: number;
  image_url: string | null; promo_price: number | null; is_hidden: boolean;
  categories?: { name_fr: string };
  product_images?: { url: string; is_primary: boolean }[];
}

interface Category { id: string; name_fr: string; name_en: string }

// apiGet mobile returns the full { success, data } envelope
type ApiResponse<T> = { success: boolean; data: T };

export default function CatalogScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // Agences disponibles (endpoint public)
  const { data: branchesRes, isLoading: branchesLoading } = useQuery<ApiResponse<Branch[]>>({
    queryKey: ["branches-catalog"],
    queryFn: () => apiGet("/branches/nearby"),
  });
  const branches = branchesRes?.data ?? [];

  // Catégories
  const { data: categoriesRes } = useQuery<ApiResponse<Category[]>>({
    queryKey: ["categories"],
    queryFn: () => apiGet("/products/categories"),
  });
  const categories = categoriesRes?.data ?? [];

  // Produits de l'agence sélectionnée
  const { data: productsRes, isLoading: productsLoading } = useQuery<ApiResponse<Product[]>>({
    queryKey: ["branch-products-catalog", selectedBranch?.id],
    queryFn: () => apiGet(`/products/branch/${selectedBranch!.id}`),
    enabled: !!selectedBranch,
  });
  const allProducts = productsRes?.data ?? [];

  // Filtrer localement
  const products = allProducts.filter((p) => {
    if (p.is_hidden) return false;
    if (category !== "all" && p.categories?.name_fr !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name_fr.toLowerCase().includes(q) || p.name_en.toLowerCase().includes(q);
    }
    return true;
  });

  const getName = (p: Product) => i18n.language === "en" ? p.name_en : p.name_fr;
  const getImage = (p: Product) => p.image_url ?? p.product_images?.[0]?.url ?? null;

  // Affichage sélection d'agence
  if (!selectedBranch) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Choisir une agence</Text>
          <Text style={styles.subtitle}>Sélectionnez l'agence où vous souhaitez commander</Text>
        </View>
        {branchesLoading ? (
          <ActivityIndicator color="#f97316" style={{ flex: 1 }} />
        ) : branches.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={40} color="#1e293b" />
            <Text style={styles.emptyText}>Aucune agence disponible</Text>
          </View>
        ) : (
          <FlatList
            data={branches}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.branchList}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.branchCard} onPress={() => setSelectedBranch(item)}>
                <View style={styles.branchLogo}>
                  {item.brands?.logo_url ? (
                    <Image source={{ uri: item.brands.logo_url }} style={styles.branchLogoImg} contentFit="cover" />
                  ) : (
                    <Ionicons name="storefront-outline" size={24} color="#f97316" />
                  )}
                </View>
                <View style={styles.branchInfo}>
                  <Text style={styles.branchName}>{item.name}</Text>
                  <Text style={styles.branchCity}>
                    {item.brands?.name ? `${item.brands.name} · ` : ""}{item.city}
                  </Text>
                  <Text style={styles.branchAddress} numberOfLines={1}>{item.address}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#475569" />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // Affichage catalogue de l'agence sélectionnée
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header agence */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backRow} onPress={() => { setSelectedBranch(null); setSearch(""); setCategory("all"); }}>
          <Ionicons name="arrow-back" size={18} color="#94a3b8" />
          <Text style={styles.backText}>Changer d'agence</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selectedBranch.name}</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="#475569" />
          <TextInput
            style={styles.searchInput}
            placeholder={t("common.search")}
            placeholderTextColor="#475569"
            value={search}
            onChangeText={(v) => { setSearch(v); }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#475569" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Catégories */}
      {categories.length > 0 && (
        <FlatList
          data={[{ id: "all", name_fr: "Tout", name_en: "All" } as Category, ...categories]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => i.id}
          style={styles.categories}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pill, category === item.id && styles.pillActive]}
              onPress={() => setCategory(item.id)}
            >
              <Text style={[styles.pillText, category === item.id && styles.pillTextActive]}>
                {i18n.language === "en" ? item.name_en : item.name_fr}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Produits */}
      {productsLoading ? (
        <ActivityIndicator color="#f97316" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
            >
              <View style={styles.imgWrap}>
                {getImage(item) ? (
                  <Image source={{ uri: getImage(item)! }} style={styles.img} contentFit="cover" />
                ) : (
                  <Ionicons name="cube-outline" size={32} color="#334155" />
                )}
                {item.promo_price && (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoText}>
                      -{Math.round((1 - item.promo_price / item.price) * 100)}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.productName} numberOfLines={2}>{getName(item)}</Text>
                <Text style={styles.categoryLabel} numberOfLines={1}>
                  {item.categories?.name_fr ?? ""}
                </Text>
                <View style={styles.cardFooter}>
                  <View>
                    {item.promo_price ? (
                      <>
                        <Text style={styles.priceOriginal}>{formatCurrency(item.price)}</Text>
                        <Text style={styles.pricePromo}>{formatCurrency(item.promo_price)}</Text>
                      </>
                    ) : (
                      <Text style={styles.price}>{formatCurrency(item.price)}</Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.addBtn}>
                    <Ionicons name="add" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={40} color="#1e293b" />
              <Text style={styles.emptyText}>
                {search ? "Aucun résultat pour votre recherche" : t("common.noResults")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  header: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 10 },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 13, color: "#475569" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 13, color: "#94a3b8" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    borderRadius: 12, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  categories: { maxHeight: 44, marginBottom: 4 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#0f172a",
    borderWidth: 1, borderColor: "#1e293b",
  },
  pillActive: { backgroundColor: "rgba(249,115,22,0.15)", borderColor: "#f97316" },
  pillText: { fontSize: 13, fontWeight: "500", color: "#475569" },
  pillTextActive: { color: "#f97316" },
  // Branch list
  branchList: { padding: 16, gap: 12 },
  branchCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#0f172a", borderRadius: 16,
    borderWidth: 1, borderColor: "#1e293b", padding: 14,
  },
  branchLogo: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  branchLogoImg: { width: "100%", height: "100%" },
  branchInfo: { flex: 1, gap: 2 },
  branchName: { fontSize: 15, fontWeight: "700", color: "#fff" },
  branchCity: { fontSize: 12, color: "#f97316", fontWeight: "500" },
  branchAddress: { fontSize: 11, color: "#475569" },
  // Product grid
  grid: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },
  card: {
    flex: 1, backgroundColor: "#0f172a", borderRadius: 16,
    borderWidth: 1, borderColor: "#1e293b", overflow: "hidden",
    marginBottom: 12,
  },
  imgWrap: { height: 130, backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%" },
  promoBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "#f97316", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  promoText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardBody: { padding: 10, gap: 3 },
  productName: { fontSize: 13, fontWeight: "600", color: "#fff" },
  categoryLabel: { fontSize: 11, color: "#475569" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 },
  price: { fontSize: 13, fontWeight: "700", color: "#f97316" },
  priceOriginal: { fontSize: 10, color: "#475569", textDecorationLine: "line-through" },
  pricePromo: { fontSize: 13, fontWeight: "700", color: "#f97316" },
  addBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#f97316", alignItems: "center", justifyContent: "center",
  },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: "#334155", fontSize: 15 },
});
