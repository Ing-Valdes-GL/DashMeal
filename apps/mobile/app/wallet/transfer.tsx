import { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "@/lib/api";
import { Colors, Radius, Spacing } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";

export default function TransferScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const amt = parseFloat(amount) || 0;
  const fee = amt > 0 ? Math.max(Math.round(amt * 0.01), 1) : 0;
  const total = amt + fee;

  const handleTransfer = async () => {
    if (!identifier.trim()) { Alert.alert(t("common.error"), "Entrez le numéro de carte ou l'email du destinataire."); return; }
    if (amt < 10) { Alert.alert(t("common.error"), "Montant minimum : 10 FCFA."); return; }

    Alert.alert(
      t("wallet.transfer"),
      `Envoyer ${formatCurrency(amt)} + ${formatCurrency(fee)} de frais = ${formatCurrency(total)} ?`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("wallet.transferBtn"),
          onPress: async () => {
            setLoading(true);
            try {
              await apiPost("/user-wallet/transfer", { identifier: identifier.trim(), amount: amt });
              Alert.alert(t("common.success"), t("wallet.transferSuccess"), [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (err: any) {
              const code = err?.response?.data?.error?.code;
              const msg = code === "RECIPIENT_NOT_FOUND"
                ? "Destinataire introuvable. Vérifiez le numéro de carte ou l'email."
                : code === "INSUFFICIENT_BALANCE"
                ? `Solde insuffisant. Il vous faut ${formatCurrency(total)}.`
                : err?.response?.data?.error?.message ?? t("common.error");
              Alert.alert(t("common.error"), msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("wallet.transferTitle")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t("wallet.transferIdentifier")}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : 12345678 ou nom@email.com"
            placeholderTextColor={Colors.text3}
            autoCapitalize="none"
            keyboardType="email-address"
            value={identifier}
            onChangeText={setIdentifier}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t("wallet.transferAmount")}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : 5000"
            placeholderTextColor={Colors.text3}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        {amt > 0 && (
          <View style={styles.feeCard}>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Montant envoyé</Text>
              <Text style={styles.feeValue}>{formatCurrency(amt)}</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Frais (1%)</Text>
              <Text style={[styles.feeValue, { color: Colors.error }]}>+ {formatCurrency(fee)}</Text>
            </View>
            <View style={styles.feeDivider} />
            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, { fontWeight: "700", color: Colors.text }]}>Total débité</Text>
              <Text style={[styles.feeValue, { fontWeight: "700", color: Colors.primary, fontSize: 15 }]}>{formatCurrency(total)}</Text>
            </View>
          </View>
        )}

        <View style={styles.noteRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.success} />
          <Text style={styles.noteText}>Le destinataire reçoit le montant intégral. Les frais sont à votre charge.</Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, (loading || amt < 10) && styles.confirmBtnDisabled]}
          onPress={handleTransfer}
          disabled={loading || amt < 10}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.confirmBtnText}>{t("wallet.transferBtn")}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: Spacing.md, gap: 16 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  input: { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.text },
  feeCard: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 14, gap: 8 },
  feeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  feeLabel: { fontSize: 14, color: Colors.text2 },
  feeValue: { fontSize: 14, color: Colors.text2 },
  feeDivider: { height: 1, backgroundColor: Colors.divider },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  noteText: { fontSize: 12, color: Colors.text3, flex: 1, lineHeight: 18 },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
