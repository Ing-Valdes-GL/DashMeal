import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";

const { width } = Dimensions.get("window");

interface ProductDetail {
  id: string; name_fr: string; name_en: string;
  description_fr: string | null; description_en: string | null;
  price: number; is_active: boolean;
  avg_rating: number | null; ratings_count: number | null;
  categories?: { name_fr: string; name_en: string };
  product_images?: { url: string; is_primary: boolean }[];
}

function InteractiveStars({
  current, onRate, disabled,
}: { current: number | null; onRate: (r: number) => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? current ?? 0;
  return (
    <View style={istar.row}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity
          key={s}
          onPress={() => !disabled && onRate(s)}
          activeOpacity={0.7}
          style={istar.btn}
        >
          <Ionicons
            name={display >= s ? "star" : "star-outline"}
            size={32}
            color={display >= s ? "#FFC107" : Colors.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: resp, isLoading } = useQuery<{ success: boolean; data: ProductDetail }>({
    queryKey: ["product", id],
    queryFn: () => apiGet(`/products/${id}`),
  });
  const product = resp?.data;

  const { data: myRatingResp } = useQuery<{ data: { rating: number | null } }>({
    queryKey: ["product-my-rating", id],
    queryFn: () => apiGet(`/products/${id}/my-rating`),
    enabled: !!id && isAuthenticated,
    staleTime: 60_000,
  });
  const myRating = myRatingResp?.data?.rating ?? null;

  const rateMutation = useMutation({
    mutationFn: (rating: number) => apiPost(`/products/${id}/rate`, { rating }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["product-my-rating", id] });
      Alert.alert(t("common.success"), t("products.rateSuccess"));
    },
    onError: () => Alert.alert(t("common.error"), t("products.rateError")),
  });

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }
  if (!product) return null;

  const name = i18n.language === "en" ? product.name_en : product.name_fr;
  const description = i18n.language === "en" ? product.description_en : product.description_fr;
  const images = product.product_images ?? [];
  const primaryImage = images.find((i) => i.is_primary) ?? images[0];
  const avgRating = product.avg_rating ?? 0;
  const ratingsCount = product.ratings_count ?? 0;

  const handleAddToCart = () => {
    addItem({
      product_id: product.id,
      product_name: name,
      product_image: primaryImage?.url,
      unit_price: product.price,
      quantity: qty,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Image hero ───────────────────────────────────────────────────────── */}
      <View style={styles.imgWrap}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage.url }} style={styles.img} contentFit="cover" />
        ) : (
          <View style={styles.imgFallback}>
            <Ionicons name="cube-outline" size={72} color={Colors.border} />
          </View>
        )}
        <View style={styles.imgOverlay} />
        <SafeAreaView style={styles.backArea} edges={["top"]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* ── Fiche produit ────────────────────────────────────────────────────── */}
      <View style={styles.sheet}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          {/* Catégorie */}
          {product.categories && (
            <View style={styles.catRow}>
              <View style={styles.catPill}>
                <Text style={styles.catText}>
                  {i18n.language === "en" ? product.categories.name_en : product.categories.name_fr}
                </Text>
              </View>
            </View>
          )}

          {/* Nom + Prix */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
          </View>

          {/* Disponibilité */}
          <View style={styles.stockRow}>
            <View style={[styles.dot, product.is_active ? styles.dotGreen : styles.dotRed]} />
            <Text style={[styles.stockText, product.is_active ? { color: Colors.success } : { color: Colors.error }]}>
              {product.is_active ? t("products.inStock") : t("products.outOfStock")}
            </Text>
          </View>

          {/* Rating agrégé (lecture seule) */}
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={avgRating >= s ? "star" : avgRating >= s - 0.5 ? "star-half" : "star-outline"}
                size={14}
                color="#FFC107"
              />
            ))}
            <Text style={styles.ratingText}>
              {ratingsCount > 0
                ? `${avgRating.toFixed(1)}  •  ${ratingsCount} ${t("products.reviews")}`
                : t("products.noRating")}
            </Text>
          </View>

          {/* Description */}
          {description && (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>{t("products.description")}</Text>
              <Text style={styles.desc}>{description}</Text>
            </View>
          )}

          {/* ── Zone de notation interactive ─────────────────────────────────── */}
          <View style={styles.rateSection}>
            <Text style={styles.rateTitle}>{t("products.rateTitle")}</Text>
            {isAuthenticated ? (
              <>
                <Text style={styles.rateHint}>{t("products.rateHint")}</Text>
                <InteractiveStars
                  current={myRating}
                  onRate={(r) => rateMutation.mutate(r)}
                  disabled={rateMutation.isPending}
                />
                {rateMutation.isPending && (
                  <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />
                )}
                {myRating && (
                  <Text style={styles.myRatingText}>
                    {`${t("products.reviews")} : ${myRating}/5`}
                  </Text>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={styles.loginToRateBtn}
                onPress={() => router.push("/(auth)/login")}
              >
                <Ionicons name="person-outline" size={16} color={Colors.primary} />
                <Text style={styles.loginToRateText}>{t("products.loginToRate")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      {/* ── Barre bas : quantité + bouton ────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <View style={styles.qtyControl}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))}>
            <Ionicons name="remove" size={16} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.qtyVal}>{qty}</Text>
          <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnAdd]} onPress={() => setQty(qty + 1)}>
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, !product.is_active && styles.addBtnOff, added && styles.addBtnOk]}
          onPress={handleAddToCart}
          disabled={!product.is_active}
          activeOpacity={0.85}
        >
          <Ionicons name={added ? "checkmark" : "cart-outline"} size={18} color="#fff" />
          <Text style={styles.addBtnText}>
            {added ? t("products.added") : `${t("products.addToCart")} — ${formatCurrency(product.price * qty)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const istar = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginTop: 8 },
  btn: { padding: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loader:    { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  imgWrap:   { width, height: 320, backgroundColor: Colors.inputBg },
  img:       { width: "100%", height: "100%" },
  imgFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.pageBg },
  imgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },
  backArea: { position: "absolute", top: 0, left: 0, right: 0 },
  backBtn: {
    margin: 16, width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center",
  },
  sheet: {
    flex: 1, backgroundColor: Colors.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -24, padding: 22,
  },
  catRow:   { marginBottom: 10 },
  catPill:  { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4 },
  catText:  { fontSize: 12, fontWeight: "600", color: Colors.primary },
  nameRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  name:     { flex: 1, fontSize: 22, fontWeight: "800", color: Colors.text, lineHeight: 28 },
  price:    { fontSize: 22, fontWeight: "800", color: Colors.primary },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  dot:      { width: 7, height: 7, borderRadius: 4 },
  dotGreen: { backgroundColor: Colors.success },
  dotRed:   { backgroundColor: Colors.error },
  stockText:{ fontSize: 13, fontWeight: "500" },
  ratingRow:{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 18 },
  ratingText: { fontSize: 12, color: Colors.text2, marginLeft: 4 },
  descSection:{ gap: 8, marginBottom: 24 },
  descTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  desc:      { fontSize: 14, color: Colors.text2, lineHeight: 22 },
  // Rating section
  rateSection: {
    backgroundColor: Colors.pageBg, borderRadius: Radius.lg,
    padding: 16, gap: 6, marginTop: 4,
  },
  rateTitle:    { fontSize: 15, fontWeight: "700", color: Colors.text },
  rateHint:     { fontSize: 12, color: Colors.text3 },
  myRatingText: { fontSize: 12, color: Colors.primary, fontWeight: "600", marginTop: 4 },
  loginToRateBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10,
  },
  loginToRateText: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32,
    ...Shadow.sm,
  },
  qtyControl: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.inputBg, borderRadius: Radius.full, padding: 6,
  },
  qtyBtn: {
    width: 34, height: 34, borderRadius: Radius.full,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  qtyBtnAdd: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  qtyVal:    { fontSize: 16, fontWeight: "700", color: Colors.text, minWidth: 26, textAlign: "center" },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.full, height: 52,
    ...Shadow.primary,
  },
  addBtnOff:  { backgroundColor: Colors.border },
  addBtnOk:   { backgroundColor: Colors.success },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
