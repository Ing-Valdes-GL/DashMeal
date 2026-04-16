import { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { useCartStore } from "@/stores/cart";
import { formatCurrency } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";

export default function CartScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, updateQuantity, removeItem, clear, getTotal, branch_name } = useCartStore();

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.emptyHeader} edges={["top"]}>
          <Text style={styles.headerTitle}>{t("cart.title")}</Text>
        </SafeAreaView>
        <View style={styles.emptyBody}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cart-outline" size={52} color={Colors.border} />
          </View>
          <Text style={styles.emptyTitle}>{t("cart.empty")}</Text>
          <Text style={styles.emptySubtitle}>Ajoutez des produits pour commencer</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.push("/(tabs)/catalog")}>
            <Text style={styles.shopBtnText}>Voir le catalogue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const deliveryFee = 500;
  const subtotal = getTotal();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Header sombre (style Figma) ────────────────────────────────────── */}
      <SafeAreaView style={styles.darkHeader} edges={["top"]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t("cart.title")}</Text>
          <TouchableOpacity onPress={() => Alert.alert(t("cart.clear"), "Vider le panier ?", [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.confirm"), onPress: clear, style: "destructive" },
          ])}>
            <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
        {branch_name && (
          <View style={styles.branchRow}>
            <Ionicons name="storefront-outline" size={13} color={Colors.primary} />
            <Text style={styles.branchText}>{branch_name}</Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── Liste d'articles ───────────────────────────────────────────────── */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.product_id}
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemImg}>
              {item.product_image ? (
                <Image source={{ uri: item.product_image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <Ionicons name="cube-outline" size={20} color="rgba(255,255,255,0.3)" />
              )}
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.unit_price)}</Text>
            </View>
            <View style={styles.qtyRow}>
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

      {/* ── Récapitulatif blanc (style Figma) ─────────────────────────────── */}
      <View style={styles.summary}>
        {branch_name && (
          <View style={styles.addressRow}>
            <View>
              <Text style={styles.addressLabel}>AGENCE</Text>
              <Text style={styles.addressValue}>{branch_name}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/catalog")}>
              <Text style={styles.editLink}>Changer</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.totalBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t("cart.subtotal")}</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalMain]}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{formatCurrency(subtotal)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push("/checkout")}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutText}>{t("cart.checkout")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C1C2E" },
  // Header dark
  darkHeader: { backgroundColor: "#1C1C2E", paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
  emptyHeader: { backgroundColor: Colors.bg, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  branchRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  branchText: { fontSize: 12, color: Colors.primary, fontWeight: "500" },
  // Items
  list: { flex: 1, backgroundColor: "#1C1C2E" },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: Radius.md, padding: 12,
  },
  itemImg: {
    width: 60, height: 60, borderRadius: Radius.sm,
    backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 13, fontWeight: "600", color: "#fff" },
  itemPrice: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: Radius.sm,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  qtyBtnAdd: { backgroundColor: Colors.primary },
  qtyText: { fontSize: 14, fontWeight: "700", color: "#fff", minWidth: 20, textAlign: "center" },
  // Summary
  summary: {
    backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32,
    ...Shadow.md,
  },
  addressRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider, marginBottom: 14,
  },
  addressLabel: { fontSize: 10, fontWeight: "700", color: Colors.text3, letterSpacing: 0.8 },
  addressValue: { fontSize: 14, fontWeight: "500", color: Colors.text, marginTop: 2 },
  editLink:  { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  totalBlock: { gap: 6, marginBottom: 16 },
  totalRow:   { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 14, color: Colors.text2 },
  totalValue: { fontSize: 14, fontWeight: "600", color: Colors.text },
  totalMain:  { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10, marginTop: 4 },
  grandLabel: { fontSize: 16, fontWeight: "800", color: Colors.text },
  grandValue: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  checkoutBtn: {
    height: 52, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    ...Shadow.primary,
  },
  checkoutText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 },
  // Empty state
  emptyBody:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 60, backgroundColor: Colors.bg },
  emptyIconWrap:{ width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center" },
  emptyTitle:   { fontSize: 18, fontWeight: "700", color: Colors.text },
  emptySubtitle:{ fontSize: 14, color: Colors.text2 },
  shopBtn:      { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 12, paddingHorizontal: 28, ...Shadow.primary },
  shopBtnText:  { color: "#fff", fontWeight: "700", fontSize: 14 },
});
