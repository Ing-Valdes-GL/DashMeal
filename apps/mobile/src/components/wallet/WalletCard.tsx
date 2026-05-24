import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";

interface WalletCardProps {
  cardNumber: string;
  cardName: string;
  balance: number;
  biometricEnabled: boolean;
  onTopup: () => void;
  onWithdraw: () => void;
  onTransfer: () => void;
  onTransactions: () => void;
}

export function WalletCard({
  cardNumber,
  cardName,
  balance,
  biometricEnabled,
  onTopup,
  onWithdraw,
  onTransfer,
  onTransactions,
}: WalletCardProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const handleReveal = useCallback(async () => {
    if (revealed) { setRevealed(false); return; }
    if (biometricEnabled) {
      setRevealing(true);
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t("wallet.tapBiometric"),
          cancelLabel: t("common.cancel"),
          fallbackLabel: t("wallet.verifyPin"),
        });
        if (result.success) setRevealed(true);
      } catch {
        // silent
      } finally {
        setRevealing(false);
      }
    } else {
      setRevealed(true);
    }
  }, [revealed, biometricEnabled, t]);

  const maskedCard = `**** **** ${cardNumber.slice(-4)}`;

  return (
    <View style={styles.wrapper}>
      {/* Card face */}
      <View style={styles.card}>
        {/* Background decoration */}
        <View style={styles.circle1} />
        <View style={styles.circle2} />

        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardLabel}>{t("wallet.title")}</Text>
            <Text style={styles.cardBrand}>Dash Meal</Text>
          </View>
          <View style={styles.chipWrap}>
            <Ionicons name="card" size={28} color="rgba(255,255,255,0.9)" />
          </View>
        </View>

        <TouchableOpacity style={styles.balanceRow} onPress={handleReveal} activeOpacity={0.8}>
          {revealing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : revealed ? (
            <>
              <Text style={styles.balanceValue}>{formatCurrency(balance)}</Text>
              <Ionicons name="eye-off-outline" size={18} color="rgba(255,255,255,0.7)" style={styles.eyeIcon} />
            </>
          ) : (
            <>
              <Text style={styles.balanceHidden}>•••• ••</Text>
              <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.7)" style={styles.eyeIcon} />
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.balanceLabel}>{t("wallet.balance")}</Text>

        <View style={styles.cardBottom}>
          <View>
            <Text style={styles.cardNumberLabel}>{t("wallet.cardNumber")}</Text>
            <Text style={styles.cardNumberValue}>{maskedCard}</Text>
          </View>
          <View style={styles.cardNameWrap}>
            <Text style={styles.cardNumberLabel}>Titulaire</Text>
            <Text style={styles.cardNumberValue}>{cardName}</Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <ActionBtn icon="add-circle-outline" label={t("wallet.topup")} onPress={onTopup} color={Colors.primary} />
        <ActionBtn icon="arrow-down-circle-outline" label={t("wallet.withdraw")} onPress={onWithdraw} color="#7B61FF" />
        <ActionBtn icon="swap-horizontal-outline" label={t("wallet.transfer")} onPress={onTransfer} color="#FF6B35" />
        <ActionBtn icon="list-outline" label={t("wallet.transactions")} onPress={onTransactions} color={Colors.info} />
      </View>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 16 },

  card: {
    borderRadius: Radius.xl,
    padding: 24,
    backgroundColor: Colors.primary,
    overflow: "hidden",
    ...Shadow.primary,
  },
  circle1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -40,
  },
  circle2: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)", bottom: -20, left: -30,
  },

  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  cardLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", letterSpacing: 1, textTransform: "uppercase" },
  cardBrand: { fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 2 },
  chipWrap: { width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },

  balanceRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  balanceValue: { fontSize: 28, fontWeight: "800", color: "#fff" },
  balanceHidden: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: 4 },
  eyeIcon: { marginLeft: 8, marginTop: 4 },
  balanceLabel: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 24 },

  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cardNameWrap: { alignItems: "flex-end" },
  cardNumberLabel: { fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  cardNumberValue: { fontSize: 13, fontWeight: "700", color: "#fff", letterSpacing: 1 },

  actions: { flexDirection: "row", justifyContent: "space-between" },
  actionBtn: { alignItems: "center", flex: 1, gap: 6 },
  actionIconWrap: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, color: Colors.text2, fontWeight: "600", textAlign: "center" },
});
