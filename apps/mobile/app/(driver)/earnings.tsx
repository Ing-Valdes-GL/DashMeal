import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { apiGet } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EarningsData {
  total: number;
  count: number;
  period: string;
  by_day: { date: string; amount: number }[];
}

// ─── Filtres période ──────────────────────────────────────────────────────────

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week",  label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
] as const;

type Period = typeof PERIODS[number]["value"];

// ─── Barre de progression relative ───────────────────────────────────────────

function DayBar({ date, amount, max }: { date: string; amount: number; max: number }) {
  const pct = max > 0 ? amount / max : 0;
  const label = new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(pct * 100, 2)}%` as any }]} />
      </View>
      <Text style={styles.barAmount}>{formatCurrency(amount)}</Text>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function DriverEarningsScreen() {
  const [period, setPeriod] = useState<Period>("week");

  const { data, isLoading, isRefetching, refetch } = useQuery<{ data: EarningsData }>({
    queryKey: ["driver-earnings", period],
    queryFn: () => apiGet("/driver/earnings", { period }),
    staleTime: 60_000,
  });

  const earnings = data?.data;
  const byDay = earnings?.by_day ?? [];
  const maxAmount = byDay.length > 0 ? Math.max(...byDay.map((d) => d.amount)) : 0;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes gains</Text>
      </View>

      {/* Filtres période */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodChip, period === p.value && styles.periodChipActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.periodText, period === p.value && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Carte total */}
          <View style={styles.totalCard}>
            <View style={styles.totalIconWrap}>
              <Ionicons name="wallet-outline" size={28} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.totalLabel}>Total gagné</Text>
              <Text style={styles.totalAmount}>{formatCurrency(earnings?.total ?? 0)}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{earnings?.count ?? 0} livraison{(earnings?.count ?? 0) > 1 ? "s" : ""}</Text>
            </View>
          </View>

          {/* Graphique par jour */}
          {byDay.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Détail par jour</Text>
              <View style={styles.chart}>
                {byDay.map((d) => (
                  <DayBar key={d.date} date={d.date} amount={d.amount} max={maxAmount} />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucun gain</Text>
              <Text style={styles.emptySub}>Complétez des livraisons pour voir vos gains ici.</Text>
            </View>
          )}

          {/* Infos */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.text3} />
            <Text style={styles.infoText}>
              Les gains sont calculés après confirmation de livraison. Les retraits sont disponibles depuis votre portefeuille.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text },

  periodRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  periodChip: {
    flex: 1, alignItems: "center",
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.inputBg,
  },
  periodChipActive: { backgroundColor: Colors.primary },
  periodText: { fontSize: 12, fontWeight: "600", color: Colors.text2 },
  periodTextActive: { color: "#fff" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  content: { padding: 16, gap: 16 },

  totalCard: {
    backgroundColor: "#fff",
    borderRadius: Radius.lg,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    ...Shadow.sm,
  },
  totalIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  totalLabel: { fontSize: 13, color: Colors.text3, fontWeight: "500", marginBottom: 2 },
  totalAmount: { fontSize: 24, fontWeight: "800", color: Colors.text },
  countBadge: {
    marginLeft: "auto",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
  },
  countText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  section: {
    backgroundColor: "#fff",
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.sm,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 14 },

  chart: { gap: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { fontSize: 11, color: Colors.text3, width: 54, fontWeight: "500" },
  barTrack: {
    flex: 1, height: 10, backgroundColor: Colors.inputBg, borderRadius: 5, overflow: "hidden",
  },
  barFill: {
    height: "100%", backgroundColor: Colors.primary, borderRadius: 5,
  },
  barAmount: { fontSize: 11, fontWeight: "700", color: Colors.text, width: 72, textAlign: "right" },

  empty: {
    alignItems: "center", justifyContent: "center",
    gap: 10, padding: 40,
    backgroundColor: "#fff", borderRadius: Radius.lg, ...Shadow.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.text3, textAlign: "center" },

  infoBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    padding: 14, backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.text2, lineHeight: 18 },
});
