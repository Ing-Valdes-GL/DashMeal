import { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { useCartStore } from "@/stores/cart";
import { formatCurrency } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CartScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, updateQuantity, removeItem, clear, getTotal, branch_name } = useCartStore();

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("cart.title")}</Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cart-outline" size={48} color="#1e293b" />
          </View>
          <Text style={styles.emptyTitle}>{t("cart.empty")}</Text>
          <Text style={styles.emptySubtitle}>Ajoutez des produits pour commencer</Text>
          <TouchableOpacity
            style={styles.shopBtn}
            onPress={() => router.push("/(tabs)/catalog")}
          >
            <Text style={styles.shopBtnText}>Voir le catalogue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("cart.title")}</Text>
        <TouchableOpacity onPress={() => Alert.alert(t("cart.clear"), "Vider le panier ?", [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirm"), onPress: clear, style: "destructive" },
        ])}>
          <Ionicons name="trash-outline" size={20} color="#f87171" />
        </TouchableOpacity>
      </View>

      {branch_name && (
        <View style={styles.branchBanner}>
          <Ionicons name="storefront-outline" size={14} color="#f97316" />
          <Text style={styles.branchText}>{branch_name}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => i.product_id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemImg}>
              {item.product_image ? (
                <Image source={{ uri: item.product_image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <Ionicons name="cube-outline" size={20} color="#334155" />
              )}
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.unit_price)}</Text>
            </View>
            <View style={styles.qty}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQuantity(item.product_id, item.quantity - 1)}
              >
                <Ionicons name="remove" size={14} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, styles.qtyBtnAdd]}
                onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
              >
                <Ionicons name="add" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Bottom summary */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t("cart.subtotal")}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(getTotal())}</Text>
        </View>
        <View style={[styles.summaryRow, { marginBottom: 16 }]}>
          <Text style={[styles.summaryLabel, { color: "#fff", fontWeight: "700", fontSize: 16 }]}>
            {t("cart.total")}
          </Text>
          <Text style={[styles.summaryValue, { color: "#f97316", fontSize: 18, fontWeight: "800" }]}>
            {formatCurrency(getTotal())}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push("/checkout")}
        >
          <Text style={styles.checkoutText}>{t("cart.checkout")}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  branchBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 20, marginBottom: 4,
    backgroundColor: "rgba(249,115,22,0.1)", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "rgba(249,115,22,0.2)",
  },
  branchText: { fontSize: 12, color: "#f97316", fontWeight: "500" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 60 },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 32,
    backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  emptySubtitle: { fontSize: 14, color: "#475569" },
  shopBtn: {
    backgroundColor: "#f97316", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
  },
  shopBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0f172a", borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "#1e293b",
  },
  itemImg: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 13, fontWeight: "600", color: "#fff" },
  itemPrice: { fontSize: 13, fontWeight: "600", color: "#f97316" },
  qty: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center",
  },
  qtyBtnAdd: { backgroundColor: "#f97316" },
  qtyText: { fontSize: 14, fontWeight: "700", color: "#fff", minWidth: 20, textAlign: "center" },
  summary: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f172a", borderTopWidth: 1, borderTopColor: "#1e293b",
    padding: 20, paddingBottom: 32,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { fontSize: 14, color: "#475569" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#e2e8f0" },
  checkoutBtn: {
    backgroundColor: "#f97316", borderRadius: 14, height: 52,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#f97316", shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  checkoutText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
