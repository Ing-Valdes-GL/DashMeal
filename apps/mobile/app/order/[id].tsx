import { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Animated, Easing, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/utils";
import { Colors, Radius, Shadow } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderDetail {
  id: string; total: number; status: string; type: string;
  created_at: string; notes: string | null; subtotal: number;
  users: { name: string; phone: string };
  branches: { name: string };
  order_items: { quantity: number; unit_price: number; products: { name_fr: string } }[];
  collect_orders?: { qr_code: string; pickup_status: string; time_slots: { start_time: string; end_time: string; date: string } }[];
  deliveries?: { address: string; status: string; drivers: { name: string; phone: string } | null }[];
}

type PaymentMethod = "orange_money" | "mtn_mobile_money";
type ConvertPhase = "form" | "processing" | "waiting" | "success" | "failed";

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:    "#FFC107",
  confirmed:  "#2196F3",
  preparing:  "#9C27B0",
  ready:      Colors.success,
  delivering: Colors.primary,
  delivered:  Colors.success,
  cancelled:  Colors.error,
};

const STATUS_LABEL: Record<string, string> = {
  pending:    "En attente",
  confirmed:  "Confirmée",
  preparing:  "En préparation",
  ready:      "Prête",
  delivering: "En livraison",
  delivered:  "Livrée",
  cancelled:  "Annulée",
};

const STATUS_ICON: Record<string, string> = {
  pending:    "time-outline",
  confirmed:  "checkmark-circle-outline",
  preparing:  "restaurant-outline",
  ready:      "bag-check-outline",
  delivering: "bicycle-outline",
  delivered:  "checkmark-done-circle",
  cancelled:  "close-circle-outline",
};

const DELIVERY_FEE = 5;

