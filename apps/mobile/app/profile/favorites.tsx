import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";

interface FavoriteItem {
  branch_id: string;
  branches: {
    id: string;
    name: string;
    address: string;
    city: string;
    type: string;
    brands: { id: string; name: string; logo_url: string | null };
  };
}

export default function FavoritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: resp, isLoading, refetch, isRefetching } = useQuery<{ success: boolean; data: FavoriteItem[] }>({
    queryKey: ["my-favorites"],
    queryFn: () => apiGet("/users/me/favorites"),
    staleTime: 1000 * 60,
  });
  const favorites = resp?.data ?? [];

  const removeMutation = useMutation({
    mutationFn: (branchId: string) => apiPost(`/users/me/favorites/${branchId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-favorites"] }),
    onError: () => Alert.alert("Erreur", "Impossible de retirer ce favori."),
  });

  const confirmRemove = (branchId: string, name: string) => {
    Alert.alert("Retirer des favoris", `Retirer "${name}" de vos favoris ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => removeMutation.mutate(branchId) },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes favoris</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.branch_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const branch = item.branches;
            const brand  = branch.brands;
            return (
              <View style={styles.card}>
                {/* Logo */}
                <View style={styles.logoWrap}>
                  {brand.logo_url ? (
                    <Image source={{ uri: brand.logo_url }} style={styles.logo} contentFit="cover" />
                  ) : (
                    <View style={[styles.logo, styles.logoFallback]}>
                      <Text style={styles.logoText}>{brand.name[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={styles.info}>
                  <Text style={styles.branchName} numberOfLines={1}>{branch.name}</Text>
                  <Text style={styles.brandName}>{brand.name}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={12} color={Colors.text3} />
                    <Text style={styles.metaText} numberOfLines={1}>{branch.city}</Text>
                    <View style={styles.typePill}>
                      <Text style={styles.typeText}>
                        {branch.type === "restaurant" ? "Restaurant" : branch.type === "grocery" ? "Épicerie" : branch.type}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.orderBtn}
                    onPress={() => router.push({ pathname: "/(tabs)/catalog" })}
                  >
                    <Text style={styles.orderBtnText}>Commander</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.heartBtn}
                    onPress={() => confirmRemove(item.branch_id, branch.name)}
                    disabled={removeMutation.isPending}
                  >
                    <Ionicons name="heart" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucun favori</Text>
              <Text style={styles.emptySubtitle}>
                Ajoutez des agences en favoris depuis le catalogue pour les retrouver ici
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/(tabs)/catalog")}>
                <Text style={styles.emptyBtnText}>Explorer le catalogue</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  list: { padding: 16, paddingBottom: 40, gap: 10 },

  card: {
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12, ...Shadow.sm,
  },
  logoWrap: { flexShrink: 0 },
  logo: { width: 52, height: 52, borderRadius: Radius.md },
  logoFallback: { backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 20, fontWeight: "700", color: Colors.primary },

  info: { flex: 1, gap: 2 },
  branchName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  brandName: { fontSize: 12, color: Colors.text3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { fontSize: 11, color: Colors.text3, flex: 1 },
  typePill: { backgroundColor: Colors.inputBg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 10, color: Colors.text3, fontWeight: "600" },

  actions: { alignItems: "center", gap: 8 },
  orderBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  orderBtnText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  heartBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#FFEBEE", alignItems: "center", justifyContent: "center",
  },

  empty: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.text3, textAlign: "center", lineHeight: 19 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
