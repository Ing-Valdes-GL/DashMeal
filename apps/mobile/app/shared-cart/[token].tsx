import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Colors, Radius, Shadow, Spacing } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";

interface SharedCart {
  id: string;
  token: string;
  owner_name: string;
  branch_name: string;
  items: Array<{ product_name: string; unit_price: number; quantity: number }>;
  order_type: string;
  promo_code: string | null;
  promo_pct: number | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  status: string;
  expires_at: string;
}

export default function SharedCartScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { isAuthenticated } = useAuthStore();

  const [cart, setCart] = useState<SharedCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const fetchCart = useCallback(async () => {
    try {
      const res = await apiGet(`/user-wallet/shared-cart/${token}`);
      setCart(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Panier introuvable ou expiré.";
      Alert.alert(t("common.error"), msg, [{ text: "OK", onPress: () => router.replace("/(tabs)" as any) }]);
    } finally {
      setLoading(false);
    }
  }, [token, t, router]);

  const fetchWallet = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiGet("/user-wallet");
      setWalletBalance(res.data?.balance ?? null);
    } catch {
      setWalletBalance(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
    fetchWallet();
  }, [fetchCart, fetchWallet]);

  const handlePay = async () => {
    if (!isAuthenticated) {
      Alert.alert(t("cart.loginRequired"), t("cart.loginRequiredMsg"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("profile.loginBtn"), onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }

    if (walletBalance === null) {
      Alert.alert(t("wallet.noWallet"), t("wallet.noWalletMsg"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("wallet.activateNow"), onPress: () => router.push("/wallet" as any) },
      ]);
      return;
    }

    if (walletBalance < (cart?.total_amount ?? 0)) {
      Alert.alert(
        t("wallet.insufficientBalance"),
        t("wallet.insufficientMsg", {
          balance: formatCurrency(walletBalance),
          missing: formatCurrency((cart?.total_amount ?? 0) - walletBalance),
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("wallet.topup"), onPress: () => router.push("/wallet/topup" as any) },
        ],
      );
      return;
    }

    Alert.alert(
      t("wallet.paySharedCart"),
      `Payer ${formatCurrency(cart?.total_amount ?? 0)} depuis votre wallet ?`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          onPress: async () => {
            setPaying(true);
            try {
              const res = await apiPost(`/user-wallet/shared-cart/${token}/pay`, {});
              Alert.alert(t("common.success"), "Paiement effectué ! La commande a été passée.", [
                { text: "OK", onPress: () => router.replace("/(tabs)" as any) },
              ]);
            } catch (err: any) {
              const msg = err?.response?.data?.error?.message ?? t("common.error");
              Alert.alert(t("common.error"), msg);
            } finally {
              setPaying(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!cart) return null;

  const isExpired = new Date(cart.expires_at) < new Date();
  const isPaid = cart.status === "paid";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("wallet.sharedCart")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Owner banner */}
        <View style={styles.ownerBanner}>
          <View style={styles.ownerIconWrap}>
            <Ionicons name="person-outline" size={22} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.ownerLabel}>{t("wallet.sharedBy")}</Text>
            <Text style={styles.ownerName}>{cart.owner_name}</Text>
          </View>
        </View>

        {/* Branch */}
        <View style={styles.infoRow}>
          <Ionicons name="storefront-outline" size={18} color={Colors.text3} />
          <Text style={styles.infoText}>{cart.branch_name}</Text>
        </View>

        {/* Status badge */}
        {(isPaid || isExpired) && (
          <View style={[styles.statusBadge, isPaid ? styles.statusPaid : styles.statusExpired]}>
            <Ionicons name={isPaid ? "checkmark-circle" : "time-outline"} size={16} color={isPaid ? Colors.success : Colors.error} />
            <Text style={[styles.statusText, { color: isPaid ? Colors.success : Colors.error }]}>
              {isPaid ? "Déjà payé" : "Expiré"}
            </Text>
          </View>
        )}

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Articles</Text>
          {cart.items.map((item, i) => (
            <View key={i} style={[styles.itemRow, i > 0 && styles.itemBorder]}>
              <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
              <View style={styles.itemRight}>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>{formatCurrency(item.unit_price * item.quantity)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Récapitulatif</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{formatCurrency(cart.subtotal)}</Text>
          </View>
          {cart.discount_amount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: Colors.success }]}>
                Remise {cart.promo_code ? `(${cart.promo_code})` : ""}
              </Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>-{formatCurrency(cart.discount_amount)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(cart.total_amount)}</Text>
          </View>
        </View>

        {/* Wallet balance hint */}
        {walletBalance !== null && !isPaid && !isExpired && (
          <View style={styles.balanceHint}>
            <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
            <Text style={styles.balanceHintText}>
              Votre solde wallet : <Text style={{ fontWeight: "700", color: Colors.primary }}>{formatCurrency(walletBalance)}</Text>
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Pay button */}
      {!isPaid && !isExpired && (
        <View style={styles.footer}>
          <View style={styles.footerTotal}>
            <Text style={styles.footerLabel}>Total</Text>
            <Text style={styles.footerAmount}>{formatCurrency(cart.total_amount)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.payBtn, paying && styles.payBtnDisabled]}
            onPress={handlePay}
            disabled={paying}
          >
            {paying
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="wallet-outline" size={18} color="#fff" />
                  <Text style={styles.payBtnText}>{t("wallet.paySharedCart")}</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: Spacing.md, gap: 12, paddingBottom: 100 },

  ownerBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: 14 },
  ownerIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  ownerLabel: { fontSize: 11, color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.5 },
  ownerName: { fontSize: 15, fontWeight: "700", color: Colors.primary },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 14, color: Colors.text2 },

  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: Radius.md },
  statusPaid: { backgroundColor: "#E8F5E9" },
  statusExpired: { backgroundColor: "#FFEBEE" },
  statusText: { fontSize: 14, fontWeight: "600" },

  card: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 14, gap: 10, ...Shadow.sm },
  cardTitle: { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 2 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemBorder: { paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.divider },
  itemName: { flex: 1, fontSize: 14, color: Colors.text },
  itemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemQty: { fontSize: 13, color: Colors.text3 },
  itemPrice: { fontSize: 14, fontWeight: "600", color: Colors.text },

  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, color: Colors.text2 },
  summaryValue: { fontSize: 14, color: Colors.text },
  totalRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.divider, marginTop: 2 },
  totalLabel: { fontSize: 15, fontWeight: "700", color: Colors.text },
  totalValue: { fontSize: 16, fontWeight: "800", color: Colors.primary },

  balanceHint: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: 12 },
  balanceHintText: { fontSize: 13, color: Colors.text2, flex: 1 },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.divider, padding: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  footerTotal: { flex: 1 },
  footerLabel: { fontSize: 12, color: Colors.text3 },
  footerAmount: { fontSize: 18, fontWeight: "800", color: Colors.text },
  payBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  payBtnDisabled: { backgroundColor: Colors.border },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
