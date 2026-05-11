import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { apiGet, apiDelete } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius, Shadow } from "@/lib/theme";

interface FavoriteProduct {
  id: string;
  product_id: string;
  product: {
    id: string; name: string; price: number;
    image_url?: string; unit?: string;
    branch?: { name: string };
  };
}

export default function FavouritesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, isGuest } = useAuthStore();
  const addItem = useCartStore((s) => s.addItem);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: FavoriteProduct[] }>({
    queryKey: ["favorites"],
    queryFn: () => apiGet("/user/favorites"),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const { mutate: removeFav } = useMutation({
    mutationFn: (productId: string) => apiDelete(`/user/favorites/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  if (isGuest || !isAuthenticated) {
    return (
      <View style={s.container}>
        <StatusBar style="dark" />
        <SafeAreaView edges={["top"]}><View style={s.header}><Text style={s.headerTitle}>Favourite</Text></View></SafeAreaView>
        <View style={s.authWall}>
          <View style={s.authIcon}><Ionicons name="heart-outline" size={56} color={Colors.text3} /></View>
          <Text style={s.authTitle}>Vos favoris vous attendent</Text>
          <Text style={s.authSub}>Connectez-vous pour sauvegarder vos produits préférés</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={s.loginBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const favorites = data?.data ?? [];

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}><Text style={s.headerTitle}>Favourite</Text></View>
      </SafeAreaView>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : favorites.length === 0 ? (
        <View style={s.authWall}>
          <View style={s.authIcon}><Ionicons name="heart-outline" size={56} color={Colors.text3} /></View>
          <Text style={s.authTitle}>{t("favorites.empty")}</Text>
          <Text style={s.authSub}>{t("favorites.emptySubtitle")}</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.push("/(tabs)/explore" as any)}>
            <Text style={s.loginBtnText}>{t("favorites.browse")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => {
            const p = item.product;
            return (
              <TouchableOpacity
                style={s.item}
                onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })}
                activeOpacity={0.88}
              >
                <View style={s.imgWrap}>
                  {p.image_url
                    ? <Image source={{ uri: p.image_url }} style={s.img} contentFit="cover" />
                    : <View style={[s.img, s.imgFallback]}><Ionicons name="fast-food-outline" size={28} color={Colors.primary} /></View>
                  }
                </View>
                <View style={s.body}>
                  <Text style={s.name} numberOfLines={2}>{p.name}</Text>
                  {p.unit && <Text style={s.unit}>{p.unit}, Prix</Text>}
                  {p.branch && <Text style={s.branch}>{p.branch.name}</Text>}
                  <Text style={s.price}>{formatCurrency(p.price)}</Text>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.heartBtn} onPress={() => removeFav(p.id)}>
                    <Ionicons name="heart" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.addBtn} onPress={() => addItem({ product_id: p.id, product_name: p.name, product_image: p.image_url, unit_price: p.price, quantity: 1 })}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.text3} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  safe: { backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  authWall: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  authIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  authTitle: { fontSize: 18, fontWeight: "700", color: Colors.text, textAlign: "center" },
  authSub: { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 22 },
  loginBtn: { marginTop: 12, height: 52, paddingHorizontal: 32, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  imgWrap: { width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.pageBg, overflow: "hidden" },
  img: { width: 64, height: 64 },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 2, lineHeight: 18 },
  unit: { fontSize: 11, color: Colors.text3, marginBottom: 2 },
  branch: { fontSize: 11, color: Colors.text3, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: "800", color: Colors.text },
  actions: { alignItems: "center", gap: 8 },
  heartBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
});
