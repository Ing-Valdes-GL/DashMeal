import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency, formatTime } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

interface TimeSlot {
  id: string; date: string; start_time: string; end_time: string;
  capacity: number; booked: number;
}

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, getTotal, branch_id, branch_name, clear } = useCartStore();

  const [orderType, setOrderType] = useState<"collect" | "delivery">("collect");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const { data: slots } = useQuery<TimeSlot[]>({
    queryKey: ["slots", branch_id, today],
    queryFn: () => apiGet(`/collect/slots/${branch_id}`, { date: today }),
    enabled: !!branch_id && orderType === "collect",
  });

  const orderMutation = useMutation({
    mutationFn: () => apiPost("/orders", {
      branch_id,
      type: orderType,
      items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      notes: notes || undefined,
      ...(orderType === "collect" && { slot_id: selectedSlot }),
      ...(orderType === "delivery" && { address }),
    }),
    onSuccess: (data: any) => {
      clear();
      router.replace({ pathname: "/order/[id]", params: { id: data.id } });
    },
    onError: (err: any) => {
      Alert.alert("Erreur", err?.response?.data?.error?.message ?? "Impossible de passer la commande");
    },
  });

  const canSubmit =
    items.length > 0 &&
    (orderType === "delivery" ? address.trim().length > 0 : !!selectedSlot);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#050d1a", "#0a0f1e"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Finaliser la commande</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Branch */}
        {branch_name && (
          <View style={styles.branchCard}>
            <Ionicons name="storefront-outline" size={20} color="#f97316" />
            <View style={{ flex: 1 }}>
              <Text style={styles.branchLabel}>Agence</Text>
              <Text style={styles.branchName}>{branch_name}</Text>
            </View>
          </View>
        )}

        {/* Order type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("cart.orderType")}</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeCard, orderType === "collect" && styles.typeCardActive]}
              onPress={() => setOrderType("collect")}
            >
              <Ionicons name="qr-code-outline" size={24} color={orderType === "collect" ? "#f97316" : "#475569"} />
              <Text style={[styles.typeLabel, orderType === "collect" && styles.typeLabelActive]}>
                {t("cart.collect")}
              </Text>
              <Text style={styles.typeSubLabel}>Récupérer en agence</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeCard, orderType === "delivery" && styles.typeCardActive]}
              onPress={() => setOrderType("delivery")}
            >
              <Ionicons name="bicycle-outline" size={24} color={orderType === "delivery" ? "#f97316" : "#475569"} />
              <Text style={[styles.typeLabel, orderType === "delivery" && styles.typeLabelActive]}>
                {t("cart.delivery")}
              </Text>
              <Text style={styles.typeSubLabel}>Livré chez vous</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Time slots (collect) */}
        {orderType === "collect" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("cart.selectSlot")}</Text>
            <View style={styles.slotsGrid}>
              {(slots ?? []).map((slot) => {
                const full = slot.booked >= slot.capacity;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.slotBtn,
                      selectedSlot === slot.id && styles.slotBtnActive,
                      full && styles.slotBtnFull,
                    ]}
                    onPress={() => !full && setSelectedSlot(slot.id)}
                    disabled={full}
                  >
                    <Text style={[styles.slotTime, selectedSlot === slot.id && styles.slotTimeActive, full && styles.slotTimeFull]}>
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </Text>
                    {full && <Text style={styles.slotFull}>Complet</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Address (delivery) */}
        {orderType === "delivery" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("cart.address")}</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="location-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="Ex: Rue des Palmiers, Yaoundé..."
                placeholderTextColor="#334155"
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>
          </View>
        )}

        {/* Notes */}
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

        {/* Order summary */}
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
            <View style={styles.summaryDivider} />
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>{t("cart.total")}</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrency(getTotal())}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.bottomBar}>
        <View style={styles.totalRow}>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomTotal}>{formatCurrency(getTotal())}</Text>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={() => orderMutation.mutate()}
          disabled={!canSubmit || orderMutation.isPending}
        >
          {orderMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitText}>Confirmer la commande</Text>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050d1a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: "#fff" },
  branchCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 20, marginBottom: 4,
    backgroundColor: "rgba(249,115,22,0.08)", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(249,115,22,0.2)",
  },
  branchLabel: { fontSize: 10, color: "#64748b", textTransform: "uppercase" },
  branchName: { fontSize: 15, fontWeight: "600", color: "#fff" },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
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
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
  },
  slotBtnActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.1)" },
  slotBtnFull: { opacity: 0.4 },
  slotTime: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  slotTimeActive: { color: "#f97316" },
  slotTimeFull: { textDecorationLine: "line-through" },
  slotFull: { fontSize: 9, color: "#475569", textAlign: "center", marginTop: 2 },
  inputWrap: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    borderRadius: 12, padding: 14, minHeight: 52,
  },
  input: { flex: 1, color: "#fff", fontSize: 14, lineHeight: 20 },
  summaryCard: { backgroundColor: "#0f172a", borderRadius: 16, borderWidth: 1, borderColor: "#1e293b", padding: 14, gap: 8 },
  summaryItem: { flexDirection: "row", justifyContent: "space-between" },
  summaryItemName: { flex: 1, fontSize: 13, color: "#94a3b8" },
  summaryItemPrice: { fontSize: 13, fontWeight: "600", color: "#fff" },
  summaryDivider: { height: 1, backgroundColor: "#1e293b", marginVertical: 4 },
  summaryTotal: { flexDirection: "row", justifyContent: "space-between" },
  summaryTotalLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  summaryTotalValue: { fontSize: 15, fontWeight: "800", color: "#f97316" },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f172a", borderTopWidth: 1, borderTopColor: "#1e293b",
    padding: 20, paddingBottom: 36, gap: 12,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  bottomLabel: { fontSize: 14, color: "#64748b" },
  bottomTotal: { fontSize: 18, fontWeight: "800", color: "#f97316" },
  submitBtn: {
    backgroundColor: "#f97316", borderRadius: 14, height: 52,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#f97316", shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
