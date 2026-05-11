import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius, Shadow } from "@/lib/theme";

export default function CartScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, isGuest } = useAuthStore();
  const { items, updateQuantity, removeItem, getTotal, getCount, branch_name } = useCartStore();

  const total = getTotal();
  const deliveryFee = items.length > 0 ? 500 : 0;
  const grandTotal = total + deliveryFee;

  if (items.length === 0) {
    return (
      <View style={s.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={s.safe} edges={["top"]}>
          <View style={s.header}><Text style={s.headerTitle}>My Cart</Text></View>
        </SafeAreaView>
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="cart-outline" size={64} color={Colors.text3} />
          </View>
          <Text style={s.emptyTitle}>Votre panier est vide</Text>
          <Text style={s.emptySub}>Ajoutez des produits pour commencer</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => router.push("/(tabs)/explore" as any)}>
            <Text style={s.shopBtnText}>Parcourir les produits</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleCheckout = () => {
    if (isGuest) {
      Alert.alert(
        "Connexion requise",
        "Vous devez être connecté pour passer une commande.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Se connecter", onPress: () => router.push("/(auth)/login") },
        ]
      );
      return;
    }
    router.push("/checkout" as any);
  };

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>My Cart</Text>
          {branch_name && <Text style={s.branchName}>{branch_name}</Text>}
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 }}>
        {/* Items */}
        {items.map((item) => (
          <View key={item.product_id} style={s.item}>
            <View style={s.itemImg}>
              {item.product_image
                ? <Image source={{ uri: item.product_image }} style={s.itemImgSrc} resizeMode="cover" />
                : <View style={[s.itemImgSrc, s.itemImgFallback]}><Ionicons name="fast-food-outline" size={28} color={Colors.primary} /></View>
              }
            </View>
            <View style={s.itemBody}>
              <View style={s.itemTopRow}>
                <Text style={s.itemName} numberOfLines={2}>{item.product_name}</Text>
                <TouchableOpacity onPress={() => removeItem(item.product_id)}>
                  <Ionicons name="close" size={18} color={Colors.text3} />
                </TouchableOpacity>
              </View>
              <Text style={s.itemPrice}>{formatCurrency(item.unit_price)}</Text>
              <View style={s.qtyRow}>
                <TouchableOpacity
                  style={[s.qtyBtn, item.quantity <= 1 && s.qtyBtnDim]}
                  onPress={() => updateQuantity(item.product_id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={16} color={item.quantity <= 1 ? Colors.text3 : Colors.primary} />
                </TouchableOpacity>
                <Text style={s.qtyText}>{item.quantity}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQuantity(item.product_id, item.quantity + 1)}>
                  <Ionicons name="add" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {/* Promo */}
        <View style={s.promoWrap}>
          <View style={s.promoInput}>
            <TextInput placeholder="Promo Code" placeholderTextColor={Colors.text3} style={s.promoTextInput} />
          </View>
          <TouchableOpacity style={s.promoBtn}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Checkout bar */}
      <SafeAreaView style={s.bottomBar} edges={["bottom"]}>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Cost</Text>
          <Text style={s.totalValue}>{formatCurrency(grandTotal)}</Text>
        </View>
        <TouchableOpacity style={s.checkoutBtn} onPress={handleCheckout} activeOpacity={0.85}>
          <Text style={s.checkoutBtnText}>Go to Checkout</Text>
          <View style={s.checkoutBadge}><Text style={s.checkoutBadgeText}>{getCount()}</Text></View>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// Need TextInput for promo
import { TextInput } from "react-native";

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  safe: { backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  branchName: { fontSize: 12, color: Colors.text2, marginTop: 2 },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.text2, textAlign: "center" },
  shopBtn: { marginTop: 12, height: 52, paddingHorizontal: 32, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  shopBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  item: { flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  itemImg: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: Colors.pageBg, overflow: "hidden" },
  itemImgSrc: { width: 72, height: 72 },
  itemImgFallback: { alignItems: "center", justifyContent: "center" },
  itemBody: { flex: 1 },
  itemTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  itemName: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.text, marginRight: 8 },
  itemPrice: { fontSize: 13, color: Colors.text2, marginBottom: 10 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  qtyBtnDim: { borderColor: Colors.border },
  qtyText: { fontSize: 15, fontWeight: "700", color: Colors.text, minWidth: 20, textAlign: "center" },

  promoWrap: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 20 },
  promoInput: { flex: 1, height: 52, borderRadius: Radius.lg, backgroundColor: Colors.pageBg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, justifyContent: "center" },
  promoTextInput: { fontSize: 14, color: Colors.text },
  promoBtn: { width: 52, height: 52, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, ...Shadow.md },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  totalLabel: { fontSize: 15, fontWeight: "600", color: Colors.text2 },
  totalValue: { fontSize: 16, fontWeight: "800", color: Colors.text },
  checkoutBtn: { height: 67, borderRadius: Radius.full, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6 },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  checkoutBadge: { backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  checkoutBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
