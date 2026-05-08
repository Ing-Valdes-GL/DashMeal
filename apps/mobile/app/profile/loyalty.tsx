/**
 * Points de fidélité — /profile/loyalty
 *
 * Affiche le solde de points, la progression vers le niveau suivant,
 * et l'historique des transactions (gains / remboursements).
 *
 * API: GET /loyalty/me
 *   → { data: { points, total_earned, total_redeemed, transactions: [...] } }
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { apiGet } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TransactionType = "earn" | "redeem" | "bonus" | "expire";

interface LoyaltyTransaction {
  id: string;
  type: TransactionType;
  points: number;
  description: string;
  created_at: string;
}

interface LoyaltyData {
  points: number;
  total_earned: number;
  total_redeemed: number;
  transactions: LoyaltyTransaction[];
}

interface LoyaltyResponse {
  success: boolean;
  data: LoyaltyData;
}

// ─── Levels ───────────────────────────────────────────────────────────────────

const LEVELS = [
  { name: "Bronze", min: 0,    max: 500,  color: "#CD7F32", icon: "ribbon-outline" as const },
  { name: "Silver", min: 500,  max: 2000, color: "#9E9E9E", icon: "medal-outline" as const },
  { name: "Gold",   min: 2000, max: 9999, color: "#FFC107", icon: "trophy-outline" as const },
] as const;

function getCurrentLevel(points: number) {
  return LEVELS.find((l) => points >= l.min && points < l.max) ?? LEVELS[2];
}

function getNextLevel(points: number) {
  const idx = LEVELS.findIndex((l) => points >= l.min && points < l.max);
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

// CFA conversion rate: 1 point = 5 FCFA
const POINT_TO_FCFA = 5;

// ─── Transaction row ──────────────────────────────────────────────────────────

const TransactionRow = React.memo(function TransactionRow({
  item,
}: {
  item: LoyaltyTransaction;
}) {
  const isEarn = item.type === "earn" || item.type === "bonus";
  const sign   = isEarn ? "+" : "-";
  const color  = isEarn ? Colors.success : Colors.error;
  const iconName: React.ComponentProps<typeof Ionicons>["name"] =
    item.type === "earn"   ? "add-circle-outline"
    : item.type === "bonus"  ? "gift-outline"
    : item.type === "expire" ? "time-outline"
    : "remove-circle-outline";

  return (
    <View style={txStyles.row}>
      <View style={[txStyles.iconWrap, { backgroundColor: color + "1A" }]}>
        <Ionicons name={iconName} size={20} color={color} />
      </View>
      <View style={txStyles.info}>
        <Text style={txStyles.desc} numberOfLines={2}>{item.description}</Text>
        <Text style={txStyles.date}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={[txStyles.points, { color }]}>
        {sign}{Math.abs(item.points)} pts
      </Text>
    </View>
  );
});

const txStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  info:   { flex: 1 },
  desc:   { fontSize: 13, fontWeight: "500", color: Colors.text, marginBottom: 2 },
  date:   { fontSize: 11, color: Colors.text3 },
  points: { fontSize: 14, fontWeight: "800", flexShrink: 0 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LoyaltyScreen() {
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery<LoyaltyResponse>({
    queryKey: ["loyalty"],
    queryFn: () => apiGet("/loyalty/me"),
    staleTime: 1000 * 60 * 2,
  });

  const loyalty = data?.data;
  const points  = loyalty?.points ?? 0;

  const currentLevel = getCurrentLevel(points);
  const nextLevel    = getNextLevel(points);

  const progressPct = nextLevel
    ? Math.min(((points - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100, 100)
    : 100;

  const discountFCFA = points * POINT_TO_FCFA;

  const handleRedeem = () => {
    if (!points) return;
    Alert.alert(
      "Utiliser mes points",
      `Vous pouvez utiliser vos ${points} pts (= ${formatCurrency(discountFCFA)} de remise) lors de votre prochain achat.`,
      [
        { text: "Fermer", style: "cancel" },
        { text: "Commander maintenant", onPress: () => router.push("/(tabs)/catalog") },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Points de fidélité</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
      >
        {/* ── Balance card ─────────────────────────────────────────────── */}
        <View style={[styles.balanceCard, { borderColor: currentLevel.color + "40" }]}>
          {/* Level badge */}
          <View style={[styles.levelBadge, { backgroundColor: currentLevel.color + "22" }]}>
            <Ionicons name={currentLevel.icon} size={14} color={currentLevel.color} />
            <Text style={[styles.levelText, { color: currentLevel.color }]}>
              {currentLevel.name}
            </Text>
          </View>

          {/* Points */}
          <Text style={styles.pointsValue}>{points.toLocaleString("fr-FR")}</Text>
          <Text style={styles.pointsLabel}>points</Text>

          {/* FCFA */}
          <View style={styles.fcfaRow}>
            <Ionicons name="pricetag-outline" size={14} color={Colors.text3} />
            <Text style={styles.fcfaText}>
              = {formatCurrency(discountFCFA)} de remise disponible
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>+{loyalty?.total_earned ?? 0}</Text>
              <Text style={styles.statLabel}>Gagnés</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>-{loyalty?.total_redeemed ?? 0}</Text>
              <Text style={styles.statLabel}>Utilisés</Text>
            </View>
          </View>
        </View>

        {/* ── Progress bar ─────────────────────────────────────────────── */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              Niveau actuel : <Text style={{ color: currentLevel.color, fontWeight: "700" }}>{currentLevel.name}</Text>
            </Text>
            {nextLevel && (
              <Text style={styles.progressLabel}>
                Prochain : <Text style={{ color: nextLevel.color, fontWeight: "700" }}>{nextLevel.name}</Text>
              </Text>
            )}
          </View>

          {/* Bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: currentLevel.color }]} />
          </View>

          {nextLevel ? (
            <Text style={styles.progressInfo}>
              {nextLevel.min - points} pts pour atteindre le niveau {nextLevel.name}
            </Text>
          ) : (
            <Text style={[styles.progressInfo, { color: Colors.success }]}>
              Félicitations ! Vous avez atteint le niveau maximum.
            </Text>
          )}

          {/* Level legend */}
          <View style={styles.levelsRow}>
            {LEVELS.map((l) => (
              <View key={l.name} style={styles.levelItem}>
                <Ionicons name={l.icon} size={16} color={l.color} />
                <Text style={[styles.levelItemName, { color: l.color }]}>{l.name}</Text>
                <Text style={styles.levelItemRange}>{l.min}+ pts</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Redeem button ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.redeemBtn, !points && styles.redeemBtnDisabled]}
          onPress={handleRedeem}
          disabled={!points}
          activeOpacity={0.85}
        >
          <Ionicons name="gift-outline" size={18} color={points ? "#fff" : Colors.text3} />
          <Text style={[styles.redeemBtnText, !points && { color: Colors.text3 }]}>
            Utiliser mes points
          </Text>
        </TouchableOpacity>

        {/* ── Transactions ─────────────────────────────────────────────── */}
        <View style={styles.txCard}>
          <View style={styles.txHeader}>
            <Text style={styles.txTitle}>Historique des transactions</Text>
            <Text style={styles.txCount}>{loyalty?.transactions?.length ?? 0}</Text>
          </View>

          {!loyalty?.transactions?.length ? (
            <View style={styles.txEmpty}>
              <Ionicons name="time-outline" size={32} color={Colors.border} />
              <Text style={styles.txEmptyText}>Aucune transaction pour l'instant</Text>
            </View>
          ) : (
            loyalty.transactions.map((tx) => (
              <TransactionRow key={tx.id} item={tx} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:    { padding: 16, paddingBottom: 48 },

  headerSafe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },

  // Balance card
  balanceCard: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    marginBottom: 12,
    ...Shadow.md,
  },
  levelBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16,
  },
  levelText: { fontSize: 12, fontWeight: "700" },
  pointsValue: { fontSize: 56, fontWeight: "900", color: Colors.text, lineHeight: 64 },
  pointsLabel: { fontSize: 16, color: Colors.text3, marginBottom: 8 },
  fcfaRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.inputBg, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 20,
  },
  fcfaText: { fontSize: 13, color: Colors.text2, fontWeight: "500" },
  statsRow: {
    flexDirection: "row", width: "100%", backgroundColor: Colors.inputBg,
    borderRadius: Radius.lg, paddingVertical: 12,
  },
  stat:      { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.text3, marginTop: 2 },
  statDiv:   { width: 1, backgroundColor: Colors.divider },

  // Progress
  progressCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.xl, padding: 18,
    marginBottom: 12, ...Shadow.sm,
  },
  progressHeader: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 12,
  },
  progressLabel: { fontSize: 13, color: Colors.text2 },
  progressTrack: {
    height: 8, backgroundColor: Colors.inputBg, borderRadius: 4, overflow: "hidden", marginBottom: 8,
  },
  progressFill: { height: "100%", borderRadius: 4 },
  progressInfo:  { fontSize: 12, color: Colors.text3, marginBottom: 14 },
  levelsRow: {
    flexDirection: "row", justifyContent: "space-around",
    borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 12,
  },
  levelItem: { alignItems: "center", gap: 3 },
  levelItemName: { fontSize: 12, fontWeight: "700" },
  levelItemRange: { fontSize: 10, color: Colors.text3 },

  // Redeem button
  redeemBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 15, marginBottom: 16, ...Shadow.primary,
  },
  redeemBtnDisabled: {
    backgroundColor: Colors.inputBg,
    shadowOpacity: 0,
    elevation: 0,
  },
  redeemBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  // Transactions
  txCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.xl, overflow: "hidden", ...Shadow.sm,
  },
  txHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  txTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },
  txCount: {
    fontSize: 12, fontWeight: "700", color: Colors.primary,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  txEmpty: {
    alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 32,
  },
  txEmptyText: { fontSize: 13, color: Colors.text3 },
});
