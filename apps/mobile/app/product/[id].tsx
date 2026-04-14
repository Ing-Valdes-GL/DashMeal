import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

interface ProductDetail {
  id: string; name_fr: string; name_en: string;
  description_fr: string | null; description_en: string | null;
  price: number; is_active: boolean;
  categories?: { name_fr: string; name_en: string };
  product_images?: { url: string; is_primary: boolean }[];
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { addItem, items } = useCartStore();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: product, isLoading } = useQuery<ProductDetail>({
    queryKey: ["product", id],
    queryFn: () => apiGet(`/products/${id}`),
  });

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#f97316" size="large" />
      </View>
    );
  }

  if (!product) return null;

  const name = i18n.language === "en" ? product.name_en : product.name_fr;
  const description = i18n.language === "en" ? product.description_en : product.description_fr;
  const images = product.product_images ?? [];
  const primaryImage = images.find((i) => i.is_primary) ?? images[0];

  const inCart = items.find((i) => i.product_id === product.id);

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
      {/* Image */}
      <View style={styles.imgWrap}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage.url }} style={styles.img} contentFit="cover" />
        ) : (
          <View style={styles.imgPlaceholder}>
            <Ionicons name="cube-outline" size={64} color="#1e293b" />
          </View>
        )}
        {/* Back btn */}
        <SafeAreaView style={styles.backArea} edges={["top"]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Category */}
          {product.categories && (
            <Text style={styles.category}>
              {i18n.language === "en" ? product.categories.name_en : product.categories.name_fr}
            </Text>
          )}

          {/* Name + Price */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
          </View>

          {/* Stock status */}
          <View style={styles.stockRow}>
            <View style={[styles.dot, product.is_active && styles.dotGreen]} />
            <Text style={[styles.stock, product.is_active && styles.stockGreen]}>
              {product.is_active ? t("products.inStock") : t("products.outOfStock")}
            </Text>
          </View>

          {/* Description */}
          {description && (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>{t("products.description")}</Text>
              <Text style={styles.desc}>{description}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Quantity */}
        <View style={styles.qtyControl}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQty(Math.max(1, qty - 1))}
          >
            <Ionicons name="remove" size={16} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.qtyVal}>{qty}</Text>
          <TouchableOpacity
            style={[styles.qtyBtn, styles.qtyAdd]}
            onPress={() => setQty(qty + 1)}
          >
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Add to cart */}
        <TouchableOpacity
          style={[styles.addBtn, !product.is_active && styles.addBtnDisabled, added && styles.addBtnSuccess]}
          onPress={handleAddToCart}
          disabled={!product.is_active}
        >
          <Ionicons name={added ? "checkmark" : "cart-outline"} size={18} color="#fff" />
          <Text style={styles.addBtnText}>
            {added ? "Ajouté !" : t("products.addToCart")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0f1e" },
  imgWrap: { width, height: 300, backgroundColor: "#0f172a" },
  img: { width: "100%", height: "100%" },
  imgPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  backArea: { position: "absolute", top: 0, left: 0, right: 0 },
  backBtn: {
    margin: 16,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.8)", alignItems: "center", justifyContent: "center",
  },
  content: { flex: 1, backgroundColor: "#0a0f1e", borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, padding: 20 },
  category: { fontSize: 12, color: "#f97316", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  name: { flex: 1, fontSize: 22, fontWeight: "800", color: "#fff", lineHeight: 28 },
  price: { fontSize: 22, fontWeight: "800", color: "#f97316" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ef4444" },
  dotGreen: { backgroundColor: "#22c55e" },
  stock: { fontSize: 13, color: "#ef4444", fontWeight: "500" },
  stockGreen: { color: "#22c55e" },
  descSection: { gap: 8 },
  descTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  desc: { fontSize: 14, color: "#64748b", lineHeight: 22 },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0f172a", borderTopWidth: 1, borderTopColor: "#1e293b",
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32,
  },
  qtyControl: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#1e293b", borderRadius: 12, padding: 6,
  },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" },
  qtyAdd: { backgroundColor: "#f97316" },
  qtyVal: { fontSize: 16, fontWeight: "700", color: "#fff", minWidth: 24, textAlign: "center" },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#f97316", borderRadius: 14, height: 52,
    shadowColor: "#f97316", shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  addBtnDisabled: { backgroundColor: "#1e293b" },
  addBtnSuccess: { backgroundColor: "#22c55e" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
