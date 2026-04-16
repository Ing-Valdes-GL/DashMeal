import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Colors, Radius, Shadow } from "@/lib/theme";

interface Order {
  id: string; total: number; status: string; type: string;
  created_at: string; rating: number | null;
  branches: { name: string };
}

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

const ONGOING   = ["pending", "confirmed", "preparing", "ready", "delivering"];
const COMPLETED = ["delivered", "cancelled"];

export default function OrdersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"ongoing" | "history">("ongoing");

  // ── Rating modal ────────────────────────────────────────────────────────
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingDone, setRatingDone] = useState(false);

  const ratingMutation = useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment?: string }) =>
      apiPost(`/orders/${id}/rate`, { rating, comment }),
    onSuccess: () => {
      setRatingDone(true);
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      setTimeout(() => {
        setRatingOrderId(null);
        setRatingDone(false);
        setStars(0);
        setComment("");
      }, 1400);
    },
    onError: () => Alert.alert("Erreur", "Impossible d'enregistrer votre note."),
  });

  const closeRatingModal = () => {
    setRatingOrderId(null);
    setStars(0);
    setComment("");
    setRatingDone(false);
  };

  const { data: resp, isLoading, refetch, isRefetching } = useQuery<{ success: boolean; data: Order[] }>({
    queryKey: ["my-orders"],
    queryFn: () => apiGet("/orders/my-orders"),
    staleTime: 0,
  });

  const all = resp?.data ?? [];
  const orders = tab === "ongoing"
    ? all.filter((o) => ONGOING.includes(o.status))
    : all.filter((o) => COMPLETED.includes(o.status));

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes commandes</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(["ongoing", "history"] as const).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                {key === "ongoing" ? "En cours" : "Historique"}
              </Text>
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
            <View style={styles.card}>
              {/* Top row */}
              <View style={styles.cardTop}>
                {/* Icon */}
                <View style={styles.orderIcon}>
                  <Ionicons
                    name={item.type === "collect" ? "qr-code-outline" : "bicycle-outline"}
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + "18" }]}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
                      <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.branchName}>{item.branches?.name}</Text>
                  <Text style={styles.dateText}>{formatDateTime(item.created_at)}</Text>
                </View>
              </View>

              {/* Separator */}
              <View style={styles.sep} />

              {/* Bottom row */}
              <View style={styles.cardBottom}>
                <Text style={styles.totalText}>{formatCurrency(item.total)}</Text>
                <View style={styles.actions}>
                  {COMPLETED.includes(item.status) ? (
                    <>
                      {item.status === "delivered" && (
                        <TouchableOpacity
                          style={item.rating ? styles.btnRated : styles.btnPrimary}
                          onPress={() => { if (!item.rating) { setRatingOrderId(item.id); setStars(item.rating ?? 0); } }}
                        >
                          {item.rating ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Ionicons name="star" size={12} color="#FFC107" />
                              <Text style={styles.btnRatedText}>{item.rating}/5</Text>
                            </View>
                          ) : (
                            <Text style={styles.btnPrimaryText}>Noter</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.btnSecondary}
                        onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
                      >
                        <Text style={styles.btnSecondaryText}>Voir détail</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.btnSecondary}
                        onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
                      >
                        <Text style={styles.btnSecondaryText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnPrimary}
                        onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
                      >
                        <Text style={styles.btnPrimaryText}>Suivre</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Contact row — visible for all non-cancelled orders */}
              {item.status !== "cancelled" && (
                <>
                  <View style={styles.sep} />
                  <View style={styles.contactRow}>
                    {item.type === "delivery" && (
                      <TouchableOpacity
                        style={styles.contactBtn}
                        onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, type: "driver" } })}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="bicycle-outline" size={14} color={Colors.primary} />
                        <Text style={styles.contactBtnText}>Livreur</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.contactBtn}
                      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, type: "support" } })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="storefront-outline" size={14} color={Colors.primary} />
                      <Text style={styles.contactBtnText}>Contacter l'agence</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>
                {tab === "ongoing" ? "Aucune commande en cours" : "Aucun historique"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tab === "ongoing" ? "Passez votre première commande !" : "Vos commandes passées apparaîtront ici"}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Rating modal ──────────────────────────────────────────────────── */}
      <Modal visible={!!ratingOrderId} transparent animationType="fade" onRequestClose={closeRatingModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.ratingCard}>
            {ratingDone ? (
              <View style={styles.ratingDone}>
                <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
                <Text style={styles.ratingDoneText}>Merci pour votre avis !</Text>
              </View>
            ) : (
              <>
                <View style={styles.ratingHeader}>
                  <View style={styles.ratingIconWrap}>
                    <Ionicons name="star" size={26} color={Colors.primary} />
                  </View>
                  <TouchableOpacity style={styles.ratingCloseBtn} onPress={closeRatingModal}>
                    <Ionicons name="close" size={20} color={Colors.text3} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.ratingTitle}>Comment était votre commande ?</Text>
                <Text style={styles.ratingSubtitle}>Votre avis nous aide à améliorer notre service</Text>
                <View style={styles.starsRow}>
                  {[1,2,3,4,5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setStars(s)} style={{ padding: 4 }}>
                      <Ionicons name={s <= stars ? "star" : "star-outline"} size={34} color={s <= stars ? "#FFC107" : Colors.border} />
                    </TouchableOpacity>
                  ))}
                </View>
                {stars > 0 && (
                  <Text style={styles.starLabel}>
                    {["","Très mauvais","Mauvais","Correct","Bon","Excellent !"][stars]}
                  </Text>
                )}
                <TextInput
                  style={styles.commentInput}
                  placeholder="Laissez un commentaire (optionnel)"
                  placeholderTextColor={Colors.text3}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={500}
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, (stars === 0 || ratingMutation.isPending) && styles.submitBtnDisabled]}
                  onPress={() => ratingOrderId && ratingMutation.mutate({ id: ratingOrderId, rating: stars, comment: comment.trim() || undefined })}
                  disabled={stars === 0 || ratingMutation.isPending}
                >
                  {ratingMutation.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.submitBtnText}>Envoyer mon avis</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.bg,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  // Tabs
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive:     { borderBottomColor: Colors.primary },
  tabText:       { fontSize: 14, fontWeight: "600", color: Colors.text3 },
  tabTextActive: { color: Colors.primary },
  // List
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginBottom: 12, padding: 16, ...Shadow.sm,
  },
  cardTop: { flexDirection: "row", gap: 12, marginBottom: 12 },
  orderIcon: {
    width: 46, height: 46, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  orderId: { fontSize: 14, fontWeight: "700", color: Colors.text },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  branchName: { fontSize: 13, color: Colors.text2 },
  dateText:   { fontSize: 11, color: Colors.text3, marginTop: 2 },
  sep: { height: 1, backgroundColor: Colors.divider, marginVertical: 10 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalText:  { fontSize: 16, fontWeight: "800", color: Colors.primary },
  actions:    { flexDirection: "row", gap: 8 },
  btnSecondary: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  btnSecondaryText: { fontSize: 12, fontWeight: "600", color: Colors.text2 },
  btnPrimary: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  btnPrimaryText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  // Rated button
  btnRated: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#FFC107", borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#FFFDE7",
  },
  btnRatedText: { fontSize: 12, fontWeight: "700", color: "#F59E0B" },

  // Rating modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  ratingCard: { backgroundColor: Colors.bg, borderRadius: 24, padding: 24, width: "100%", ...Shadow.sm },
  ratingDone: { alignItems: "center", paddingVertical: 24, gap: 12 },
  ratingDoneText: { fontSize: 18, fontWeight: "700", color: Colors.text },
  ratingHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  ratingIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  ratingCloseBtn: { marginLeft: "auto", width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  ratingTitle: { fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  ratingSubtitle: { fontSize: 13, color: Colors.text3, marginBottom: 18 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 4, marginBottom: 8 },
  starLabel: { textAlign: "center", fontSize: 13, fontWeight: "700", color: "#FFC107", marginBottom: 14 },
  commentInput: { backgroundColor: Colors.inputBg, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text, minHeight: 72, textAlignVertical: "top", marginBottom: 14 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 14, alignItems: "center" },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Contact
  contactRow: { flexDirection: "row", gap: 8 },
  contactBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: Colors.primaryLight,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.primaryLight,
  },
  contactBtnText: { fontSize: 11, fontWeight: "600", color: Colors.primary },
  // Empty
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle:    { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.text3, textAlign: "center" },
});
