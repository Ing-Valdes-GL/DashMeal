import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

interface Order {
  id: string; total: number; status: string; type: string;
  created_at: string;
  branches: { name: string };
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  preparing: "#8b5cf6",
  ready: "#22c55e",
  delivering: "#f97316",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

export default function OrdersScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery<{ data: Order[]; pagination: any }>({
    queryKey: ["my-orders"],
    queryFn: () => apiGet("/orders/my", { limit: 50 }) as any,
  });

  const orders = data?.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("orders.title")}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#f97316" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#f97316" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
            >
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.orderId}>{t("orders.orderId")}{item.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.branch}>{item.branches?.name}</Text>
                </View>
                <View style={[styles.typeBadge, item.type === "collect" && styles.typeBadgeCollect]}>
                  <Ionicons
                    name={item.type === "collect" ? "qr-code-outline" : "bicycle-outline"}
                    size={12} color={item.type === "collect" ? "#22c55e" : "#f97316"}
                  />
                  <Text style={[styles.typeText, item.type === "collect" && styles.typeTextCollect]}>
                    {item.type === "collect" ? t("orders.collect") : t("orders.delivery")}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.statusRow}>
                  <View style={[styles.dot, { backgroundColor: STATUS_COLOR[item.status] ?? "#64748b" }]} />
                  <Text style={[styles.status, { color: STATUS_COLOR[item.status] ?? "#64748b" }]}>
                    {t(`orders.${item.status}` as any)}
                  </Text>
                </View>
                <View style={styles.rightInfo}>
                  <Text style={styles.total}>{formatCurrency(item.total)}</Text>
                  <Text style={styles.date}>{formatDateTime(item.created_at)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#1e293b" />
              <Text style={styles.emptyTitle}>{t("orders.empty")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 80 },
  card: {
    backgroundColor: "#0f172a", borderRadius: 16,
    borderWidth: 1, borderColor: "#1e293b",
    padding: 14, marginBottom: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  orderId: { fontSize: 14, fontWeight: "700", color: "#fff", fontFamily: "monospace" },
  branch: { fontSize: 12, color: "#475569", marginTop: 2 },
  typeBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(249,115,22,0.1)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(249,115,22,0.2)",
  },
  typeBadgeCollect: {
    backgroundColor: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.2)",
  },
  typeText: { fontSize: 11, fontWeight: "600", color: "#f97316" },
  typeTextCollect: { color: "#22c55e" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontSize: 13, fontWeight: "600" },
  rightInfo: { alignItems: "flex-end", gap: 2 },
  total: { fontSize: 15, fontWeight: "700", color: "#f97316" },
  date: { fontSize: 11, color: "#334155" },
  empty: { alignItems: "center", paddingTop: 80, gap: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#334155" },
});
