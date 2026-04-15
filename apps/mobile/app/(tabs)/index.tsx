import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, FlatList, RefreshControl, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

const BRANCH_TYPE_LABEL: Record<string, { fr: string; en: string; icon: string }> = {
  supermarket: { fr: "Supermarché", en: "Supermarket", icon: "🏪" },
  superette:   { fr: "Supérette",   en: "Convenience store", icon: "🏬" },
  restaurant:  { fr: "Restaurant",  en: "Restaurant", icon: "🍽️" },
  cafe:        { fr: "Café",        en: "Café", icon: "☕" },
  bakery:      { fr: "Boulangerie", en: "Bakery", icon: "🥖" },
  pharmacy:    { fr: "Pharmacie",   en: "Pharmacy", icon: "💊" },
  other:       { fr: "Autre",       en: "Other", icon: "🏪" },
};

interface Branch {
  id: string; name: string; city: string; address: string; type?: string;
  brands?: { id: string; name: string; logo_url: string | null };
}

type ApiResponse<T> = { success: boolean; data: T };

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const { data: branchesRes, isLoading: branchesLoading, refetch } = useQuery<ApiResponse<Branch[]>>({
    queryKey: ["branches-home"],
    queryFn: () => apiGet("/branches/nearby"),
  });
  const branches = branchesRes?.data ?? [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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
              <Text style={styles.greeting}>
                {t("home.greeting")}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
              </Text>
              <Text style={styles.headerSub}>Que voulez-vous commander ?</Text>
            </View>
            <TouchableOpacity style={styles.notifBtn}>
              <Ionicons name="notifications-outline" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Search — taps through to catalog */}
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push("/(tabs)/catalog")}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={18} color="#475569" />
            <Text style={styles.searchPlaceholder}>{t("home.searchPlaceholder")}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Nearby branches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("home.nearbyBranches")}</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/catalog")}>
              <Text style={styles.seeAll}>{t("common.seeAll")}</Text>
            </TouchableOpacity>
          </View>
          {branchesLoading ? (
            <ActivityIndicator color="#f97316" style={{ margin: 20 }} />
          ) : branches.length === 0 ? (
            <Text style={styles.emptyText}>Aucune agence disponible pour le moment</Text>
          ) : (
            <FlatList
              data={branches}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(b) => b.id}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.branchCard}
                  onPress={() => router.push("/(tabs)/catalog")}
                >
                  <View style={styles.branchLogo}>
                    {item.brands?.logo_url ? (
                      <Image source={{ uri: item.brands.logo_url }} style={styles.branchLogoImg} contentFit="cover" />
                    ) : (
                      <Ionicons name="storefront-outline" size={24} color="#f97316" />
                    )}
                  </View>
                  <Text style={styles.branchName} numberOfLines={1}>{item.brands?.name ?? item.name}</Text>
                  <Text style={styles.branchCity} numberOfLines={1}>
                    {BRANCH_TYPE_LABEL[item.type ?? "other"]?.icon ?? "🏪"} {item.city}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Explore catalog CTA */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.ctaCard}
            onPress={() => router.push("/(tabs)/catalog")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["rgba(249,115,22,0.15)", "rgba(249,115,22,0.05)"]}
              style={styles.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.ctaContent}>
                <View style={styles.ctaIcon}>
                  <Ionicons name="grid-outline" size={26} color="#f97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ctaTitle}>
                    {i18n.language === "en" ? "Explore the catalog" : "Explorer le catalogue"}
                  </Text>
                  <Text style={styles.ctaSubtitle}>
                    {i18n.language === "en"
                      ? "Choose a branch and browse its products"
                      : "Choisissez une agence et parcourez ses produits"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#f97316" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
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
  headerTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 16,
  },
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
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  seeAll: { fontSize: 13, color: "#f97316", fontWeight: "500" },
  emptyText: { color: "#475569", fontSize: 13, paddingLeft: 4 },
  // Branch cards
  branchCard: { width: 90, alignItems: "center", gap: 8 },
  branchLogo: {
    width: 68, height: 68, borderRadius: 18,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  branchLogoImg: { width: "100%", height: "100%" },
  branchName: { fontSize: 11, fontWeight: "600", color: "#e2e8f0", textAlign: "center" },
  branchCity: { fontSize: 10, color: "#475569", textAlign: "center" },
  // CTA card
  ctaCard: { borderRadius: 18, overflow: "hidden" },
  ctaGradient: {
    borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", borderRadius: 18,
  },
  ctaContent: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 18, paddingVertical: 18,
  },
  ctaIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  ctaTitle: { fontSize: 15, fontWeight: "700", color: "#fff", marginBottom: 3 },
  ctaSubtitle: { fontSize: 12, color: "#64748b", lineHeight: 17 },
});
