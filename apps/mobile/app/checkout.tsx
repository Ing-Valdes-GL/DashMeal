import { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Animated, Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency, formatTime } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimeSlot {
  id: string; date: string; start_time: string; end_time: string;
  capacity: number; booked: number;
}
interface ApiResponse<T> { success: boolean; data: T }
type PaymentMethod = "orange_money" | "mtn_mobile_money";
type PaymentStatus = "pending" | "paid" | "failed";

// ─── Constantes opérateurs ────────────────────────────────────────────────────
const OPERATORS: { id: PaymentMethod; label: string; color: string; prefix: string }[] = [
  { id: "orange_money",   label: "Orange Money",    color: "#ff6600", prefix: "237 69" },
  { id: "mtn_mobile_money", label: "MTN Mobile Money", color: "#ffcc00", prefix: "237 67/68" },
];

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function detectOperator(phone: string): PaymentMethod | null {
  const digits = phone.replace(/\D/g, "");
  // Cameroun: 237 + numéro à 9 chiffres
  const local = digits.startsWith("237") ? digits.slice(3) : digits;
  if (local.startsWith("69") || local.startsWith("655") || local.startsWith("656") || local.startsWith("659")) return "orange_money";
  if (local.startsWith("67") || local.startsWith("68") || local.startsWith("650") || local.startsWith("651") || local.startsWith("652")) return "mtn_mobile_money";
  return null;
}

// ─── Helpers date ─────────────────────────────────────────────────────────────
function getNext7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      short: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    });
  }
  return days;
}
const DAYS = getNext7Days();

