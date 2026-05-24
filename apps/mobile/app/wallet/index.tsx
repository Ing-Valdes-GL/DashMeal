import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { WalletCard } from "@/components/wallet/WalletCard";
import { Colors, Radius, Shadow, Spacing } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";

interface Wallet {
  id: string;
  card_number: string;
  card_name: string;
  balance: number;
  biometric_enabled: boolean;
  is_active: boolean;
}

export default function WalletScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await apiGet("/user-wallet");
      setWallet(res.data ?? null);
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchWallet();
    else setLoading(false);
  }, [isAuthenticated, fetchWallet]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t("wallet.title")} />
        <View style={styles.centerWrap}>
          <Ionicons name="lock-closed-outline" size={56} color={Colors.text3} />
          <Text style={styles.emptyTitle}>{t("profile.authTitle")}</Text>
          <Text style={styles.emptySubtitle}>{t("profile.authSub")}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.primaryBtnText}>{t("profile.loginBtn")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t("wallet.title")} />
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!wallet) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t("wallet.title")} />
        <ScrollView
          contentContainerStyle={styles.activateContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWallet(); }} tintColor={Colors.primary} />}
        >
          <View style={styles.activateCard}>
            <View style={styles.activateIconWrap}>
              <Ionicons name="wallet-outline" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.activateTitle}>{t("wallet.activateTitle")}</Text>
            <Text style={styles.activateSubtitle}>{t("wallet.activateSubtitle")}</Text>

            <View style={styles.benefitsList}>
              {[
                { icon: "flash-outline", text: "Paiement instantané de vos commandes" },
                { icon: "trending-down-outline", text: "1% de réduction pour tout paiement wallet" },
                { icon: "share-outline", text: "Partagez un panier — quelqu'un d'autre paie" },
                { icon: "shield-checkmark-outline", text: "Sécurisé par PIN et biométrie" },
              ].map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <View style={styles.benefitIconWrap}>
                    <Ionicons name={b.icon as any} size={18} color={Colors.primary} />
                  </View>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.activateBtn} onPress={() => router.push("/wallet/activate" as any)}>
              <Text style={styles.activateBtnText}>{t("wallet.activateBtn")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header title={t("wallet.title")} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWallet(); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <WalletCard
          cardNumber={wallet.card_number}
          cardName={wallet.card_name}
          balance={wallet.balance}
          biometricEnabled={wallet.biometric_enabled}
          onTopup={() => router.push("/wallet/topup" as any)}
          onWithdraw={() => router.push("/wallet/withdraw" as any)}
          onTransfer={() => router.push("/wallet/transfer" as any)}
          onTransactions={() => router.push("/wallet/transactions" as any)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },

  scroll: { padding: Spacing.md, gap: 16 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.text, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 20 },

  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  activateContainer: { padding: Spacing.md },
  activateCard: { backgroundColor: Colors.bg, borderRadius: Radius.xl, padding: 24, alignItems: "center", ...Shadow.sm, gap: 12 },
  activateIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  activateTitle: { fontSize: 20, fontWeight: "800", color: Colors.text, textAlign: "center" },
  activateSubtitle: { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  benefitsList: { width: "100%", gap: 10, marginBottom: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  benefitText: { fontSize: 14, color: Colors.text, flex: 1, lineHeight: 20 },
  activateBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center", width: "100%", marginTop: 8 },
  activateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
