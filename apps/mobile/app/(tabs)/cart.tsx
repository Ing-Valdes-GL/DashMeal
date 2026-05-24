import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, TextInput, ActivityIndicator, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useCartStore, type CartSlot } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius, Shadow } from "@/lib/theme";

interface TimeSlot {
  id: string; date: string; start_time: string; end_time: string;
  capacity: number; booked: number;
}
interface ApiResponse<T> { success: boolean; data: T }

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CartScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, isGuest } = useAuthStore();
  const {
    items, updateQuantity, removeItem, getTotal, getCount, branch_name, branch_id,
    order_type, selected_slot,
    setOrderType, setSlot,
    promo_code, promo_pct, promo_label,
    setPromo, clearPromo,
    getDiscount, getDiscountedTotal,
  } = useCartStore();

  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet("/user-wallet").then((r) => setWalletBalance(r.data?.balance ?? null)).catch(() => {});
  }, [isAuthenticated]);

  // ── Créneaux disponibles (uniquement pour Click & Collect) ──────────────────
  const { data: slotsRes, isLoading: slotsLoading } = useQuery<ApiResponse<TimeSlot[]>>({
    queryKey: ["branch-slots", branch_id, getTodayIso()],
    queryFn: () => apiGet(`/branches/${branch_id}/time-slots`, { date: getTodayIso() }),
    enabled: !!branch_id && order_type === "collect",
    staleTime: 60_000,
  });
  const slots: TimeSlot[] = (slotsRes?.data ?? []).filter(
    (s) => s.booked < s.capacity
  );

  // ── Validation code promo ────────────────────────────────────────────────────
  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code || !branch_id) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const resp = await apiGet("/promo-codes/validate", {
        code,
        branch_id,
        order_total: String(getTotal()),
      });
      const d = resp?.data;
      setPromo(d.id, d.code, d.discount_pct, d.label);
      setPromoInput("");
    } catch (e: any) {
      const code = e?.response?.data?.error?.code;
      const msg: Record<string, string> = {
        PROMO_NOT_FOUND:    t("cart.promoInvalid"),
        PROMO_INACTIVE:     t("cart.promoInvalid"),
        PROMO_EXPIRED:      e?.response?.data?.error?.message ?? t("cart.promoInvalid"),
        PROMO_MIN_ORDER:    e?.response?.data?.error?.message ?? t("cart.promoInvalid"),
        PROMO_MAX_USES:     e?.response?.data?.error?.message ?? t("cart.promoInvalid"),
      };
      setPromoError(msg[code] ?? t("cart.promoInvalid"));
    } finally {
      setPromoLoading(false);
    }
  };

  const handleCheckout = () => {
    if (isGuest) {
      Alert.alert(t("cart.loginRequired"), t("cart.loginRequiredMsg"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("auth.loginButton"), onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }
    if (order_type === "collect" && !selected_slot) {
      Alert.alert(t("cart.slotSection"), t("cart.selectSlot"));
      return;
    }
    router.push("/checkout" as any);
  };

  const subtotal  = getTotal();
  const discount  = getDiscount();
  const total     = getDiscountedTotal();

  if (items.length === 0) {
    return (
      <View style={s.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={s.safe} edges={["top"]}>
          <View style={s.header}><Text style={s.headerTitle}>{t("cart.title")}</Text></View>
        </SafeAreaView>
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}><Ionicons name="cart-outline" size={64} color={Colors.text3} /></View>
          <Text style={s.emptyTitle}>{t("cart.empty")}</Text>
          <Text style={s.emptySub}>{t("cart.emptyAdd")}</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => router.push("/(tabs)/explore" as any)}>
            <Text style={s.shopBtnText}>{t("cart.browse")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t("cart.title")}</Text>
          {branch_name && <Text style={s.branchName}>{branch_name}</Text>}
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 220 }}>

        {/* ── Articles ───────────────────────────────────────────────────── */}
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

        {/* ── Mode de commande ──────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t("cart.orderType")}</Text>
          <View style={s.toggle}>
            {(["collect", "delivery"] as const).map((mode) => {
              const active = order_type === mode;
              const icon = mode === "collect" ? "storefront-outline" : "bicycle-outline";
              const label = mode === "collect" ? t("cart.collect") : t("cart.delivery");
              const sub   = mode === "collect" ? t("cart.collectSub") : t("cart.deliverySub");
              return (
                <TouchableOpacity
                  key={mode}
                  style={[s.toggleOption, active && s.toggleOptionActive]}
                  onPress={() => setOrderType(mode)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={icon as any} size={22} color={active ? Colors.primary : Colors.text3} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.toggleLabel, active && s.toggleLabelActive]}>{label}</Text>
                    <Text style={s.toggleSub}>{sub}</Text>
                  </View>
                  <View style={[s.radio, active && s.radioActive]}>
                    {active && <View style={s.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Créneaux Click & Collect ──────────────────────────────────── */}
        {order_type === "collect" && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t("cart.slotSection")}</Text>
            {slotsLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 12 }} />
            ) : slots.length === 0 ? (
              <View style={s.noSlotWrap}>
                <Ionicons name="time-outline" size={22} color={Colors.text3} />
                <Text style={s.noSlotText}>{t("cart.noSlots")}</Text>
              </View>
            ) : (
              <FlatList
                horizontal
                data={slots}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingHorizontal: 2 }}
                scrollEnabled={slots.length > 3}
                renderItem={({ item }) => {
                  const active = selected_slot?.id === item.id;
                  const startH = item.start_time.slice(0, 5);
                  const endH   = item.end_time.slice(0, 5);
                  const label  = `${startH} – ${endH}`;
                  const spots  = item.capacity - item.booked;
                  return (
                    <TouchableOpacity
                      style={[s.slotChip, active && s.slotChipActive]}
                      onPress={() => setSlot(active ? null : {
                        id: item.id, date: item.date,
                        start_time: item.start_time, end_time: item.end_time,
                        label,
                      })}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={active ? "#fff" : Colors.primary}
                      />
                      <Text style={[s.slotTime, active && s.slotTimeActive]}>{label}</Text>
                      <Text style={[s.slotSpots, active && { color: "rgba(255,255,255,0.75)" }]}>
                        {spots} pl.
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {selected_slot && (
              <View style={s.slotSelected}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                <Text style={s.slotSelectedText}>{selected_slot.label}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Code promo ───────────────────────────────────────────────── */}
        <View style={s.section}>
          {promo_code ? (
            <View style={s.promoApplied}>
              <View style={s.promoAppliedLeft}>
                <Ionicons name="pricetag-outline" size={18} color={Colors.primary} />
                <View>
                  <Text style={s.promoAppliedCode}>{promo_code}  •  -{promo_pct}%</Text>
                  {promo_label && <Text style={s.promoAppliedLabel}>{promo_label}</Text>}
                </View>
              </View>
              <TouchableOpacity
                onPress={clearPromo}
                style={s.promoRemoveBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.text3} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={s.promoRow}>
                <View style={s.promoInput}>
                  <Ionicons name="pricetag-outline" size={16} color={Colors.text3} style={{ marginRight: 8 }} />
                  <TextInput
                    style={s.promoTextInput}
                    placeholder={t("cart.promoPlaceholder")}
                    placeholderTextColor={Colors.text3}
                    value={promoInput}
                    onChangeText={(v) => { setPromoInput(v); setPromoError(""); }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>
                <TouchableOpacity
                  style={[s.promoBtn, (!promoInput.trim() || promoLoading) && s.promoBtnDim]}
                  onPress={handleApplyPromo}
                  disabled={!promoInput.trim() || promoLoading}
                >
                  {promoLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.promoBtnText}>{t("cart.promoApply")}</Text>
                  }
                </TouchableOpacity>
              </View>
              {promoError ? (
                <Text style={s.promoErrorText}>{promoError}</Text>
              ) : null}
            </>
          )}
        </View>

        {/* ── Récapitulatif ────────────────────────────────────────────── */}
        <View style={s.summaryBox}>
          <Text style={s.summaryTitle}>{t("cart.summary")}</Text>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>{t("cart.subtotal")}</Text>
            <Text style={s.summaryValue}>{formatCurrency(subtotal)}</Text>
          </View>
          {discount > 0 && (
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: Colors.success }]}>
                {t("cart.discount", { pct: promo_pct })}
              </Text>
              <Text style={[s.summaryValue, { color: Colors.success }]}>
                -{formatCurrency(discount)}
              </Text>
            </View>
          )}
          <View style={[s.summaryRow, s.summaryTotalRow]}>
            <Text style={s.summaryTotalLabel}>{t("cart.totalCost")}</Text>
            <Text style={s.summaryTotalValue}>{formatCurrency(total)}</Text>
          </View>

          {/* Wallet discount teaser */}
          {walletBalance !== null && total > 0 && (
            <TouchableOpacity style={s.walletTeaser} onPress={() => router.push("/wallet" as any)} activeOpacity={0.85}>
              <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.walletTeaserText}>
                  {t("wallet.payWithWallet")} — <Text style={{ fontWeight: "800" }}>{t("wallet.walletDiscount")}</Text>
                </Text>
                <Text style={s.walletTeaserSub}>
                  Total avec wallet : <Text style={{ fontWeight: "700", color: Colors.primary }}>{formatCurrency(Math.floor(total * 0.99))}</Text>
                  {"  "}
                  <Text style={s.walletTeaserOld}>{formatCurrency(total)}</Text>
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── Bouton commander ────────────────────────────────────────────── */}
      <SafeAreaView style={s.bottomBar} edges={["bottom"]}>
        <TouchableOpacity style={s.checkoutBtn} onPress={handleCheckout} activeOpacity={0.85}>
          <Text style={s.checkoutBtnText}>{t("cart.goToCheckout")}</Text>
          <View style={s.checkoutBadge}>
            <Text style={s.checkoutBadgeText}>{getCount()}</Text>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  safe:      { backgroundColor: Colors.bg },
  header:    { paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  branchName:  { fontSize: 12, color: Colors.text2, marginTop: 2 },

  emptyWrap:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyIcon:  { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  emptySub:   { fontSize: 14, color: Colors.text2, textAlign: "center" },
  shopBtn:    { marginTop: 12, height: 52, paddingHorizontal: 32, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  shopBtnText:{ color: "#fff", fontWeight: "700", fontSize: 15 },

  // Items
  item:      { flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  itemImg:   { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: Colors.pageBg, overflow: "hidden" },
  itemImgSrc:{ width: 72, height: 72 },
  itemImgFallback: { alignItems: "center", justifyContent: "center" },
  itemBody:  { flex: 1 },
  itemTopRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  itemName:  { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.text, marginRight: 8 },
  itemPrice: { fontSize: 13, color: Colors.text2, marginBottom: 10 },
  qtyRow:    { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn:    { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  qtyBtnDim: { borderColor: Colors.border },
  qtyText:   { fontSize: 15, fontWeight: "700", color: Colors.text, minWidth: 20, textAlign: "center" },

  // Sections
  section:      { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.4 },

  // Order type toggle
  toggle:            { gap: 10 },
  toggleOption:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  toggleOptionActive:{ borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  toggleLabel:       { fontSize: 14, fontWeight: "700", color: Colors.text2 },
  toggleLabelActive: { color: Colors.primary },
  toggleSub:         { fontSize: 12, color: Colors.text3, marginTop: 2 },
  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  // Slots
  noSlotWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  noSlotText: { fontSize: 13, color: Colors.text3 },
  slotChip:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  slotChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotTime:   { fontSize: 13, fontWeight: "700", color: Colors.primary },
  slotTimeActive: { color: "#fff" },
  slotSpots:  { fontSize: 11, color: Colors.text3 },
  slotSelected: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  slotSelectedText: { fontSize: 13, color: Colors.primary, fontWeight: "600" },

  // Promo
  promoRow:       { flexDirection: "row", gap: 10 },
  promoInput:     { flex: 1, flexDirection: "row", alignItems: "center", height: 52, borderRadius: Radius.lg, backgroundColor: Colors.pageBg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14 },
  promoTextInput: { flex: 1, fontSize: 14, color: Colors.text, letterSpacing: 1 },
  promoBtn:       { height: 52, paddingHorizontal: 18, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  promoBtnDim:    { opacity: 0.5 },
  promoBtnText:   { color: "#fff", fontWeight: "700", fontSize: 14 },
  promoErrorText: { fontSize: 12, color: Colors.error, marginTop: 8 },
  promoApplied:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: Radius.lg, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary },
  promoAppliedLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  promoAppliedCode: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  promoAppliedLabel:{ fontSize: 12, color: Colors.text2 },
  promoRemoveBtn:   { padding: 4 },

  // Summary
  summaryBox:       { marginHorizontal: 16, marginTop: 16, backgroundColor: Colors.pageBg, borderRadius: Radius.lg, padding: 16, gap: 10 },
  summaryTitle:     { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 4 },
  summaryRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel:     { fontSize: 14, color: Colors.text2 },
  summaryValue:     { fontSize: 14, fontWeight: "600", color: Colors.text },
  summaryTotalRow:  { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  summaryTotalLabel:{ fontSize: 15, fontWeight: "700", color: Colors.text },
  summaryTotalValue:{ fontSize: 17, fontWeight: "800", color: Colors.primary },

  // Wallet teaser
  walletTeaser:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: 10, marginTop: 4 },
  walletTeaserText:{ fontSize: 12, color: Colors.text, flex: 1 },
  walletTeaserSub: { fontSize: 12, color: Colors.text2, marginTop: 2 },
  walletTeaserOld: { textDecorationLine: "line-through", color: Colors.text3 },

  // Bottom bar
  bottomBar:       { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, ...Shadow.md },
  checkoutBtn:     { height: 67, borderRadius: Radius.full, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6 },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  checkoutBadge:   { backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  checkoutBadgeText:{ color: "#fff", fontSize: 12, fontWeight: "800" },
});
