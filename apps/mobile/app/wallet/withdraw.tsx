import { useState, useMemo } from "react";
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

export default function WithdrawScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConfirm, setPhoneConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const amt = parseFloat(amount) || 0;
  const fee = amt > 0 ? Math.max(Math.round(amt * 0.02), 1) : 0;
  const net = amt - fee;

  const handleWithdraw = async () => {
    if (amt < 100) { Alert.alert(t("common.error"), "Montant minimum : 100 FCFA."); return; }
    if (!phone.trim()) { Alert.alert(t("common.error"), "Entrez le numéro de réception."); return; }
    if (phone.trim() !== phoneConfirm.trim()) { Alert.alert(t("common.error"), t("wallet.withdrawPhoneMismatch")); return; }

    setLoading(true);
    try {
      await apiPost("/user-wallet/withdraw", { amount: amt, phone: phone.trim(), phone_confirm: phoneConfirm.trim() });
      Alert.alert(t("common.success"), `Retrait initié. Vous recevrez ${formatCurrency(net)}.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? t("common.error");
      Alert.alert(t("common.error"), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("wallet.withdrawTitle")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t("wallet.withdrawAmount")}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : 10000"
            placeholderTextColor={Colors.text3}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        {amt > 0 && (
          <View style={styles.feeCard}>
            <FeeRow label={t("wallet.withdrawFee")} value={formatCurrency(fee)} isNegative />
            <View style={styles.feeDivider} />
            <FeeRow label={t("wallet.withdrawNet")} value={formatCurrency(net)} isBold />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t("wallet.withdrawPhone")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("wallet.phonePlaceholder")}
            placeholderTextColor={Colors.text3}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t("wallet.withdrawPhoneConfirm")}</Text>
          <TextInput
            style={[styles.input, phone && phoneConfirm && phone !== phoneConfirm && styles.inputError]}
            placeholder={t("wallet.phonePlaceholder")}
            placeholderTextColor={Colors.text3}
            keyboardType="phone-pad"
            value={phoneConfirm}
            onChangeText={setPhoneConfirm}
          />
          {phone && phoneConfirm && phone !== phoneConfirm && (
            <Text style={styles.errorText}>{t("wallet.withdrawPhoneMismatch")}</Text>
          )}
        </View>

        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.text3} />
          <Text style={styles.noteText}>Les fonds seront envoyés sur votre Mobile Money dans quelques minutes.</Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, (loading || amt < 100) && styles.confirmBtnDisabled]}
          onPress={handleWithdraw}
          disabled={loading || amt < 100}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.confirmBtnText}>{t("wallet.withdrawBtn")}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeeRow({ label, value, isNegative, isBold }: { label: string; value: string; isNegative?: boolean; isBold?: boolean }) {
  return (
    <View style={styles.feeRow}>
      <Text style={[styles.feeLabel, isBold && styles.feeLabelBold]}>{label}</Text>
      <Text style={[styles.feeValue, isNegative && styles.feeValueNeg, isBold && styles.feeValueBold]}>{value}</Text>
    </View>
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
  inputError: { borderColor: Colors.error },
  errorText: { fontSize: 12, color: Colors.error, marginTop: 2 },
  feeCard: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 14, gap: 8 },
  feeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  feeLabel: { fontSize: 14, color: Colors.text2 },
  feeLabelBold: { fontWeight: "700", color: Colors.text },
  feeValue: { fontSize: 14, color: Colors.text2 },
  feeValueNeg: { color: Colors.error },
  feeValueBold: { fontWeight: "700", color: Colors.primary, fontSize: 15 },
  feeDivider: { height: 1, backgroundColor: Colors.divider },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  noteText: { fontSize: 12, color: Colors.text3, flex: 1, lineHeight: 18 },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
