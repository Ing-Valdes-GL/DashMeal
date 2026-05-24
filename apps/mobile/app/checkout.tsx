import { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Animated, Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency, formatTime } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimeSlot {
  id: string; date: string; start_time: string; end_time: string;
  capacity: number; booked: number;
}
interface ApiResponse<T> { success: boolean; data: T }
type PaymentMethod = "orange_money" | "mtn_mobile_money";
type PaymentType = "momo" | "wallet";
type PaymentStatus = "pending" | "paid" | "failed";

// ─── Constantes opérateurs ────────────────────────────────────────────────────
const OPERATORS: { id: PaymentMethod; label: string; color: string; prefix: string }[] = [
  { id: "orange_money",     label: "Orange Money",     color: "#FF6600", prefix: "237 69" },
  { id: "mtn_mobile_money", label: "MTN Mobile Money", color: "#FFCC00", prefix: "237 67/68" },
];

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function detectOperator(phone: string): PaymentMethod | null {
  const digits = phone.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("00237")) local = local.slice(5);
  else if (local.startsWith("237")) local = local.slice(3);
  if (/^69/.test(local) || /^65[5-9]/.test(local) || /^68/.test(local)) return "orange_money";
  if (/^67/.test(local) || /^65[0-4]/.test(local)) return "mtn_mobile_money";
  return null;
}

