import { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";

type DeliveryStatus = "assigned" | "picked_up" | "on_the_way" | "delivered" | "failed";

interface Delivery {
  id: string;
  status: DeliveryStatus;
  address: string;
  created_at: string;
  orders: {
    id: string;
    total: number;
    notes: string | null;
    users: { name: string; phone: string };
  };
}

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: string }> = {
  assigned:    { label: "Assignée",   color: "#6366f1", bg: "#eef2ff", icon: "time-outline" },
  picked_up:   { label: "Récupérée", color: "#f59e0b", bg: "#fffbeb", icon: "bicycle-outline" },
  on_the_way:  { label: "En route",  color: Colors.primary, bg: Colors.primaryLight, icon: "navigate-outline" },
  delivered:   { label: "Livrée",    color: Colors.success, bg: "#f0fdf4", icon: "checkmark-circle-outline" },
  failed:      { label: "Échouée",   color: Colors.error, bg: "#fef2f2", icon: "close-circle-outline" },
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Toutes" },
  { value: "assigned", label: "Assignées" },
  { value: "picked_up,on_the_way", label: "En cours" },
  { value: "delivered", label: "Livrées" },
];

function formatCFA(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

export default function DriverDeliveriesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["driver-deliveries", filter],
    queryFn: () => apiGet<{ data: Delivery[] }>("/delivery/my-deliveries", filter ? { status: filter } : {}),
    refetchInterval: 30_000,
  });

  const deliveries = data?.data ?? [];
  const active = deliveries.filter((d) => d.status === "assigned" || d.status === "picked_up" || d.status === "on_the_way");

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes livraisons</Text>
        {active.length > 0 && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>{active.length} en cours</Text>
          </View>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : deliveries.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bicycle-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyText}>Aucune livraison</Text>
          <Text style={styles.emptySubText}>Vous n'avez pas encore de livraisons assignées.</Text>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status];
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push({ pathname: "/(driver)/delivery/[id]", params: { id: item.id } })}
                activeOpacity={0.75}
              >
                {/* Status bar */}
                <View style={[styles.statusBar, { backgroundColor: cfg.color }]} />

                <View style={styles.cardBody}>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                  </View>

                  {/* Customer */}
                  <Text style={styles.customerName}>{item.orders?.users?.name ?? "—"}</Text>
                  <Text style={styles.customerPhone}>{item.orders?.users?.phone ?? ""}</Text>

                  {/* Address */}
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.text3} />
                    <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
                  </View>

                  {/* Footer */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.total}>{formatCFA(item.orders?.total ?? 0)}</Text>
                    <View style={styles.arrowWrap}>
                      <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  activeBadgeText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.inputBg,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: "600", color: Colors.text2 },
  filterTextActive: { color: "#fff" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyText: { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySubText: { fontSize: 13, color: Colors.text3, textAlign: "center" },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: Radius.lg,
    flexDirection: "row",
    overflow: "hidden",
    ...Shadow.sm,
  },
  statusBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },

  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  time: { fontSize: 11, color: Colors.text3 },

  customerName: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 2 },
  customerPhone: { fontSize: 12, color: Colors.text3, marginBottom: 8 },

  addressRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  address: { flex: 1, fontSize: 13, color: Colors.text2 },

  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  total: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  arrowWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
});