// ─── Composant principal ──────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const router = useRouter();
  const { items, getTotal, branch_id, branch_name, clear } = useCartStore();

  // ── Guard : rediriger si panier vide ou sans agence ─────────────────────────
  useEffect(() => {
    if (!branch_id || items.length === 0) {
      router.replace("/(tabs)/cart");
    }
  }, [branch_id, items.length, router]);

  // ── État formulaire ─────────────────────────────────────────────────────────
  const [orderType, setOrderType] = useState<"collect" | "delivery">("collect");
  const [selectedDate, setSelectedDate] = useState<string>(DAYS[0].iso);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [address, setAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("orange_money");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [notes, setNotes] = useState("");

  // ── État paiement (polling) ─────────────────────────────────────────────────
  const [paymentPhase, setPaymentPhase] = useState<"form" | "waiting" | "success" | "failed">("form");
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
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

  // ── Créneaux (refetch sur changement de date) ────────────────────────────────
  const { data: slotsResp, isLoading: slotsLoading } = useQuery<ApiResponse<TimeSlot[]>>({
    queryKey: ["slots", branch_id, selectedDate],
    queryFn: () => apiGet(`/collect/slots/${branch_id}`, { date: selectedDate }),
    enabled: !!branch_id && orderType === "collect",
  });
  const slots = slotsResp?.data ?? [];

  // ── GPS ─────────────────────────────────────────────────────────────────────
  const getGpsLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Activez la localisation dans les paramètres.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (geo) {
        const parts = [geo.streetNumber, geo.street, geo.district, geo.city].filter(Boolean);
        setAddress(parts.join(", ") || `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`);
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'obtenir votre position.");
    } finally {
      setGpsLoading(false);
    }
  };

  // ── Détection auto opérateur ─────────────────────────────────────────────────
  const handlePaymentPhoneChange = (text: string) => {
    setPaymentPhone(text);
    const detected = detectOperator(text);
    if (detected) setPaymentMethod(detected);
  };

  // ── Polling statut paiement ──────────────────────────────────────────────────
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
          stopPolling();
          setOrderId(order_id);
          setPaymentPhase("success");
          clear(); // vider le panier — la commande est confirmée
        } else if (status === "failed") {
          stopPolling();
          setPaymentPhase("failed");
        }
      } catch {
        // erreur réseau → continuer à poller
      }
      if (attempts >= 40) { // 2 min max
        stopPolling();
        setPaymentPhase("failed");
      }
    }, 3000);
  }, [stopPolling, clear]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Soumission : payer d'abord, commande créée après confirmation ────────────
  const orderMutation = useMutation({
    mutationFn: () => apiPost<ApiResponse<{ reference: string; ussd_code: string | null; operator: string | null; total: number }>>(
      "/payments/initiate-order",
      {
        branch_id,
        type: orderType,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        ...(orderType === "collect" ? { slot_id: selectedSlot } : {
          delivery_address: address,
          delivery_phone: deliveryPhone || undefined,
        }),
        payment_method: paymentMethod,
        payment_phone: paymentPhone.replace(/\s/g, ""),
        notes: notes || undefined,
      }
    ),
    onSuccess: (resp) => {
      const d = resp?.data;
      if (!d) return;
      // L'USSD push a déjà été envoyé sur le téléphone de l'utilisateur
      // → afficher l'écran d'attente immédiatement
      setUssdCode(d.ussd_code ?? null);
      setPaymentRef(d.reference);
      setPaymentPhase("waiting");
      startPolling(d.reference);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      Alert.alert("Erreur de paiement", msg ?? "Impossible d'initier le paiement. Vérifiez votre connexion.");
    },
  });

  const canSubmit =
    items.length > 0 &&
    paymentPhone.replace(/\D/g, "").length >= 9 &&
    (orderType === "collect" ? !!selectedSlot : address.trim().length >= 5);

  const handleConfirm = () => {
    Alert.alert(
      "Confirmer le paiement",
      `Une demande de paiement de ${formatCurrency(getTotal())} sera envoyée au ${paymentPhone} via ${OPERATORS.find((o) => o.id === paymentMethod)?.label}. Confirmez-vous ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", onPress: () => orderMutation.mutate() },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Écrans de paiement en attente / succès / échec
  // ─────────────────────────────────────────────────────────────────────────────
  if (paymentPhase === "waiting") {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#050d1a", "#0a0f1e"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.centerScreen} edges={["top", "bottom"]}>
          <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 32 }}>
            <Ionicons name="radio-button-on-outline" size={72} color="#f97316" />
          </Animated.View>
          <Text style={styles.waitTitle}>En attente de paiement…</Text>
          <Text style={styles.waitSub}>
            Approuvez la demande USSD sur votre téléphone {"\n"}
            {OPERATORS.find((o) => o.id === paymentMethod)?.label}
          </Text>
          {ussdCode && (
            <View style={styles.ussdBox}>
              <Text style={styles.ussdLabel}>Code USSD</Text>
              <Text style={styles.ussdCode}>{ussdCode}</Text>
            </View>
          )}
          <Text style={styles.waitHint}>Numéro : {paymentPhone}</Text>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => { stopPolling(); setPaymentPhase("form"); }}
          >
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (paymentPhase === "success") {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#050d1a", "#0a0f1e"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.centerScreen} edges={["top", "bottom"]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
          </View>
          <Text style={styles.successTitle}>Paiement confirmé !</Text>
          <Text style={styles.waitSub}>Votre commande a bien été enregistrée.</Text>
          <TouchableOpacity
            style={styles.viewOrderBtn}
            onPress={() => {
              router.replace({ pathname: "/order/[id]", params: { id: orderId! } });
            }}
          >
            <Text style={styles.viewOrderText}>Voir ma commande</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (paymentPhase === "failed") {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#050d1a", "#0a0f1e"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.centerScreen} edges={["top", "bottom"]}>
          <View style={styles.failIcon}>
            <Ionicons name="close-circle" size={80} color="#ef4444" />
          </View>
          <Text style={styles.failTitle}>Paiement échoué</Text>
          <Text style={styles.waitSub}>La transaction n'a pas abouti.{"\n"}Vérifiez votre solde et réessayez.</Text>
          <TouchableOpacity style={styles.viewOrderBtn} onPress={() => setPaymentPhase("form")}>
            <Text style={styles.viewOrderText}>Réessayer</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Formulaire principal
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#050d1a", "#0a0f1e"]} style={StyleSheet.absoluteFill} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Finaliser la commande</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* Agence */}
        {branch_name && (
          <View style={styles.branchCard}>
            <Ionicons name="storefront-outline" size={20} color="#f97316" />
            <View style={{ flex: 1 }}>
              <Text style={styles.branchLabel}>Agence</Text>
              <Text style={styles.branchName}>{branch_name}</Text>
            </View>
          </View>
        )}

        {/* Type de commande */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode de récupération</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeCard, orderType === "collect" && styles.typeCardActive]}
              onPress={() => setOrderType("collect")}
            >
              <Ionicons name="qr-code-outline" size={24} color={orderType === "collect" ? "#f97316" : "#475569"} />
              <Text style={[styles.typeLabel, orderType === "collect" && styles.typeLabelActive]}>Retrait</Text>
              <Text style={styles.typeSubLabel}>Récupérer en agence</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeCard, orderType === "delivery" && styles.typeCardActive]}
              onPress={() => setOrderType("delivery")}
            >
              <Ionicons name="bicycle-outline" size={24} color={orderType === "delivery" ? "#f97316" : "#475569"} />
              <Text style={[styles.typeLabel, orderType === "delivery" && styles.typeLabelActive]}>Livraison</Text>
              <Text style={styles.typeSubLabel}>Livré chez vous</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Créneaux (retrait) */}
        {orderType === "collect" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Créneau de retrait</Text>

            {/* Sélecteur de jour */}
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
              <ActivityIndicator color="#f97316" style={{ marginTop: 12 }} />
            ) : slots.length === 0 ? (
              <View style={styles.emptySlots}>
                <Ionicons name="time-outline" size={24} color="#334155" />
                <Text style={styles.emptySlotsText}>
                  Aucun créneau disponible {DAYS.find((d) => d.iso === selectedDate)?.label?.toLowerCase() ?? "ce jour"}
                </Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot) => {
                  const full = slot.booked >= slot.capacity;
                  const active = selectedSlot === slot.id;
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
                      {full && <Text style={styles.slotFull}>Complet</Text>}
                      {!full && (
                        <Text style={[styles.slotRemaining, active && { color: "#f97316" }]}>
                          {slot.capacity - slot.booked} place{slot.capacity - slot.booked > 1 ? "s" : ""}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Adresse livraison */}
        {orderType === "delivery" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adresse de livraison</Text>
              <TouchableOpacity
                style={styles.gpsBtn}
                onPress={getGpsLocation}
                disabled={gpsLoading}
              >
                {gpsLoading ? (
                  <ActivityIndicator color="#f97316" size="small" />
                ) : (
                  <Ionicons name="locate-outline" size={18} color="#f97316" />
                )}
                <Text style={styles.gpsBtnText}>
                  {gpsLoading ? "Localisation…" : "Utiliser ma position"}
                </Text>
              </TouchableOpacity>
              <View style={[styles.inputWrap, { marginTop: 10 }]}>
                <Ionicons name="location-outline" size={18} color="#64748b" style={{ marginRight: 8, marginTop: 2 }} />
                <TextInput
                  style={[styles.input, { minHeight: 56 }]}
                  placeholder="Ex: Rue des Palmiers, Yaoundé..."
                  placeholderTextColor="#334155"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Téléphone du destinataire</Text>
              <Text style={styles.fieldHint}>Le livreur appellera ce numéro à la livraison</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="+237 6XX XXX XXX"
                  placeholderTextColor="#334155"
                  value={deliveryPhone}
                  onChangeText={setDeliveryPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </>
        )}

        {/* Moyen de paiement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moyen de paiement</Text>
          <View style={styles.payRow}>
            {OPERATORS.map((op) => (
              <TouchableOpacity
                key={op.id}
                style={[styles.payCard, paymentMethod === op.id && styles.payCardActive]}
                onPress={() => setPaymentMethod(op.id)}
              >
                <View style={[styles.payDot, { backgroundColor: op.color }]} />
                <Text style={[styles.payLabel, paymentMethod === op.id && styles.payLabelActive]}>
                  {op.label}
                </Text>
                <Text style={styles.payPrefix}>{op.prefix}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldHint, { marginTop: 14, marginBottom: 6 }]}>
            Numéro Mobile Money pour le paiement
          </Text>
          <View style={styles.inputWrap}>
            <Ionicons name="phone-portrait-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="+237 6XX XXX XXX"
              placeholderTextColor="#334155"
              value={paymentPhone}
              onChangeText={handlePaymentPhoneChange}
              keyboardType="phone-pad"
            />
          </View>
          {paymentPhone.length > 0 && detectOperator(paymentPhone) !== paymentMethod && (
            <Text style={styles.warnText}>
              ⚠ Le numéro semble ne pas correspondre à {OPERATORS.find((o) => o.id === paymentMethod)?.label}
            </Text>
          )}
        </View>

        {/* Note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note (optionnel)</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              placeholder="Instructions particulières..."
              placeholderTextColor="#334155"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </View>

        {/* Récapitulatif */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>
          <View style={styles.summaryCard}>
            {items.map((item) => (
              <View key={item.product_id} style={styles.summaryItem}>
                <Text style={styles.summaryItemName} numberOfLines={1}>
                  {item.quantity}× {item.product_name}
                </Text>
                <Text style={styles.summaryItemPrice}>
                  {formatCurrency(item.unit_price * item.quantity)}
                </Text>
              </View>
            ))}
            {orderType === "delivery" && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemName}>Frais de livraison</Text>
                <Text style={styles.summaryItemPrice}>{formatCurrency(500)}</Text>
              </View>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>
                {formatCurrency(getTotal() + (orderType === "delivery" ? 500 : 0))}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Barre de confirmation */}
      <View style={styles.bottomBar}>
        <View style={styles.totalRow}>
          <Text style={styles.bottomLabel}>Total à payer</Text>
          <Text style={styles.bottomTotal}>
            {formatCurrency(getTotal() + (orderType === "delivery" ? 500 : 0))}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canSubmit || orderMutation.isPending}
        >
          {orderMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="phone-portrait-outline" size={18} color="#fff" />
              <Text style={styles.submitText}>Confirmer et payer</Text>
            </>
          )}
        </TouchableOpacity>
        {!canSubmit && (
          <Text style={styles.hintText}>
            {orderType === "collect" && !selectedSlot ? "Sélectionnez un créneau" :
             orderType === "delivery" && address.trim().length < 5 ? "Entrez une adresse de livraison" :
             paymentPhone.replace(/\D/g, "").length < 9 ? "Entrez le numéro Mobile Money" : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050d1a" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#fff" },

  // Branch
  branchCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 20, marginBottom: 4,
    backgroundColor: "rgba(249,115,22,0.08)", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(249,115,22,0.2)",
  },
  branchLabel: { fontSize: 10, color: "#64748b", textTransform: "uppercase" },
  branchName: { fontSize: 15, fontWeight: "600", color: "#fff" },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionTitle: {
    fontSize: 12, fontWeight: "700", color: "#64748b",
    marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.6,
  },
  fieldHint: { fontSize: 12, color: "#475569", marginBottom: 4 },

  // Type
  typeRow: { flexDirection: "row", gap: 12 },
  typeCard: {
    flex: 1, alignItems: "center", gap: 6, padding: 14,
    backgroundColor: "#0f172a", borderRadius: 16,
    borderWidth: 1.5, borderColor: "#1e293b",
  },
  typeCardActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.08)" },
  typeLabel: { fontSize: 13, fontWeight: "700", color: "#475569" },
  typeLabelActive: { color: "#f97316" },
  typeSubLabel: { fontSize: 10, color: "#334155", textAlign: "center" },

  // Slots
  // day picker
  dayBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    alignItems: "center", minWidth: 72,
  },
  dayBtnActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.1)" },
  dayLabel: { fontSize: 11, fontWeight: "600", color: "#475569" },
  dayLabelActive: { color: "#f97316" },
  dayShort: { fontSize: 10, color: "#334155", marginTop: 2 },
  dayShortActive: { color: "#fb923c" },

  emptySlots: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptySlotsText: { color: "#334155", fontSize: 13 },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b", alignItems: "center",
  },
  slotBtnActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.1)" },
  slotBtnFull: { opacity: 0.35 },
  slotTime: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  slotTimeActive: { color: "#f97316" },
  slotTimeFull: { textDecorationLine: "line-through" },
  slotFull: { fontSize: 9, color: "#475569", marginTop: 2 },
  slotRemaining: { fontSize: 9, color: "#475569", marginTop: 2 },

  // GPS
  gpsBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: "rgba(249,115,22,0.4)",
    backgroundColor: "rgba(249,115,22,0.06)", borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, alignSelf: "flex-start",
  },
  gpsBtnText: { color: "#f97316", fontWeight: "600", fontSize: 13 },

  // Input
  inputWrap: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    borderRadius: 12, padding: 14, minHeight: 52,
  },
  input: { flex: 1, color: "#fff", fontSize: 14, lineHeight: 20 },

  // Payment
  payRow: { flexDirection: "row", gap: 10 },
  payCard: {
    flex: 1, alignItems: "center", gap: 5, padding: 12,
    backgroundColor: "#0f172a", borderRadius: 14,
    borderWidth: 1.5, borderColor: "#1e293b",
  },
  payCardActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.06)" },
  payDot: { width: 28, height: 28, borderRadius: 14 },
  payLabel: { fontSize: 11, fontWeight: "700", color: "#475569", textAlign: "center" },
  payLabelActive: { color: "#f97316" },
  payPrefix: { fontSize: 9, color: "#334155" },
  warnText: { fontSize: 11, color: "#f59e0b", marginTop: 6 },

  // Summary
  summaryCard: {
    backgroundColor: "#0f172a", borderRadius: 16,
    borderWidth: 1, borderColor: "#1e293b", padding: 14, gap: 8,
  },
  summaryItem: { flexDirection: "row", justifyContent: "space-between" },
  summaryItemName: { flex: 1, fontSize: 13, color: "#94a3b8" },
  summaryItemPrice: { fontSize: 13, fontWeight: "600", color: "#fff" },
  summaryDivider: { height: 1, backgroundColor: "#1e293b", marginVertical: 4 },
  summaryTotal: { flexDirection: "row", justifyContent: "space-between" },
  summaryTotalLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  summaryTotalValue: { fontSize: 15, fontWeight: "800", color: "#f97316" },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f172a", borderTopWidth: 1, borderTopColor: "#1e293b",
    padding: 20, paddingBottom: 36, gap: 10,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bottomLabel: { fontSize: 13, color: "#64748b" },
  bottomTotal: { fontSize: 20, fontWeight: "800", color: "#f97316" },
  submitBtn: {
    backgroundColor: "#f97316", borderRadius: 14, height: 52,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#f97316", shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  hintText: { fontSize: 11, color: "#475569", textAlign: "center" },

  // Waiting / success / failed screens
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  waitTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 12, textAlign: "center" },
  waitSub: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  waitHint: { fontSize: 13, color: "#475569", marginBottom: 32 },
  ussdBox: {
    backgroundColor: "#0f172a", borderRadius: 14,
    borderWidth: 1, borderColor: "#1e293b",
    paddingVertical: 12, paddingHorizontal: 24, alignItems: "center", marginBottom: 20,
  },
  ussdLabel: { fontSize: 10, color: "#475569", textTransform: "uppercase", marginBottom: 4 },
  ussdCode: { fontSize: 22, fontWeight: "800", color: "#f97316", letterSpacing: 2 },
  cancelBtn: {
    borderWidth: 1.5, borderColor: "#334155", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  cancelBtnText: { color: "#64748b", fontWeight: "600" },
  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#22c55e", marginBottom: 12 },
  failIcon: { marginBottom: 24 },
  failTitle: { fontSize: 24, fontWeight: "800", color: "#ef4444", marginBottom: 12 },
  viewOrderBtn: {
    backgroundColor: "#f97316", borderRadius: 14, height: 52,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingHorizontal: 28, marginTop: 8,
  },
  viewOrderText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
