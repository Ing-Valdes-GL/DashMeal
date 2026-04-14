import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, FlatList, RefreshControl, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

interface Brand {
  id: string; name: string; logo_url: string | null;
  branches?: { name: string; city: string }[];
}

interface Product {
  id: string; name_fr: string; name_en: string; price: number;
  is_active: boolean;
  categories?: { name_fr: string };
  product_images?: { url: string; is_primary: boolean }[];
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: brands, isLoading: brandsLoading, refetch: refetchBrands } = useQuery<Brand[]>({
    queryKey: ["brands-home"],
    queryFn: () => apiGet("/brands"),
  });

  const { data: featuredProducts, isLoading: productsLoading, refetch: refetchProducts } = useQuery<{ data: Product[] }>({
    queryKey: ["featured-products"],
    queryFn: () => apiGet("/products", { limit: 10, page: 1 }) as any,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBrands(), refetchProducts()]);
    setRefreshing(false);
  };

  const getProductName = (p: Product) =>
    i18n.language === "en" ? p.name_en : p.name_fr;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#f97316" />}
      >
        {/* Header */}
        <LinearGradient colors={["#0a0f1e", "#0f172a"]} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{t("home.greeting")}, {user?.name?.split(" ")[0] ?? ""} 👋</Text>
              <Text style={styles.headerSub}>Que voulez-vous commander ?</Text>
            </View>
            <TouchableOpacity style={styles.notifBtn}>
              <Ionicons name="notifications-outline" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push("/(tabs)/catalog")}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={18} color="#475569" />
            <Text style={styles.searchPlaceholder}>{t("home.searchPlaceholder")}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Brands */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("home.nearbyBranches")}</Text>
            <TouchableOpacity><Text style={styles.seeAll}>{t("common.seeAll")}</Text></TouchableOpacity>
          </View>
          {brandsLoading ? (
            <ActivityIndicator color="#f97316" style={{ margin: 20 }} />
          ) : (
            <FlatList
              data={brands ?? []}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.brandCard} onPress={() => {}}>
                  <View style={styles.brandLogo}>
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={styles.brandLogoImg} contentFit="cover" />
                    ) : (
                      <Ionicons name="storefront-outline" size={24} color="#f97316" />
                    )}
                  </View>
                  <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.brandCity} numberOfLines={1}>
                    {item.branches?.[0]?.city ?? ""}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Featured products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("home.featured")}</Text>
          </View>
          {productsLoading ? (
            <ActivityIndicator color="#f97316" style={{ margin: 20 }} />
          ) : (
            <FlatList
              data={featuredProducts?.data ?? []}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productCard}
                  onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
                >
                  <View style={styles.productImg}>
                    {item.product_images?.[0] ? (
                      <Image source={{ uri: item.product_images[0].url }} style={styles.productImgEl} contentFit="cover" />
                    ) : (
                      <Ionicons name="cube-outline" size={32} color="#334155" />
                    )}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{getProductName(item)}</Text>
                    <Text style={styles.productCategory} numberOfLines={1}>
                      {item.categories?.name_fr ?? ""}
                    </Text>
                    <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  greeting: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "#475569", marginTop: 2 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    borderRadius: 14, paddingHorizontal: 16, height: 48,
  },
  searchPlaceholder: { color: "#475569", fontSize: 14 },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  seeAll: { fontSize: 13, color: "#f97316", fontWeight: "500" },
  brandCard: { width: 100, alignItems: "center", gap: 8 },
  brandLogo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  brandLogoImg: { width: "100%", height: "100%" },
  brandName: { fontSize: 12, fontWeight: "600", color: "#e2e8f0", textAlign: "center" },
  brandCity: { fontSize: 10, color: "#475569", textAlign: "center" },
  productCard: {
    width: 160, backgroundColor: "#0f172a", borderRadius: 16,
    borderWidth: 1, borderColor: "#1e293b", overflow: "hidden",
  },
  productImg: {
    height: 120, backgroundColor: "#1e293b",
    alignItems: "center", justifyContent: "center",
  },
  productImgEl: { width: "100%", height: "100%" },
  productInfo: { padding: 12, gap: 3 },
  productName: { fontSize: 13, fontWeight: "600", color: "#fff" },
  productCategory: { fontSize: 11, color: "#475569" },
  productPrice: { fontSize: 14, fontWeight: "700", color: "#f97316", marginTop: 4 },
});
