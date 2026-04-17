import { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/auth";
import { apiGet, apiPost } from "@/lib/api";
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

interface AvailableDelivery {
  id: string;
  address: string;
  created_at: string;
  orders: {
    id: string;
    total: number;
    users: { name: string; phone: string };
    branches: { name: string; address: string };
  };
}

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: string }> = {
  assigned:    { label: "Acceptée",   color: "#6366f1", bg: "#eef2ff", icon: "time-outline" },
  picked_up:   { label: "Récupérée", color: "#f59e0b", bg: "#fffbeb", icon: "bag-check-outline" },
  on_the_way:  { label: "En route",  color: Colors.primary, bg: Colors.primaryLight, icon: "navigate-outline" },
  delivered:   { label: "Livrée",    color: Colors.success, bg: "#f0fdf4", icon: "checkmark-circle-outline" },
  failed:      { label: "Échouée",   color: Colors.error, bg: "#fef2f2", icon: "close-circle-outline" },
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Toutes" },
  { value: "assigned,on_the_way", label: "En cours" },
  { value: "delivered", label: "Livrées" },
];

function formatCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
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

// ─── Carte livraison disponible ───────────────────────────────────────────────

function AvailableCard({ item, onPress }: { item: AvailableDelivery; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.statusBar, { backgroundColor: Colors.success }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.statusPill, { backgroundColor: "#f0fdf4" }]}>
            <View style={[styles.newDot, { backgroundColor: Colors.success }]} />
            <Text style={[styles.statusText, { color: Colors.success }]}>Nouvelle</Text>
          </View>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={styles.branchRow}>
          <Ionicons name="storefront-outline" size={13} color={Colors.text3} />
          <Text style={styles.branchText}>{item.orders?.branches?.name ?? "—"}</Text>
        </View>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={Colors.primary} />
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.total}>{formatCFA(item.orders?.total ?? 0)}</Text>
          <View style={styles.acceptBadge}>
            <Text style={styles.acceptBadgeText}>Accepter</Text>
            <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Carte livraison assignée ─────────────────────────────────────────────────

function MyDeliveryCard({ item, onPress }: { item: Delivery; onPress: () => void }) {
  const cfg = STATUS_CONFIG[item.status];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.statusBar, { backgroundColor: cfg.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.customerName}>{item.orders?.users?.name ?? "—"}</Text>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={Colors.text3} />
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.total}>{formatCFA(item.orders?.total ?? 0)}</Text>
          <View style={styles.arrowWrap}>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

// ─── Écran d'activation ───────────────────────────────────────────────────────

