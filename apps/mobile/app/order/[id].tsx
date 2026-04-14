import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

interface OrderDetail {
  id: string; total: number; status: string; type: string;
  created_at: string; notes: string | null;
  users: { name: string; phone: string };
  branches: { name: string };
  order_items: { quantity: number; unit_price: number; products: { name_fr: string } }[];
  collect_orders?: { qr_code: string; pickup_status: string; time_slots: { start_time: string; end_time: string; date: string } }[];
  deliveries?: { address: string; status: string; drivers: { name: string; phone: string } | null }[];
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b", confirmed: "#3b82f6", preparing: "#8b5cf6",
  ready: "#22c55e", delivering: "#f97316", delivered: "#22c55e", cancelled: "#ef4444",
};
const STATUS_ICON: Record<string, string> = {
  pending: "time-outline", confirmed: "checkmark-circle-outline", preparing: "restaurant-outline",
  ready: "bag-check-outline", delivering: "bicycle-outline", delivered: "checkmark-done-circle",
  cancelled: "close-circle-outline",
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ["order", id],
    queryFn: () => apiGet(`/orders/${id}`),
  });

  if (isLoading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#f97316" size="large" />
      </View>
    );
  }

  const collect = order.collect_orders?.[0];
  const delivery = order.deliveries?.[0];
  const statusColor = STATUS_COLOR[order.status] ?? "#64748b";

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.headerArea} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t("orders.orderId")}{order.id.slice(0, 8).toUpperCase()}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Status card */}
        <View style={[styles.statusCard, { borderColor: statusColor + "40", backgroundColor: statusColor + "15" }]}>
          <Ionicons name={STATUS_ICON[order.status] as any} size={36} color={statusColor} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Statut actuel</Text>
            <Text style={[styles.statusValue, { color: statusColor }]}>
              {t(`orders.${order.status}` as any)}
            </Text>
          </View>
          <View style={[styles.typePill, order.type === "collect" && styles.typePillCollect]}>
            <Ionicons
              name={order.type === "collect" ? "qr-code-outline" : "bicycle-outline"}
              size={12}
              color={order.type === "collect" ? "#22c55e" : "#f97316"}
            />
            <Text style={[styles.typeText, order.type === "collect" && styles.typeTextCollect]}>
              {order.type === "collect" ? t("orders.collect") : t("orders.delivery")}
            </Text>
          </View>
        </View>

        {/* QR code (collect) */}
        {collect && order.type === "collect" && collect.pickup_status === "waiting" && (
          <View style={styles.qrSection}>
            <Text style={styles.sectionTitle}>{t("orders.qrCode")}</Text>
            <View style={styles.qrCard}>
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={80} color="#f97316" />
                <Text style={styles.qrCode}>{collect.qr_code}</Text>
              </View>
              <Text style={styles.qrHint}>Présentez ce QR code à l'agence</Text>
              {collect.time_slots && (
                <Text style={styles.qrSlot}>
                  Créneau : {formatTime(collect.time_slots.start_time)} – {formatTime(collect.time_slots.end_time)}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Delivery info */}
        {delivery && order.type === "delivery" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Livraison</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color="#f97316" />
                <Text style={styles.infoText}>{delivery.address}</Text>
              </View>
              {delivery.drivers && (
                <View style={styles.infoRow}>
                  <Ionicons name="bicycle-outline" size={16} color="#f97316" />
                  <Text style={styles.infoText}>
                    {delivery.drivers.name} — {delivery.drivers.phone}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Order items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("orders.items")}</Text>
          <View style={styles.itemsCard}>
            {order.order_items.map((item, i) => (
              <View key={i} style={[styles.itemRow, i < order.order_items.length - 1 && styles.itemBorder]}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <Text style={styles.itemName} numberOfLines={1}>{item.products.name_fr}</Text>
                <Text style={styles.itemPrice}>{formatCurrency(item.unit_price * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t("orders.total")}</Text>
              <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="storefront-outline" size={16} color="#64748b" />
              <Text style={styles.infoText}>{order.branches.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color="#64748b" />
              <Text style={styles.infoText}>{formatDateTime(order.created_at)}</Text>
            </View>
            {order.notes && (
              <View style={styles.infoRow}>
                <Ionicons name="document-text-outline" size={16} color="#64748b" />
                <Text style={styles.infoText}>{order.notes}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0f1e" },
  headerArea: { backgroundColor: "#0a0f1e" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700", color: "#fff", fontFamily: "monospace" },
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    margin: 16, borderRadius: 16, padding: 16, borderWidth: 1,
  },
  statusLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  statusValue: { fontSize: 17, fontWeight: "700", marginTop: 2 },
  typePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: "rgba(249,115,22,0.1)", borderWidth: 1, borderColor: "rgba(249,115,22,0.2)",
  },
  typePillCollect: { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)" },
  typeText: { fontSize: 11, fontWeight: "600", color: "#f97316" },
  typeTextCollect: { color: "#22c55e" },
  qrSection: { paddingHorizontal: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "600", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  qrCard: {
    backgroundColor: "#0f172a", borderRadius: 16, borderWidth: 1, borderColor: "#1e293b",
    padding: 20, alignItems: "center", gap: 10,
  },
  qrPlaceholder: { alignItems: "center", gap: 8 },
  qrCode: { fontSize: 12, color: "#64748b", fontFamily: "monospace" },
  qrHint: { fontSize: 12, color: "#475569", textAlign: "center" },
  qrSlot: { fontSize: 13, color: "#f97316", fontWeight: "600" },
  section: { paddingHorizontal: 16, marginBottom: 4, marginTop: 12 },
  itemsCard: { backgroundColor: "#0f172a", borderRadius: 16, borderWidth: 1, borderColor: "#1e293b", overflow: "hidden" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  itemQty: { fontSize: 13, fontWeight: "600", color: "#f97316", width: 24 },
  itemName: { flex: 1, fontSize: 13, color: "#fff" },
  itemPrice: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#1e293b" },
  totalLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  totalValue: { fontSize: 15, fontWeight: "800", color: "#f97316" },
  infoCard: { backgroundColor: "#0f172a", borderRadius: 16, borderWidth: 1, borderColor: "#1e293b", padding: 14, gap: 10 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoText: { flex: 1, fontSize: 13, color: "#94a3b8", lineHeight: 20 },
});
