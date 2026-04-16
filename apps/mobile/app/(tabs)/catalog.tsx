"use client";
import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";

const BRANCH_TYPE_LABEL: Record<string, { fr: string; en: string }> = {
  supermarket: { fr: "Supermarché", en: "Supermarket" },
  superette:   { fr: "Supérette",   en: "Convenience" },
  restaurant:  { fr: "Restaurant",  en: "Restaurant"  },
  cafe:        { fr: "Café",        en: "Café"        },
  bakery:      { fr: "Boulangerie", en: "Bakery"      },
  pharmacy:    { fr: "Pharmacie",   en: "Pharmacy"    },
  other:       { fr: "Autre",       en: "Other"       },
};

interface Branch {
  id: string; name: string; city: string; address: string; type?: string;
  brands?: { id: string; name: string; logo_url: string | null };
}
interface Product {
  id: string; name_fr: string; name_en: string; price: number;
  image_url: string | null; promo_price: number | null; is_hidden: boolean;
  category_id: string | null;
  categories?: { name_fr: string; name_en: string };
  product_images?: { url: string; is_primary: boolean }[];
}
interface Category { id: string; name_fr: string; name_en: string; icon: string | null }
type ApiResponse<T> = { success: boolean; data: T };

export default function CatalogScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const { data: branchesRes, isLoading: branchesLoading } = useQuery<ApiResponse<Branch[]>>({
    queryKey: ["branches-catalog"],
    queryFn: () => apiGet("/branches/nearby"),
  });
  const branches = branchesRes?.data ?? [];

  // ── Favoris ──────────────────────────────────────────────────────────────
  const { data: favRes } = useQuery<ApiResponse<{ branch_id: string }[]>>({
    queryKey: ["my-favorites"],
    queryFn: () => apiGet("/users/me/favorites"),
    staleTime: 1000 * 60 * 5,
  });
  const favoriteIds = new Set((favRes?.data ?? []).map((f) => f.branch_id));

  const favMutation = useMutation({
    mutationFn: (branchId: string) => apiPost(`/users/me/favorites/${branchId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-favorites"] }),
  });

  const { data: categoriesRes } = useQuery<ApiResponse<Category[]>>({
    queryKey: ["branch-categories-mobile", selectedBranch?.id],
    queryFn: () => apiGet(`/products/categories?branch_id=${selectedBranch!.id}`),
    enabled: !!selectedBranch,
  });
  const categories = categoriesRes?.data ?? [];

  const { data: productsRes, isLoading: productsLoading } = useQuery<ApiResponse<Product[]>>({
    queryKey: ["branch-products-catalog", selectedBranch?.id],
    queryFn: () => apiGet(`/products/branch/${selectedBranch!.id}`),
    enabled: !!selectedBranch,
  });
  const allProducts = productsRes?.data ?? [];
  const products = allProducts.filter((p) => {
    if (category !== "all" && p.category_id !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name_fr.toLowerCase().includes(q) || p.name_en.toLowerCase().includes(q);
    }
    return true;
  });

  const { addItem, setBranch, branch_id: cartBranchId, clear: clearCart } = useCartStore();
  const cartCount = useCartStore((s) => s.getCount());
  const getName = (p: Product) => i18n.language === "en" ? p.name_en : p.name_fr;
  const getImage = (p: Product) => p.image_url ?? p.product_images?.[0]?.url ?? null;

  const handleAddToCart = useCallback((item: Product) => {
    if (!selectedBranch) return;
    const doAdd = () => {
      setBranch(selectedBranch.id, selectedBranch.name);
      addItem({ product_id: item.id, product_name: getName(item), product_image: getImage(item) ?? undefined, unit_price: item.promo_price ?? item.price, quantity: 1 });
    };
    if (cartBranchId && cartBranchId !== selectedBranch.id) {
      Alert.alert("Changer d'agence ?", "Votre panier contient des articles d'une autre agence. Le vider pour continuer ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Vider et continuer", style: "destructive", onPress: () => { clearCart(); doAdd(); } },
      ]);
    } else { doAdd(); }
  }, [selectedBranch, cartBranchId, addItem, setBranch, clearCart, i18n.language]);

  // ── Sélection d'agence ────────────────────────────────────────────────────
  if (!selectedBranch) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.header}>
            <Text style={styles.title}>Choisir une agence</Text>
            <Text style={styles.subtitle}>Sélectionnez où vous souhaitez commander</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={Colors.text3} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher une agence…"
                placeholderTextColor={Colors.text3}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>
        </SafeAreaView>
        {branchesLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={branches.filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.brands?.name?.toLowerCase().includes(search.toLowerCase()))}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.branchList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.branchCard} onPress={() => { setSelectedBranch(item); setSearch(""); setCategory("all"); }} activeOpacity={0.85}>
                <View style={styles.branchLogo}>
                  {item.brands?.logo_url ? (
                    <Image source={{ uri: item.brands.logo_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Ionicons name="storefront-outline" size={24} color={Colors.primary} />
                  )}
                </View>
                <View style={styles.branchInfo}>
                  <Text style={styles.branchName}>{item.brands?.name ?? item.name}</Text>
                  <View style={styles.branchMeta}>
                    <View style={styles.typePill}>
                      <Text style={styles.typePillText}>{BRANCH_TYPE_LABEL[item.type ?? "other"]?.[i18n.language === "en" ? "en" : "fr"] ?? "Autre"}</Text>
                    </View>
                    <Text style={styles.branchCity}>{item.city}</Text>
                  </View>
                  <Text style={styles.branchAddress} numberOfLines={1}>{item.address}</Text>
                </View>
                <TouchableOpacity
                  style={styles.favBtn}
                  onPress={(e) => { e.stopPropagation(); favMutation.mutate(item.id); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={favoriteIds.has(item.id) ? "heart" : "heart-outline"}
                    size={20}
                    color={favoriteIds.has(item.id) ? Colors.error : Colors.text3}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="storefront-outline" size={48} color={Colors.border} />
                <Text style={styles.emptyText}>Aucune agence disponible</Text>
              </View>
            }
          />
        )}
      </View>
    );
  }

  // ── Catalogue de l'agence ─────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backRow} onPress={() => { setSelectedBranch(null); setSearch(""); setCategory("all"); }}>
            <Ionicons name="arrow-back" size={18} color={Colors.text3} />
            <Text style={styles.backText}>Changer d'agence</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selectedBranch.brands?.name ?? selectedBranch.name}</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.text3} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("common.search")}
              placeholderTextColor={Colors.text3}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={Colors.text3} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      {/* Catégories */}
      <FlatList
        data={[{ id: "all", name_fr: "Tout", name_en: "All", icon: null } as Category, ...categories]}
        horizontal showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.id}
        style={styles.categories}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.pill, category === item.id && styles.pillActive]}
            onPress={() => setCategory(item.id)}
          >
            <Text style={[styles.pillText, category === item.id && styles.pillTextActive]}>
              {item.icon ? `${item.icon} ` : ""}{i18n.language === "en" ? item.name_en : item.name_fr}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Produits */}
      {productsLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
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
              activeOpacity={0.9}
            >
              <View style={styles.imgWrap}>
                {getImage(item) ? (
                  <Image source={{ uri: getImage(item)! }} style={styles.img} contentFit="cover" />
                ) : (
                  <View style={styles.imgFallback}>
                    <Ionicons name="cube-outline" size={36} color={Colors.border} />
                  </View>
                )}
                {item.promo_price && (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoText}>-{Math.round((1 - item.promo_price / item.price) * 100)}%</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.productName} numberOfLines={2}>{getName(item)}</Text>
                <Text style={styles.categoryLabel} numberOfLines={1}>{item.categories?.name_fr ?? ""}</Text>
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
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={(e) => { e.stopPropagation(); handleAddToCart(item); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>{search ? "Aucun résultat" : t("common.noResults")}</Text>
            </View>
          }
        />
      )}

      {/* FAB panier */}
      {cartCount > 0 && (
        <TouchableOpacity style={styles.cartFab} onPress={() => router.push("/(tabs)/cart")} activeOpacity={0.9}>
          <Ionicons name="cart" size={20} color="#fff" />
          <Text style={styles.cartFabText}>{cartCount} article{cartCount > 1 ? "s" : ""} dans le panier</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.bg, paddingHorizontal: 20, paddingBottom: 14, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 8,
  },
  title:    { fontSize: 20, fontWeight: "800", color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.text2 },
  backRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 13, color: Colors.text3 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  categories: { backgroundColor: Colors.bg, maxHeight: 60 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full, backgroundColor: Colors.inputBg,
  },
  pillActive:      { backgroundColor: Colors.primary },
  pillText:        { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  pillTextActive:  { color: "#fff" },
  // Branch list
  branchList: { padding: 16, paddingTop: 8, gap: 10 },
  branchCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: 14, ...Shadow.sm,
  },
  branchLogo: {
    width: 56, height: 56, borderRadius: Radius.md,
    backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  branchInfo: { flex: 1, gap: 4 },
  branchName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  branchMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  typePill: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  typePillText: { fontSize: 11, fontWeight: "600", color: Colors.primary },
  branchCity: { fontSize: 12, color: Colors.text3 },
  branchAddress: { fontSize: 11, color: Colors.text3 },
  favBtn: { padding: 6 },
  // Product grid
  grid: { padding: 12, paddingBottom: 100 },
  card: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginBottom: 12, overflow: "hidden", ...Shadow.sm,
  },
  imgWrap:    { height: 130, backgroundColor: Colors.inputBg },
  img:        { width: "100%", height: "100%" },
  imgFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  promoBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.xs,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  promoText:     { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardBody:      { padding: 10, gap: 3 },
  productName:   { fontSize: 13, fontWeight: "600", color: Colors.text },
  categoryLabel: { fontSize: 11, color: Colors.text3 },
  cardFooter:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 },
  price:         { fontSize: 13, fontWeight: "700", color: Colors.primary },
  priceOriginal: { fontSize: 10, color: Colors.text3, textDecorationLine: "line-through" },
  pricePromo:    { fontSize: 13, fontWeight: "700", color: Colors.primary },
  addBtn: {
    width: 30, height: 30, borderRadius: Radius.sm,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  empty:     { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.text3 },
  // Cart FAB
  cartFab: {
    position: "absolute", bottom: 16, left: 20, right: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 14, ...Shadow.primary,
  },
  cartFabText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
