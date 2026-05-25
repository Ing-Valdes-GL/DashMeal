import { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "@/lib/api";
import { Colors, Radius, Shadow, Spacing } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  fee_amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  related_user_name: string | null;
  status: string;
  created_at: string;
}

const TX_ICONS: Record<string, { name: string; color: string }> = {
  activation:   { name: "rocket-outline",           color: "#7B61FF" },
  topup:        { name: "add-circle-outline",        color: Colors.primary },
  payment:      { name: "cart-outline",              color: "#FF6B35" },
  withdrawal:   { name: "arrow-down-circle-outline", color: "#F44336" },
  transfer_in:  { name: "arrow-down-outline",        color: Colors.primary },
  transfer_out: { name: "arrow-up-outline",          color: "#FF6B35" },
  refund:       { name: "refresh-circle-outline",    color: Colors.info },
};

const TX_AMOUNT_SIGN: Record<string, "+" | "-"> = {
  activation: "+", topup: "+", transfer_in: "+", refund: "+",
  payment: "-", withdrawal: "-", transfer_out: "-",
};

export default function TransactionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTransactions = useCallback(async (p = 1, replace = true) => {
    try {
      const res = await apiGet(`/user-wallet/transactions?page=${p}&limit=20`);
      const txs: Transaction[] = res.data?.transactions ?? [];
      const total = res.data?.pagination?.total_pages ?? 1;
      if (replace) setTransactions(txs);
      else setTransactions((prev) => [...prev, ...txs]);
      setHasMore(p < total);
      setPage(p);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useState(() => { fetchTransactions(); });

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    fetchTransactions(page + 1, false);
  };

  const txLabel = (tx: Transaction) => {
    if (tx.type === "transfer_in" && tx.related_user_name) return `${t("wallet.txTransferIn")} ${tx.related_user_name}`;
    if (tx.type === "transfer_out" && tx.related_user_name) return `${t("wallet.txTransferOut")} ${tx.related_user_name}`;
    return tx.description;
  };

  const renderItem = ({ item: tx }: { item: Transaction }) => {
    const icon = TX_ICONS[tx.type] ?? { name: "swap-horizontal-outline", color: Colors.text2 };
    const sign = TX_AMOUNT_SIGN[tx.type] ?? "+";
    const isPositive = sign === "+";

    return (
      <View style={styles.txItem}>
        <View style={[styles.txIconWrap, { backgroundColor: icon.color + "18" }]}>
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txLabel} numberOfLines={1}>{txLabel(tx)}</Text>
          <Text style={styles.txDate}>
            {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </Text>
          {tx.fee_amount > 0 && (
            <Text style={styles.txFee}>{t("wallet.fee")} : {formatCurrency(tx.fee_amount)}</Text>
          )}
        </View>
        <Text style={[styles.txAmount, isPositive ? styles.txAmountPos : styles.txAmountNeg]}>
          {sign}{formatCurrency(tx.amount)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("wallet.transactionsTitle")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTransactions(1, true); }} tintColor={Colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={48} color={Colors.text3} />
              <Text style={styles.emptyText}>{t("wallet.noTransactions")}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} /> : null}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: Spacing.md },
  txItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 14, ...Shadow.sm },
  txIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1, gap: 2 },
  txLabel: { fontSize: 14, fontWeight: "600", color: Colors.text },
  txDate: { fontSize: 12, color: Colors.text3 },
  txFee: { fontSize: 11, color: Colors.text3 },
  txAmount: { fontSize: 15, fontWeight: "700" },
  txAmountPos: { color: Colors.success },
  txAmountNeg: { color: Colors.error },
  separator: { height: 8 },
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.text3, fontWeight: "500" },
});