function detectOperator(phone: string): PaymentMethod | null {
  const digits = phone.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("00237")) local = local.slice(5);
  else if (local.startsWith("237")) local = local.slice(3);
  if (/^69/.test(local) || /^65[5-9]/.test(local) || /^68/.test(local)) return "orange_money";
  if (/^67/.test(local) || /^65[0-4]/.test(local)) return "mtn_mobile_money";
  return null;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: resp, isLoading, refetch } = useQuery<{ success: boolean; data: OrderDetail }>({
    queryKey: ["order", id],
    queryFn: () => apiGet(`/orders/${id}`),
    staleTime: 0,
  });
  const order = resp?.data;

  // ── État modal conversion ───────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [address, setAddress] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("orange_money");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [convertPhase, setConvertPhase] = useState<ConvertPhase>("form");
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Animation spinner ────────────────────────────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (convertPhase === "waiting") {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [convertPhase, spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // ── GPS ─────────────────────────────────────────────────────────────────────
  const getGpsLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission refusée", "Activez la localisation dans les paramètres."); return; }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      if (geo) {
        const parts = [geo.streetNumber, geo.street, geo.district, geo.city].filter(Boolean);
        setAddress(parts.join(", ") || `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`);
      }
    } catch { Alert.alert("Erreur", "Impossible d'obtenir votre position."); }
    finally { setGpsLoading(false); }
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
        const r = await apiGet<{ success: boolean; data: { status: string; order_id?: string } }>(`/payments/status/${reference}`);
        const { status } = r?.data ?? {};
        if (status === "paid") {
          stopPolling(); setConvertPhase("success");
          queryClient.invalidateQueries({ queryKey: ["order", id] });
          queryClient.invalidateQueries({ queryKey: ["my-orders"] });
          refetch();
        } else if (status === "failed") {
          stopPolling(); setConvertPhase("failed");
        }
      } catch { /* continuer */ }
      if (attempts >= 40) { stopPolling(); setConvertPhase("failed"); }
    }, 3000);
  }, [stopPolling, id, queryClient, refetch]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Soumission conversion ────────────────────────────────────────────────────
  const handleConvertSubmit = async () => {
    if (!address.trim()) { Alert.alert("Adresse requise", "Veuillez saisir votre adresse de livraison."); return; }
    if (!paymentPhone.trim()) { Alert.alert("Téléphone requis", "Veuillez saisir votre numéro Mobile Money."); return; }
    setConvertPhase("processing");
    try {
      const data = await apiPost<{ success: boolean; data: { reference: string; ussd_code: string | null; delivery_fee: number } }>(
        `/orders/${id}/convert-to-delivery`,
        { delivery_address: address.trim(), payment_phone: paymentPhone.trim(), payment_method: paymentMethod }
      );
      setPaymentRef(data.data.reference);
      setUssdCode(data.data.ussd_code);
      setConvertPhase("waiting");
      startPolling(data.data.reference);
    } catch (err: any) {
      setConvertPhase("form");
      Alert.alert("Erreur", err?.response?.data?.error?.message ?? err?.message ?? "Une erreur est survenue.");
    }
  };

  const handlePhoneChange = (text: string) => {
    setPaymentPhone(text);
    const detected = detectOperator(text);
    if (detected) setPaymentMethod(detected);
  };

  const closeModal = () => {
    if (convertPhase === "waiting") return;
    stopPolling();
    setShowModal(false); setConvertPhase("form");
    setAddress(""); setPaymentPhone(""); setPaymentRef(null); setUssdCode(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const collect = order.collect_orders?.[0];
  const delivery = order.deliveries?.[0];
  const statusColor = STATUS_COLOR[order.status] ?? Colors.text3;
  const canConvert = order.type === "collect" && ["pending", "confirmed"].includes(order.status);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusIconWrap, { backgroundColor: statusColor + "18" }]}>
            <Ionicons name={STATUS_ICON[order.status] as any} size={26} color={statusColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusMeta}>Statut actuel</Text>
            <Text style={[styles.statusValue, { color: statusColor }]}>{STATUS_LABEL[order.status] ?? order.status}</Text>
          </View>
          <View style={[styles.typePill, { backgroundColor: statusColor + "18" }]}>
            <Ionicons
              name={order.type === "collect" ? "qr-code-outline" : "bicycle-outline"}
              size={12}
              color={statusColor}
            />
            <Text style={[styles.typeText, { color: statusColor }]}>
              {order.type === "collect" ? "Retrait" : "Livraison"}
            </Text>
          </View>
        </View>

        {/* Bouton suivi en temps réel */}
        {order.type === "delivery" && ["delivering", "confirmed", "preparing", "ready"].includes(order.status) && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.trackBtn}
              onPress={() => router.push({ pathname: "/tracking/[id]", params: { id: order.id } })}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.trackBtnText}>Suivre ma livraison en temps réel</Text>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Contact buttons */}
        {order.status !== "cancelled" && (
          <View style={[styles.section, { flexDirection: "row", gap: 10 }]}>
            {order.type === "delivery" && (
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: order.id, type: "driver" } })}
                activeOpacity={0.7}
              >
                <Ionicons name="bicycle-outline" size={16} color={Colors.primary} />
                <Text style={styles.contactBtnText}>Livreur</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.contactBtn, { flex: 1 }]}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: order.id, type: "support" } })}
              activeOpacity={0.7}
            >
              <Ionicons name="storefront-outline" size={16} color={Colors.primary} />
              <Text style={styles.contactBtnText}>Contacter l'agence</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* QR code */}
        {collect && order.type === "collect" && collect.pickup_status === "waiting" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QR Code de retrait</Text>
            <View style={styles.qrCard}>
              <Ionicons name="qr-code" size={72} color={Colors.primary} />
              <Text style={styles.qrCode}>{collect.qr_code}</Text>
              <Text style={styles.qrHint}>Présentez ce code à l'agence</Text>
              {collect.time_slots && (
                <View style={styles.qrSlotPill}>
                  <Ionicons name="time-outline" size={13} color={Colors.primary} />
                  <Text style={styles.qrSlotText}>
                    {formatTime(collect.time_slots.start_time)} – {formatTime(collect.time_slots.end_time)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Bouton conversion collect → livraison */}
        {canConvert && (
          <View style={styles.section}>
            <View style={styles.convertBanner}>
              <Ionicons name="information-circle-outline" size={18} color="#F59E0B" />
              <Text style={styles.convertBannerText}>Vous ne pouvez plus vous rendre en agence ?</Text>
            </View>
            <TouchableOpacity style={styles.convertBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
              <Ionicons name="bicycle-outline" size={18} color="#fff" />
              <Text style={styles.convertBtnText}>Me faire livrer à domicile</Text>
              <View style={styles.convertFeePill}>
                <Text style={styles.convertFeeText}>+{formatCurrency(DELIVERY_FEE)}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery info */}
        {delivery && order.type === "delivery" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations de livraison</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><Ionicons name="location-outline" size={16} color={Colors.primary} /></View>
                <Text style={styles.infoText}>{delivery.address}</Text>
              </View>
              {delivery.drivers && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="bicycle-outline" size={16} color={Colors.primary} /></View>
                  <Text style={styles.infoText}>{delivery.drivers.name} — {delivery.drivers.phone}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Articles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Articles commandés</Text>
          <View style={styles.itemsCard}>
            {order.order_items.map((item, i) => (
              <View key={i} style={[styles.itemRow, i < order.order_items.length - 1 && styles.itemBorder]}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <Text style={styles.itemName} numberOfLines={1}>{item.products.name_fr}</Text>
                <Text style={styles.itemPrice}>{formatCurrency(item.unit_price * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
            </View>
          </View>
        </View>

        {/* Infos générales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}><Ionicons name="storefront-outline" size={16} color={Colors.text3} /></View>
              <Text style={styles.infoText}>{order.branches.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}><Ionicons name="time-outline" size={16} color={Colors.text3} /></View>
              <Text style={styles.infoText}>{formatDateTime(order.created_at)}</Text>
            </View>
            {order.notes && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><Ionicons name="document-text-outline" size={16} color={Colors.text3} /></View>
                <Text style={styles.infoText}>{order.notes}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Modal conversion collect → livraison ─────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Phase : formulaire / processing */}
            {(convertPhase === "form" || convertPhase === "processing") && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Se faire livrer à domicile</Text>
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal}>
                    <Ionicons name="close" size={18} color={Colors.text2} />
                  </TouchableOpacity>
                </View>

                {/* Résumé frais */}
                <View style={styles.feeCard}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Commande (déjà payée)</Text>
                    <Text style={styles.feeAmount}>{formatCurrency(order.subtotal ?? order.total)}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Frais de livraison</Text>
                    <Text style={[styles.feeAmount, { color: Colors.primary }]}>+{formatCurrency(DELIVERY_FEE)}</Text>
                  </View>
                  <View style={styles.feeDivider} />
                  <View style={styles.feeRow}>
                    <Text style={styles.feeTotalLabel}>À payer maintenant</Text>
                    <Text style={styles.feeTotalValue}>{formatCurrency(DELIVERY_FEE)}</Text>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  {/* Adresse */}
                  <Text style={styles.inputLabel}>Adresse de livraison</Text>
                  <View style={styles.addressRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Ex : Rue Foucauld, Akwa, Douala"
                      placeholderTextColor={Colors.text3}
                      value={address}
                      onChangeText={setAddress}
                      multiline
                      numberOfLines={2}
                    />
                    <TouchableOpacity style={styles.gpsBtn} onPress={getGpsLocation} disabled={gpsLoading}>
                      {gpsLoading
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Ionicons name="locate-outline" size={18} color={Colors.primary} />
                      }
                    </TouchableOpacity>
                  </View>

                  {/* Paiement */}
                  <Text style={styles.inputLabel}>Numéro Mobile Money</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex : 6 90 00 00 00"
                    placeholderTextColor={Colors.text3}
                    keyboardType="phone-pad"
                    value={paymentPhone}
                    onChangeText={handlePhoneChange}
                  />

                  {/* Opérateur */}
                  <View style={styles.operatorRow}>
                    {(["orange_money", "mtn_mobile_money"] as PaymentMethod[]).map((op) => (
                      <TouchableOpacity
                        key={op}
                        style={[styles.operatorBtn, paymentMethod === op && styles.operatorBtnActive]}
                        onPress={() => setPaymentMethod(op)}
                      >
                        <View style={[styles.operatorDot, { backgroundColor: op === "orange_money" ? "#FF6600" : "#FFCC00" }]} />
                        <Text style={[styles.operatorLabel, paymentMethod === op && styles.operatorLabelActive]}>
                          {op === "orange_money" ? "Orange Money" : "MTN MoMo"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.modalHint}>
                    Un code USSD sera envoyé à votre téléphone. Confirmez votre PIN pour valider les frais de livraison.
                  </Text>
                </ScrollView>

                <TouchableOpacity
                  style={[styles.confirmBtn, convertPhase === "processing" && styles.confirmBtnDisabled]}
                  onPress={handleConvertSubmit}
                  disabled={convertPhase === "processing"}
                >
                  {convertPhase === "processing"
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name="bicycle-outline" size={18} color="#fff" />
                        <Text style={styles.confirmBtnText}>Payer {formatCurrency(DELIVERY_FEE)} et se faire livrer</Text>
                      </>
                  }
                </TouchableOpacity>
              </>
            )}

            {/* Phase : attente USSD */}
            {convertPhase === "waiting" && (
              <View style={styles.waitingContainer}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="refresh-outline" size={48} color={Colors.primary} />
                </Animated.View>
                <Text style={styles.waitingTitle}>En attente de confirmation</Text>
                <Text style={styles.waitingBody}>
                  Confirmez {formatCurrency(DELIVERY_FEE)} sur votre téléphone ({paymentMethod === "orange_money" ? "Orange Money" : "MTN MoMo"}).
                </Text>
                {ussdCode && (
                  <View style={styles.ussdCard}>
                    <Text style={styles.ussdLabel}>Code USSD</Text>
                    <Text style={styles.ussdCode}>{ussdCode}</Text>
                  </View>
                )}
                <Text style={styles.waitingHint}>Ne fermez pas cette fenêtre…</Text>
              </View>
            )}

            {/* Phase : succès */}
            {convertPhase === "success" && (
              <View style={styles.resultContainer}>
                <View style={[styles.resultIconWrap, { backgroundColor: Colors.success + "18" }]}>
                  <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
                </View>
                <Text style={styles.resultTitle}>Livraison confirmée !</Text>
                <Text style={styles.resultBody}>Vos frais ont été payés. Un livreur sera assigné dès que possible.</Text>
                <TouchableOpacity style={[styles.resultBtn, { backgroundColor: Colors.success }]} onPress={closeModal}>
                  <Text style={styles.resultBtnText}>Voir ma commande</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Phase : échec */}
            {convertPhase === "failed" && (
              <View style={styles.resultContainer}>
                <View style={[styles.resultIconWrap, { backgroundColor: Colors.error + "18" }]}>
                  <Ionicons name="close-circle" size={56} color={Colors.error} />
                </View>
                <Text style={styles.resultTitle}>Paiement échoué</Text>
                <Text style={styles.resultBody}>Le paiement n'a pas pu être traité. Vérifiez votre solde et réessayez.</Text>
                <TouchableOpacity style={[styles.resultBtn, { backgroundColor: Colors.primary }]} onPress={() => setConvertPhase("form")}>
                  <Text style={styles.resultBtnText}>Réessayer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelConvertBtn} onPress={closeModal}>
                  <Text style={styles.cancelConvertText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.pageBg },
  headerSafe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, letterSpacing: 1 },

  // Status card
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    margin: 16, backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.sm,
  },
  statusIconWrap: { width: 52, height: 52, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  statusMeta: { fontSize: 11, color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statusValue: { fontSize: 16, fontWeight: "700" },
  typePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
  },
  typeText: { fontSize: 11, fontWeight: "600" },

  // Track button
  trackBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 16, paddingVertical: 14,
    ...Shadow.primary,
  },
  trackBtnText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" },
  livePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.8 },

  // Contact buttons
  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: Colors.primaryLight,
    borderRadius: Radius.full, paddingVertical: 10,
    backgroundColor: Colors.primaryLight,
  },
  contactBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: Colors.text3,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10,
  },

  // QR
  qrCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
    padding: 24, alignItems: "center", gap: 10, ...Shadow.sm,
  },
  qrCode: { fontSize: 12, color: Colors.text3, letterSpacing: 1 },
  qrHint: { fontSize: 12, color: Colors.text2, textAlign: "center" },
  qrSlotPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  qrSlotText: { fontSize: 12, fontWeight: "600", color: Colors.primary },

  // Conversion
  convertBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFF8E1", borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "#FFE082",
    marginBottom: 10,
  },
  convertBannerText: { flex: 1, fontSize: 13, color: "#F59E0B" },
  convertBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 16, paddingVertical: 14, ...Shadow.primary,
  },
  convertBtnText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" },
  convertFeePill: {
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  convertFeeText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Info cards
  infoCard: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 14, gap: 12, ...Shadow.sm },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoIcon: { width: 30, height: 30, borderRadius: Radius.xs, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  infoText: { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 20, paddingTop: 6 },

  // Items
  itemsCard: { backgroundColor: Colors.bg, borderRadius: Radius.lg, overflow: "hidden", ...Shadow.sm },
  itemRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  itemQty: { fontSize: 13, fontWeight: "600", color: Colors.primary, width: 28 },
  itemName: { flex: 1, fontSize: 13, color: Colors.text },
  itemPrice: { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  totalLabel: { fontSize: 14, fontWeight: "700", color: Colors.text },
  totalValue: { fontSize: 16, fontWeight: "800", color: Colors.primary },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "92%", minHeight: 300,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },

  // Fee card
  feeCard: { backgroundColor: Colors.inputBg, borderRadius: Radius.md, padding: 14, marginBottom: 16, gap: 8 },
  feeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  feeLabel: { fontSize: 13, color: Colors.text2 },
  feeAmount: { fontSize: 13, fontWeight: "600", color: Colors.text },
  feeDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 4 },
  feeTotalLabel: { fontSize: 14, fontWeight: "700", color: Colors.text },
  feeTotalValue: { fontSize: 16, fontWeight: "800", color: Colors.primary },

  // Form
  inputLabel: { fontSize: 11, fontWeight: "700", color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, marginTop: 12 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.text, fontSize: 14, marginBottom: 4,
  },
  gpsBtn: {
    width: 46, height: 46, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  operatorRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  operatorBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.md,
    backgroundColor: Colors.inputBg, borderWidth: 1.5, borderColor: Colors.border,
  },
  operatorBtnActive: { borderColor: Colors.primary },
  operatorDot: { width: 10, height: 10, borderRadius: 5 },
  operatorLabel: { fontSize: 12, fontWeight: "600", color: Colors.text3 },
  operatorLabelActive: { color: Colors.text },
  modalHint: { fontSize: 12, color: Colors.text3, lineHeight: 18, marginTop: 12, marginBottom: 16 },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 15, marginTop: 8,
    ...Shadow.primary,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Waiting
  waitingContainer: { alignItems: "center", paddingVertical: 32, gap: 16 },
  waitingTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  waitingBody: { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 22 },
  ussdCard: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg,
    paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", gap: 4,
  },
  ussdLabel: { fontSize: 10, fontWeight: "700", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },
  ussdCode: { fontSize: 20, fontWeight: "700", color: Colors.primary, letterSpacing: 3 },
  waitingHint: { fontSize: 12, color: Colors.text3 },

  // Result
  resultContainer: { alignItems: "center", paddingVertical: 24, gap: 12 },
  resultIconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 20, fontWeight: "700", color: Colors.text },
  resultBody: { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 22, paddingHorizontal: 12 },
  resultBtn: { borderRadius: Radius.full, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  resultBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  cancelConvertBtn: { paddingVertical: 12 },
  cancelConvertText: { fontSize: 14, color: Colors.text3 },
});