function ActivationScreen({ onActivated }: { onActivated: () => void }) {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: () => apiPost("/delivery/activate"),
    onSuccess: () => {
      // Update auth store to reflect is_active = true
      if (user) setUser({ ...user, is_active: true } as any);
      qc.invalidateQueries({ queryKey: ["driver-profile"] });
      onActivated();
    },
    onError: () => {
      Alert.alert("Erreur", "Impossible d'activer le compte. Réessayez.");
    },
  });

  return (
    <View style={styles.activationWrap}>
      <View style={styles.activationIcon}>
        <Ionicons name="shield-checkmark-outline" size={48} color={Colors.primary} />
      </View>
      <Text style={styles.activationTitle}>Activez votre compte</Text>
      <Text style={styles.activationSubtitle}>
        Votre compte a été créé par votre administrateur.{"\n"}
        Activez-le pour commencer à recevoir des livraisons.
      </Text>
      <TouchableOpacity
        style={[styles.activationBtn, activateMutation.isPending && { opacity: 0.6 }]}
        onPress={() => activateMutation.mutate()}
        disabled={activateMutation.isPending}
      >
        {activateMutation.isPending
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.activationBtnText}>Activer mon compte</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function DriverDeliveriesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [statusFilter, setStatusFilter] = useState("");
  const [justActivated, setJustActivated] = useState(false);

  // Fetch driver profile to check is_active status
  const profileQuery = useQuery({
    queryKey: ["driver-profile"],
    queryFn: () => apiGet<{ data: { is_active: boolean } }>("/delivery/me"),
    staleTime: 0,
  });

  const isActive = justActivated || profileQuery.data?.data?.is_active === true;

  const availableQuery = useQuery({
    queryKey: ["driver-available"],
    queryFn: () => apiGet<{ data: AvailableDelivery[] }>("/delivery/available"),
    refetchInterval: tab === "available" ? 20_000 : false,
    enabled: tab === "available",
  });

  const myQuery = useQuery({
    queryKey: ["driver-deliveries", statusFilter],
    queryFn: () => apiGet<{ data: Delivery[] }>("/delivery/my-deliveries", statusFilter ? { status: statusFilter } : {}),
    refetchInterval: tab === "mine" ? 30_000 : false,
    enabled: tab === "mine",
  });

  const available = availableQuery.data?.data ?? [];
  const mine = myQuery.data?.data ?? [];
  const activeCount = mine.filter((d) => d.status === "assigned" || d.status === "on_the_way").length;

  // Show activation screen if driver is not yet active
  if (!profileQuery.isLoading && !isActive) {
    return <ActivationScreen onActivated={() => setJustActivated(true)} />;
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Livraisons</Text>
        {activeCount > 0 && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>{activeCount} en cours</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "available" && styles.tabActive]}
          onPress={() => setTab("available")}
        >
          <Ionicons
            name="flash-outline"
            size={15}
            color={tab === "available" ? Colors.primary : Colors.text3}
          />
          <Text style={[styles.tabText, tab === "available" && styles.tabTextActive]}>
            Disponibles
          </Text>
          {available.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{available.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === "mine" && styles.tabActive]}
          onPress={() => setTab("mine")}
        >
          <Ionicons
            name="bicycle-outline"
            size={15}
            color={tab === "mine" ? Colors.primary : Colors.text3}
          />
          <Text style={[styles.tabText, tab === "mine" && styles.tabTextActive]}>
            Mes livraisons
          </Text>
        </TouchableOpacity>
      </View>

      {/* Available deliveries tab */}
      {tab === "available" && (
        availableQuery.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : available.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="flash-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyText}>Aucune livraison disponible</Text>
            <Text style={styles.emptySubText}>Les nouvelles commandes apparaîtront ici.</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => availableQuery.refetch()}>
              <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
              <Text style={styles.refreshBtnText}>Actualiser</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={available}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={availableQuery.isFetching}
                onRefresh={() => availableQuery.refetch()}
                tintColor={Colors.primary}
              />
            }
            renderItem={({ item }) => (
              <AvailableCard
                item={item}
                onPress={() => router.push({ pathname: "/(driver)/delivery/[id]", params: { id: item.id, mode: "available" } })}
              />
            )}
          />
        )
      )}

      {/* My deliveries tab */}
      {tab === "mine" && (
        <>
          {/* Status filters */}
          <View style={styles.filters}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
                onPress={() => setStatusFilter(f.value)}
              >
                <Text style={[styles.filterText, statusFilter === f.value && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {myQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : mine.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="bicycle-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyText}>Aucune livraison</Text>
              <Text style={styles.emptySubText}>Acceptez une livraison disponible pour commencer.</Text>
            </View>
          ) : (
            <FlatList
              data={mine}
              keyExtractor={(i) => i.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={myQuery.isFetching}
                  onRefresh={() => myQuery.refetch()}
                  tintColor={Colors.primary}
                />
              }
              renderItem={({ item }) => (
                <MyDeliveryCard
                  item={item}
                  onPress={() => router.push({ pathname: "/(driver)/delivery/[id]", params: { id: item.id, mode: "mine" } })}
                />
              )}
            />
          )}
        </>
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
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  activeBadgeText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: Colors.text3 },
  tabTextActive: { color: Colors.primary },
  tabBadge: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: "center",
  },
  tabBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },

  filters: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#fff",
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.inputBg,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: "600", color: Colors.text2 },
  filterTextActive: { color: "#fff" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyText: { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySubText: { fontSize: 13, color: Colors.text3, textAlign: "center" },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
  },
  refreshBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: Radius.lg,
    flexDirection: "row", overflow: "hidden", ...Shadow.sm,
  },
  statusBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },

  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  newDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  time: { fontSize: 11, color: Colors.text3 },

  branchRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  branchText: { fontSize: 12, color: Colors.text3, fontWeight: "500" },
  customerName: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 6 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
  address: { flex: 1, fontSize: 13, color: Colors.text2 },

  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  total: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  arrowWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  activationWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 40, backgroundColor: Colors.pageBg, gap: 16,
  },
  activationIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8, ...Shadow.primary,
  },
  activationTitle: { fontSize: 22, fontWeight: "800", color: Colors.text, textAlign: "center" },
  activationSubtitle: {
    fontSize: 14, color: Colors.text3, textAlign: "center",
    lineHeight: 22, marginBottom: 8,
  },
  activationBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 16, paddingHorizontal: 32,
    ...Shadow.primary,
  },
  activationBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  acceptBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
  },
  acceptBadgeText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
});