function getNext7Days(todayLabel: string, tomorrowLabel: string) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: i === 0 ? todayLabel : i === 1 ? tomorrowLabel : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      short: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    });
  }
  return days;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    items, getTotal, getDiscount, getDiscountedTotal,
    branch_id, branch_name,
    promo_code, promo_pct, promo_label,
    clear,
  } = useCartStore();

  const DAYS = getNext7Days(t("checkout.today"), t("checkout.tomorrow"));

  useEffect(() => {
    if (!branch_id || items.length === 0) router.replace("/(tabs)/cart");
  }, [branch_id, items.length, router]);

  const [orderType, setOrderType] = useState<"collect" | "delivery">("collect");
  const [selectedDate, setSelectedDate] = useState<string>(DAYS[0].iso);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("momo");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("orange_money");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    apiGet("/user-wallet").then((r) => setWalletBalance(r.data?.balance ?? null)).catch(() => {});
  }, []);

  // ── Pré-remplissage depuis le paiement par défaut ────────────────────────
  const { data: profileResp } = useQuery<ApiResponse<{ default_payment_phone?: string; default_payment_method?: string }>>({
    queryKey: ["profile"],
    queryFn: () => apiGet("/users/me"),
    staleTime: 1000 * 60 * 5,
  });
  useEffect(() => {
    const p = profileResp?.data;
    if (p?.default_payment_phone && !paymentPhone) {
      setPaymentPhone(p.default_payment_phone);
      if (p.default_payment_method === "orange_money" || p.default_payment_method === "mtn_mobile_money") {
        setPaymentMethod(p.default_payment_method);
      }
    }
  }, [profileResp]);

  const [paymentPhase, setPaymentPhase] = useState<"form" | "processing" | "waiting" | "success" | "failed">("form");
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Animation spinner ────────────────────────────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (paymentPhase === "waiting") {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [paymentPhase, spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // ── Créneaux ─────────────────────────────────────────────────────────────────
  const { data: slotsResp, isLoading: slotsLoading } = useQuery<ApiResponse<TimeSlot[]>>({
    queryKey: ["slots", branch_id, selectedDate],
    queryFn: () => apiGet(`/collect/slots/${branch_id}`, { date: selectedDate }),
    enabled: !!branch_id && orderType === "collect",
  });
  const slots = slotsResp?.data ?? [];

  const handlePaymentPhoneChange = (text: string) => {
    setPaymentPhone(text);
    const detected = detectOperator(text);
    if (detected) setPaymentMethod(detected);
  };

  // ── Polling ──────────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const startPolling = useCallback((reference: string) => {
    let attempts = 0;
    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const resp = await apiGet<ApiResponse<{ status: PaymentStatus; order_id?: string }>>(`/payments/status/${reference}`);
        const { status, order_id } = resp?.data ?? {};
        if (status === "paid" && order_id) {
          stopPolling(); setOrderId(order_id); setPaymentPhase("success");
          clear();
          queryClient.invalidateQueries({ queryKey: ["my-orders"] });
          queryClient.invalidateQueries({ queryKey: ["order", order_id] });
        } else if (status === "failed") {
          stopPolling(); setPaymentPhase("failed");
        }
      } catch { /* continuer */ }
      if (attempts >= 40) { stopPolling(); setPaymentPhase("failed"); }
    }, 5000);
  }, [stopPolling, clear, queryClient]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Soumission ───────────────────────────────────────────────────────────────
  const orderMutation = useMutation({
    mutationFn: () => {
      if (paymentType === "wallet") {
        return apiPost<ApiResponse<{ order_id: string; total: number }>>(
          "/payments/initiate-order",
          {
            branch_id, type: orderType,
            items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
            ...(orderType === "collect" ? { slot_id: selectedSlot } : {
              delivery_address: address, delivery_phone: deliveryPhone || undefined,
            }),
            payment_method: "wallet",
            notes: notes || undefined,
          }
        );
      }
      return apiPost<ApiResponse<{ reference: string; ussd_code: string | null; operator: string | null; total: number }>>(
        "/payments/initiate-order",
        {
          branch_id, type: orderType,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          ...(orderType === "collect" ? { slot_id: selectedSlot } : {
            delivery_address: address, delivery_phone: deliveryPhone || undefined,
          }),
          payment_method: paymentMethod,
          payment_phone: paymentPhone.replace(/\s/g, ""),
          notes: notes || undefined,
        }
      );
    },
    onSuccess: (resp: any) => {
      const d = resp?.data;
      if (!d) return;
      if (paymentType === "wallet") {
        // Wallet: paiement instantané → succès direct
        setOrderId(d.order_id);
        setOrderTotal(finalTotal);
        setPaymentPhase("success");
        clear();
        queryClient.invalidateQueries({ queryKey: ["my-orders"] });
        queryClient.invalidateQueries({ queryKey: ["order", d.order_id] });
      } else {
        setUssdCode(d.ussd_code ?? null);
        setPaymentRef(d.reference);
        setOrderTotal(d.total);
        setPaymentPhase("waiting");
        startPolling(d.reference);
      }
    },
    onError: (err: unknown) => {
      setPaymentPhase("form");
      const code = (err as any)?.response?.data?.error?.code;
      const msg = (err as any)?.response?.data?.error?.message;
      if (code === "INSUFFICIENT_BALANCE") {
        Alert.alert(t("wallet.insufficientBalance"), msg ?? t("checkout.payErrorMsg"));
      } else {
        Alert.alert(t("checkout.payError"), msg ?? t("checkout.payErrorMsg"));
      }
    },
  });

  const baseTotal = getDiscountedTotal();
  const walletTotal = Math.floor(baseTotal * 0.99);
  const walletSaving = baseTotal - walletTotal;
  const finalTotal = paymentType === "wallet" ? walletTotal : baseTotal;

  const canSubmitMomo =
    items.length > 0 &&
    paymentPhone.replace(/\D/g, "").length >= 9 &&
    (orderType === "collect" ? !!selectedSlot : address.trim().length >= 5);

  const canSubmitWallet =
    items.length > 0 &&
    walletBalance !== null &&
    walletBalance >= walletTotal &&
    (orderType === "collect" ? !!selectedSlot : address.trim().length >= 5);

  const canSubmit = paymentType === "wallet" ? canSubmitWallet : canSubmitMomo;

  const handleConfirm = () => {
    if (paymentType === "wallet") {
      Alert.alert(
        t("checkout.confirmTitle"),
        `${formatCurrency(finalTotal)} depuis votre wallet Dash Meal`,
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirm"), onPress: () => { setPaymentPhase("processing"); orderMutation.mutate(); } },
        ]
      );
    } else {
      Alert.alert(
        t("checkout.confirmTitle"),
        `${formatCurrency(finalTotal)} via ${paymentPhone} (${OPERATORS.find((o) => o.id === paymentMethod)?.label})`,
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirm"), onPress: () => { setPaymentPhase("processing"); orderMutation.mutate(); } },
        ]
      );
    }
  };

  // ── Écrans paiement ──────────────────────────────────────────────────────────
  if (paymentPhase === "processing") {
    const op = OPERATORS.find((o) => o.id === paymentMethod);
    return (
      <View style={styles.payScreen}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.payCenter} edges={["top", "bottom"]}>
          <View style={styles.payIconWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
          <Text style={styles.payTitle}>{t("checkout.initPay")}</Text>
          <Text style={styles.paySub}>{t("checkout.connecting")} {op?.label ?? "Mobile Money"}{"\n"}{t("checkout.noCloseApp")}</Text>
          <View style={[styles.opBadge, { borderColor: op?.color ?? Colors.primary }]}>
            <Text style={[styles.opBadgeText, { color: op?.color ?? Colors.primary }]}>{op?.label}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (paymentPhase === "waiting") {
    const op = OPERATORS.find((o) => o.id === paymentMethod);
    return (
      <View style={styles.payScreen}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.payCenter} edges={["top", "bottom"]}>
          <Animated.View style={[styles.spinnerWrap, { transform: [{ rotate: spin }] }]}>
            <Ionicons name="radio-button-on-outline" size={52} color={Colors.primary} />
          </Animated.View>
          <Text style={styles.payAmount}>{formatCurrency(orderTotal)}</Text>
          <Text style={styles.payTitle}>{t("checkout.confirmPayTitle")}</Text>
          <View style={[styles.opBadge, { borderColor: op?.color ?? Colors.primary }]}>
            <Text style={[styles.opBadgeText, { color: op?.color ?? Colors.primary }]}>{op?.label}</Text>
          </View>
          <View style={styles.stepsBox}>
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepText}>{t("checkout.step1")}{"\n"}<Text style={styles.stepPhone}>{paymentPhone}</Text></Text>
            </View>
            <View style={styles.stepSep} />
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepText}>{t("checkout.step2")}</Text>
            </View>
            <View style={styles.stepSep} />
            <View style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: Colors.inputBg }]}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="sync-outline" size={12} color={Colors.text3} />
                </Animated.View>
              </View>
              <Text style={[styles.stepText, { color: Colors.text3 }]}>{t("checkout.waitingConfirm")}</Text>
            </View>
          </View>
          {ussdCode && (
            <View style={styles.ussdBox}>
              <Text style={styles.ussdLabel}>{t("checkout.ussdCode")}</Text>
              <Text style={styles.ussdCodeText}>{ussdCode}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.cancelPayBtn} onPress={() => { stopPolling(); setPaymentPhase("form"); }}>
            <Text style={styles.cancelPayText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (paymentPhase === "success") {
    return (
      <View style={styles.payScreen}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.payCenter} edges={["top", "bottom"]}>
          <View style={[styles.resultIconWrap, { backgroundColor: Colors.success + "18" }]}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.payTitle}>{t("checkout.paySuccess")}</Text>
          <Text style={styles.paySub}>{t("checkout.paySuccessMsg")}</Text>
          <TouchableOpacity style={styles.resultBtn} onPress={() => router.replace({ pathname: "/order/[id]", params: { id: orderId! } })}>
            <Text style={styles.resultBtnText}>{t("checkout.viewOrder")}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (paymentPhase === "failed") {
    return (
      <View style={styles.payScreen}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.payCenter} edges={["top", "bottom"]}>
          <View style={[styles.resultIconWrap, { backgroundColor: Colors.error + "18" }]}>
            <Ionicons name="close-circle" size={64} color={Colors.error} />
          </View>
          <Text style={styles.payTitle}>{t("checkout.payFailed")}</Text>
          <Text style={styles.paySub}>{t("checkout.payFailedMsg")}</Text>
          <TouchableOpacity style={[styles.resultBtn, { backgroundColor: Colors.error }]} onPress={() => setPaymentPhase("form")}>
            <Text style={styles.resultBtnText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Formulaire principal ──────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.headerSafe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("checkout.title")}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* Agence */}
        {branch_name && (
          <View style={styles.branchCard}>
            <View style={styles.branchIconWrap}>
              <Ionicons name="storefront-outline" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.branchLabel}>{t("checkout.branch").toUpperCase()}</Text>
              <Text style={styles.branchName}>{branch_name}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          </View>
        )}

        {/* Type de commande */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("checkout.orderMode")}</Text>
          <View style={styles.typeRow}>
            {(["collect", "delivery"] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeCard, orderType === type && styles.typeCardActive]}
                onPress={() => setOrderType(type)}
              >
                <View style={[styles.typeIconWrap, orderType === type && styles.typeIconWrapActive]}>
                  <Ionicons
                    name={type === "collect" ? "qr-code-outline" : "bicycle-outline"}
                    size={22}
                    color={orderType === type ? Colors.primary : Colors.text3}
                  />
                </View>
                <Text style={[styles.typeLabel, orderType === type && styles.typeLabelActive]}>
                  {type === "collect" ? t("checkout.collectLabel") : t("checkout.deliveryLabel")}
                </Text>
                <Text style={styles.typeSubLabel}>
                  {type === "collect" ? t("checkout.collectSub") : t("checkout.deliverySub")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Créneaux */}
        {orderType === "collect" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("checkout.slotTitle")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day.iso}
                  style={[styles.dayBtn, selectedDate === day.iso && styles.dayBtnActive]}
                  onPress={() => { setSelectedDate(day.iso); setSelectedSlot(""); }}
                >
                  <Text style={[styles.dayLabel, selectedDate === day.iso && styles.dayLabelActive]}>{day.label}</Text>
                  <Text style={[styles.dayShort, selectedDate === day.iso && styles.dayShortActive]}>{day.short}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {slotsLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
            ) : slots.length === 0 ? (
              <View style={styles.emptySlots}>
                <Ionicons name="time-outline" size={24} color={Colors.border} />
                <Text style={styles.emptySlotsText}>
                  {t("checkout.noSlots")} {DAYS.find((d) => d.iso === selectedDate)?.label?.toLowerCase() ?? ""}
                </Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot) => {
                  const full = slot.booked >= slot.capacity;
                  const active = selectedSlot === slot.id;
                  const remaining = slot.capacity - slot.booked;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slotBtn, active && styles.slotBtnActive, full && styles.slotBtnFull]}
                      onPress={() => !full && setSelectedSlot(slot.id)}
                      disabled={full}
                    >
                      <Text style={[styles.slotTime, active && styles.slotTimeActive, full && styles.slotTimeFull]}>
                        {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      </Text>
                      {full
                        ? <Text style={styles.slotFull}>{t("checkout.full")}</Text>
                        : <Text style={[styles.slotRemaining, active && { color: Colors.primary }]}>
                            {remaining} {remaining > 1 ? t("checkout.spotsPlural") : t("checkout.spots")}
                          </Text>
                      }
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Livraison */}
        {orderType === "delivery" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("checkout.deliveryAddressTitle")}</Text>
              <AddressAutocomplete
                value={address}
                onChangeText={setAddress}
                onSelectAddress={(addr, lat, lng) => {
                  setAddress(addr);
                  setAddressCoords({ lat, lng });
                }}
                placeholder="Ex: Rue des Palmiers, Yaoundé…"
              />
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("checkout.recipientPhone")}</Text>
              <Text style={styles.fieldHint}>{t("checkout.recipientPhoneHint")}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={Colors.text3} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="+237 6XX XXX XXX"
                  placeholderTextColor={Colors.text3}
                  value={deliveryPhone}
                  onChangeText={setDeliveryPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </>
        )}

        {/* Paiement — type selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("checkout.paymentTitle")}</Text>

          {/* Toggle Mobile Money vs Wallet */}
          <View style={styles.payTypeRow}>
            <TouchableOpacity
              style={[styles.payTypeBtn, paymentType === "momo" && styles.payTypeBtnActive]}
              onPress={() => setPaymentType("momo")}
            >
              <Ionicons name="phone-portrait-outline" size={18} color={paymentType === "momo" ? Colors.primary : Colors.text3} />
              <Text style={[styles.payTypeLabel, paymentType === "momo" && styles.payTypeLabelActive]}>Mobile Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payTypeBtn, paymentType === "wallet" && styles.payTypeBtnActive]}
              onPress={() => setPaymentType("wallet")}
            >
              <Ionicons name="wallet-outline" size={18} color={paymentType === "wallet" ? Colors.primary : Colors.text3} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.payTypeLabel, paymentType === "wallet" && styles.payTypeLabelActive]}>
                  Wallet {walletBalance !== null ? `— ${formatCurrency(walletBalance)}` : ""}
                </Text>
                <Text style={styles.payTypeDiscount}>-1% sur le total</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Wallet: balance status */}
          {paymentType === "wallet" && (
            <>
              {walletBalance === null ? (
                <TouchableOpacity style={styles.walletNoBalance} onPress={() => router.push("/wallet" as any)}>
                  <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
                  <Text style={styles.walletNoBalanceText}>{t("wallet.noWallet")} — {t("wallet.activateNow")}</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.warning} />
                </TouchableOpacity>
              ) : walletBalance < walletTotal ? (
                <TouchableOpacity style={styles.walletInsufficient} onPress={() => router.push("/wallet/topup" as any)}>
                  <Ionicons name="warning-outline" size={18} color={Colors.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.walletInsufficientText}>{t("wallet.insufficientBalance")}</Text>
                    <Text style={styles.walletInsufficientSub}>
                      {t("wallet.insufficientMsg", { balance: formatCurrency(walletBalance), missing: formatCurrency(walletTotal - walletBalance) })}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              ) : (
                <View style={styles.walletOk}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={styles.walletOkText}>Solde suffisant — {formatCurrency(walletBalance)}</Text>
                </View>
              )}
            </>
          )}

          {/* MoMo options */}
          {paymentType === "momo" && (
            <>
              <View style={[styles.payRow, { marginTop: 14 }]}>
                {OPERATORS.map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.payCard, paymentMethod === op.id && styles.payCardActive]}
                    onPress={() => setPaymentMethod(op.id)}
                  >
                    <View style={[styles.payDot, { backgroundColor: op.color }]} />
                    <Text style={[styles.payLabel, paymentMethod === op.id && styles.payLabelActive]}>{op.label}</Text>
                    <Text style={styles.payPrefix}>{op.prefix}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.fieldHint, { marginTop: 14, marginBottom: 6 }]}>{t("checkout.mobileMoneyLabel")}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="phone-portrait-outline" size={18} color={Colors.text3} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="+237 6XX XXX XXX"
                  placeholderTextColor={Colors.text3}
                  value={paymentPhone}
                  onChangeText={handlePaymentPhoneChange}
                  keyboardType="phone-pad"
                />
              </View>
              {paymentPhone.length > 0 && detectOperator(paymentPhone) !== paymentMethod && (
                <Text style={styles.warnText}>
                  {t("checkout.numberMismatch")} {OPERATORS.find((o) => o.id === paymentMethod)?.label}
                </Text>
              )}
              {paymentPhone.replace(/\D/g, "").length >= 9 &&
                paymentPhone !== profileResp?.data?.default_payment_phone && (
                <TouchableOpacity
                  style={styles.saveDefaultBtn}
                  onPress={() => {
                    apiPost("/users/me/default-payment", { phone: paymentPhone.replace(/\s/g, ""), method: paymentMethod });
                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                    Alert.alert(t("checkout.savedTitle"), t("checkout.savedMsg"));
                  }}
                >
                  <Ionicons name="bookmark-outline" size={14} color={Colors.primary} />
                  <Text style={styles.saveDefaultText}>{t("checkout.saveDefault")}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("checkout.noteTitle")}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              placeholder={t("checkout.notePh")}
              placeholderTextColor={Colors.text3}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </View>

        {/* Récapitulatif */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("checkout.summaryTitle")}</Text>
          <View style={styles.summaryCard}>
            {items.map((item) => (
              <View key={item.product_id} style={styles.summaryRow}>
                <Text style={styles.summaryItemName} numberOfLines={1}>{item.quantity}× {item.product_name}</Text>
                <Text style={styles.summaryItemPrice}>{formatCurrency(item.unit_price * item.quantity)}</Text>
              </View>
            ))}
            {promo_pct && promo_pct > 0 ? (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryItemName}>{t("cart.subtotal")}</Text>
                  <Text style={styles.summaryItemPrice}>{formatCurrency(getTotal())}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryItemName, { color: Colors.primary }]}>
                    {promo_code}{promo_label ? ` — ${promo_label}` : ""} (−{promo_pct}%)
                  </Text>
                  <Text style={[styles.summaryItemPrice, { color: Colors.primary }]}>−{formatCurrency(getDiscount())}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.summaryDivider} />
            {paymentType === "wallet" && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryItemName, { color: Colors.primary }]}>{t("wallet.walletDiscount")}</Text>
                <Text style={[styles.summaryItemPrice, { color: Colors.primary }]}>−{formatCurrency(walletSaving)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>{t("cart.total")}</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrency(finalTotal)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Barre de confirmation */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomAmountRow}>
          <Text style={styles.bottomLabel}>{t("checkout.totalToPay")}</Text>
          <Text style={styles.bottomTotal}>{formatCurrency(finalTotal)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canSubmit || orderMutation.isPending}
        >
          {orderMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name={paymentType === "wallet" ? "wallet-outline" : "phone-portrait-outline"} size={18} color="#fff" />
                <Text style={styles.submitText}>{t("checkout.confirmAndPay")}</Text>
              </>
          }
        </TouchableOpacity>
        {!canSubmit && (
          <Text style={styles.hintText}>
            {orderType === "collect" && !selectedSlot ? t("checkout.selectSlotHint") :
             orderType === "delivery" && address.trim().length < 5 ? t("checkout.enterAddressHint") :
             paymentType === "momo" && paymentPhone.replace(/\D/g, "").length < 9 ? t("checkout.enterPhoneHint") :
             paymentType === "wallet" && (walletBalance ?? 0) < walletTotal ? t("wallet.insufficientBalance") : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  headerSafe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },

  // Payment screens
  payScreen: { flex: 1, backgroundColor: Colors.bg },
  payCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  payIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  spinnerWrap: { marginBottom: 8 },
  payAmount: { fontSize: 28, fontWeight: "800", color: Colors.primary },
  payTitle: { fontSize: 20, fontWeight: "700", color: Colors.text, textAlign: "center" },
  paySub: { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 22 },
  opBadge: {
    borderWidth: 1.5, borderRadius: Radius.full,
    paddingHorizontal: 18, paddingVertical: 6,
  },
  opBadgeText: { fontSize: 13, fontWeight: "700" },
  stepsBox: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.lg,
    padding: 16, width: "100%", marginTop: 8,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  stepNumText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  stepText: { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 20 },
  stepPhone: { fontWeight: "700", color: Colors.text },
  stepSep: { height: 1, backgroundColor: Colors.divider, marginVertical: 10 },
  ussdBox: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg,
    paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", gap: 4,
  },
  ussdLabel: { fontSize: 10, fontWeight: "700", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },
  ussdCodeText: { fontSize: 20, fontWeight: "700", color: Colors.primary, letterSpacing: 3 },
  cancelPayBtn: { paddingVertical: 10 },
  cancelPayText: { fontSize: 14, color: Colors.text3 },
  resultIconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  resultBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.success, borderRadius: Radius.full,
    paddingHorizontal: 28, paddingVertical: 14, marginTop: 8,
  },
  resultBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Branch
  branchCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    margin: 16, backgroundColor: Colors.bg, borderRadius: Radius.lg,
    padding: 14, ...Shadow.sm,
  },
  branchIconWrap: {
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  branchLabel: { fontSize: 10, fontWeight: "700", color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.8 },
  branchName: { fontSize: 15, fontWeight: "600", color: Colors.text, marginTop: 2 },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: Colors.text3,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12,
  },
  fieldHint: { fontSize: 12, color: Colors.text3, marginBottom: 6 },
  saveDefaultBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  saveDefaultText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },

  // Type
  typeRow: { flexDirection: "row", gap: 12 },
  typeCard: {
    flex: 1, alignItems: "center", gap: 6, padding: 16,
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm,
  },
  typeCardActive: { borderColor: Colors.primary },
  typeIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  typeIconWrapActive: { backgroundColor: Colors.primaryLight },
  typeLabel: { fontSize: 13, fontWeight: "700", color: Colors.text3 },
  typeLabelActive: { color: Colors.primary },
  typeSubLabel: { fontSize: 10, color: Colors.text3, textAlign: "center" },

  // Days
  dayBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", minWidth: 72,
  },
  dayBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  dayLabel: { fontSize: 11, fontWeight: "600", color: Colors.text3 },
  dayLabelActive: { color: Colors.primary },
  dayShort: { fontSize: 10, color: Colors.text3, marginTop: 2 },
  dayShortActive: { color: Colors.primary },

  emptySlots: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptySlotsText: { color: Colors.text3, fontSize: 13 },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  slotBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  slotBtnFull: { opacity: 0.4 },
  slotTime: { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  slotTimeActive: { color: Colors.primary },
  slotTimeFull: { textDecorationLine: "line-through" },
  slotFull: { fontSize: 9, color: Colors.text3, marginTop: 2 },
  slotRemaining: { fontSize: 9, color: Colors.text3, marginTop: 2 },

  // Input
  inputWrap: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    padding: 14, minHeight: 52,
  },
  input: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 20 },

  // Payment type toggle
  payTypeRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  payTypeBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  payTypeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  payTypeLabel: { fontSize: 13, fontWeight: "700", color: Colors.text3, flex: 1 },
  payTypeLabelActive: { color: Colors.primary },
  payTypeDiscount: { fontSize: 10, color: Colors.success, fontWeight: "600" },
  walletOk: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: 10, marginTop: 8 },
  walletOkText: { fontSize: 13, color: Colors.success, fontWeight: "600" },
  walletNoBalance: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF8E1", borderRadius: Radius.md, padding: 12, marginTop: 8 },
  walletNoBalanceText: { flex: 1, fontSize: 13, color: Colors.warning, fontWeight: "600" },
  walletInsufficient: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFEBEE", borderRadius: Radius.md, padding: 12, marginTop: 8 },
  walletInsufficientText: { fontSize: 13, color: Colors.error, fontWeight: "700" },
  walletInsufficientSub: { fontSize: 11, color: Colors.error, marginTop: 2 },

  // Payment method
  payRow: { flexDirection: "row", gap: 10 },
  payCard: {
    flex: 1, alignItems: "center", gap: 5, padding: 12,
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm,
  },
  payCardActive: { borderColor: Colors.primary },
  payDot: { width: 28, height: 28, borderRadius: 14 },
  payLabel: { fontSize: 11, fontWeight: "700", color: Colors.text3, textAlign: "center" },
  payLabelActive: { color: Colors.text },
  payPrefix: { fontSize: 9, color: Colors.text3 },
  warnText: { fontSize: 12, color: Colors.error, marginTop: 6 },

  // Summary
  summaryCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.sm,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryItemName: { flex: 1, fontSize: 13, color: Colors.text2, paddingRight: 8 },
  summaryItemPrice: { fontSize: 13, fontWeight: "600", color: Colors.text },
  summaryDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 8 },
  summaryTotalLabel: { fontSize: 14, fontWeight: "700", color: Colors.text },
  summaryTotalValue: { fontSize: 16, fontWeight: "800", color: Colors.primary },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bg, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.md,
  },
  bottomAmountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  bottomLabel: { fontSize: 13, color: Colors.text2 },
  bottomTotal: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.full, height: 52, ...Shadow.primary,
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  hintText: { fontSize: 12, color: Colors.text3, textAlign: "center", marginTop: 8 },
});
