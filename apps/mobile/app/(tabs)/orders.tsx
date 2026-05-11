import { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/stores/auth";
import { Colors, Radius, Shadow } from "@/lib/theme";

interface Order {
  id: string; total: number; status: string; type: string;
  created_at: string; rating: number | null;
  branches: { name: string };
}

type OrderTab = "pending" | "transit" | "delivered" | "collect";

const TABS: { key: OrderTab; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "pending",   label: "En attente", icon: "time-outline" },
  { key: "transit",   label: "En transit", icon: "bicycle-outline" },
  { key: "delivered", label: "Livrée",     icon: "checkmark-circle-outline" },
  { key: "collect",   label: "Click & Collect", icon: "qr-code-outline" },
];

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

function getOrderTab(order: Order): OrderTab {
  if (order.type === "collect") return "collect";
  if (["pending", "confirmed"].includes(order.status)) return "pending";
  if (["preparing", "ready", "delivering"].includes(order.status)) return "transit";
  return "delivered";
}

function OrderCard({ order, onPress, onChat }: { order: Order; onPress: () => void; onChat?: () => void }) {
  const statusColor = STATUS_COLOR[order.status] ?? Colors.text3;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Header */}
      <View style={styles.cardTop}>
        <View style={styles.orderIconWrap}>
          <Ionicons
            name={order.type === "collect" ? "qr-code-outline" : "bicycle-outline"}
            size={20} color={Colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABEL[order.status] ?? order.status}
              </Text>
            </View>
          </View>
          <Text style={styles.branchName}>{order.branches?.name}</Text>
          <Text style={styles.dateText}>{formatDateTime(order.created_at)}</Text>
        </View>
      </View>

      <View style={styles.sep} />

      {/* Footer */}
      <View style={styles.cardBottom}>
        <Text style={styles.totalText}>{formatCurrency(order.total)}</Text>
        <View style={styles.actions}>
          {order.status === "delivered" && !order.rating && (
            <TouchableOpacity style={styles.btnPrimary} onPress={onPress}>
              <Ionicons name="star-outline" size={13} color="#fff" />
              <Text style={styles.btnPrimaryText}>Noter</Text>
            </TouchableOpacity>
          )}
          {["pending", "confirmed", "preparing", "delivering"].includes(order.status) && (
            <TouchableOpacity style={styles.btnSecondary} onPress={onPress}>
              <Ionicons name="navigate-outline" size={13} color={Colors.primary} />
              <Text style={styles.btnSecondaryText}>Suivre</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnOutline} onPress={onPress}>
            <Text style={styles.btnOutlineText}>Détail</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact row */}
      {order.status !== "cancelled" && order.status !== "delivered" && (
        <>
          <View style={styles.sep} />
          <View style={styles.contactRow}>
            {order.type === "delivery" && (
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => onChat?.()}
              >
                <Ionicons name="bicycle-outline" size={13} color={Colors.primary} />
                <Text style={styles.contactBtnText}>Livreur</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.contactBtn} onPress={() => onChat?.()}>
              <Ionicons name="chatbubble-outline" size={13} color={Colors.primary} />
              <Text style={styles.contactBtnText}>Agence</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<OrderTab>("pending");

  const { data: resp, isLoading, refetch, isRefetching } = useQuery<{ success: boolean; data: Order[] }>({
    queryKey: ["my-orders"],
    queryFn: () => apiGet("/orders/my-orders"),
    staleTime: 0,
    enabled: isAuthenticated,
  });

  const all    = resp?.data ?? [];
  const orders = all.filter((o) => getOrderTab(o) === activeTab);
  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = all.filter((o) => getOrderTab(o) === t.key).length;
    return acc;
  }, {} as Record<OrderTab, number>);

  // Guest / unauthenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mes commandes</Text>
          </View>
        </SafeAreaView>
        <View style={styles.authWall}>
          <View style={styles.authIconWrap}>
            <Ionicons name="receipt-outline" size={52} color={Colors.border} />
          </View>
          <Text style={styles.authTitle}>Connectez-vous pour voir vos commandes</Text>
          <Text style={styles.authSubtitle}>
            Suivez vos commandes en temps réel et consultez votre historique
          </Text>
          <TouchableOpacity style={styles.authBtn} onPress={() => router.push("/(auth)/welcome")}>
            <Text style={styles.authBtnText}>Se connecter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.authBtnSecondary} onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.authBtnSecondaryText}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mes commandes</Text>
          <TouchableOpacity>
            <Ionicons name="filter-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* 4-tab bar */}
        <View style={styles.tabsContainer}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={activeTab === t.key ? Colors.primary : Colors.text3}
              />
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
              {counts[t.key] > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{counts[t.key]}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
              onChat={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={TABS.find((t) => t.key === activeTab)?.icon ?? "receipt-outline"}
                size={52} color={Colors.border}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === "pending"   ? "Aucune commande en attente"
                : activeTab === "transit"  ? "Aucune commande en transit"
                : activeTab === "delivered"? "Aucune commande livrée"
                : "Aucun retrait prévu"}
              </Text>
              <Text style={styles.emptySubtitle}>Vos commandes apparaîtront ici</Text>
              <TouchableOpacity style={styles.shopBtn} onPress={() => router.push("/(tabs)")}>
                <Text style={styles.shopBtnText}>Parcourir les boutiques</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe:      { backgroundColor: Colors.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },

  // 4-tab
  tabsContainer: {
    flexDirection: "row", backgroundColor: Colors.bg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1, alignItems: "center", paddingVertical: 10, gap: 3,
    borderBottomWidth: 2.5, borderBottomColor: "transparent",
  },
  tabActive:     { borderBottomColor: Colors.primary },
  tabText:       { fontSize: 9, fontWeight: "600", color: Colors.text3, textAlign: "center" },
  tabTextActive: { color: Colors.primary },
  badge: {
    backgroundColor: Colors.primary, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },

  // Cards
  list: { padding: 16, paddingBottom: 90 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, marginBottom: 12, padding: 14, ...Shadow.sm },

  cardTop:    { flexDirection: "row", gap: 12, marginBottom: 12 },
  orderIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  cardTitleRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  orderId:       { fontSize: 14, fontWeight: "700", color: Colors.text },
  statusBadge:   { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot:     { width: 5, height: 5, borderRadius: 3 },
  statusText:    { fontSize: 10, fontWeight: "700" },
  branchName:    { fontSize: 13, color: Colors.text2 },
  dateText:      { fontSize: 11, color: Colors.text3, marginTop: 2 },

  sep: { height: 1, backgroundColor: Colors.divider, marginVertical: 10 },

  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalText:  { fontSize: 16, fontWeight: "800", color: Colors.primary },
  actions:    { flexDirection: "row", gap: 8 },

  btnPrimary: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  btnPrimaryText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  btnSecondary: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.primaryLight,
  },
  btnSecondaryText: { fontSize: 12, fontWeight: "600", color: Colors.primary },

  btnOutline: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  btnOutlineText: { fontSize: 12, fontWeight: "600", color: Colors.text2 },

  contactRow: { flexDirection: "row", gap: 8 },
  contactBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: Colors.primaryLight,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.primaryLight,
  },
  contactBtnText: { fontSize: 11, fontWeight: "600", color: Colors.primary },

  // Empty
  empty: { alignItems: "center", paddingTop: 56, gap: 10 },
  emptyTitle:    { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.text3 },
  shopBtn: {
    marginTop: 8, backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  shopBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Auth wall
  authWall: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  authIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.inputBg,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  authTitle:    { fontSize: 18, fontWeight: "800", color: Colors.text, textAlign: "center", marginBottom: 8 },
  authSubtitle: { fontSize: 14, color: Colors.text3, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  authBtn: {
    width: "100%", height: 50, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  authBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  authBtnSecondary: {
    width: "100%", height: 50, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  authBtnSecondaryText: { color: Colors.text2, fontWeight: "600", fontSize: 15 },
});
