import { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost } from "@/lib/api";
import { Colors, Radius, Spacing } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";

type PaymentMethod = "mtn_momo" | "orange_money";

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

export default function TopUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("mtn_momo");
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 100) { Alert.alert(t("common.error"), t("wallet.topupMin")); return; }
    if (!phone.trim()) { Alert.alert(t("common.error"), "Entrez votre numéro Mobile Money."); return; }

    setLoading(true);
    try {
      await apiPost("/user-wallet/topup", { amount: amt, phone: phone.trim(), payment_method: method });
      Alert.alert(t("common.success"), "Rechargement initié. Vérifiez votre téléphone pour confirmer.", [
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
        <Text style={styles.headerTitle}>{t("wallet.topupTitle")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Quick amounts */}
        <Text style={styles.sectionLabel}>Montant rapide</Text>
        <View style={styles.quickAmounts}>
          {QUICK_AMOUNTS.map((q) => (
            <TouchableOpacity
              key={q}
              style={[styles.quickBtn, amount === String(q) && styles.quickBtnActive]}
              onPress={() => setAmount(String(q))}
            >
              <Text style={[styles.quickText, amount === String(q) && styles.quickTextActive]}>
                {formatCurrency(q)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom amount */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t("wallet.topupAmount")}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : 5000"
            placeholderTextColor={Colors.text3}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        {/* Payment method */}
        <Text style={styles.sectionLabel}>{t("wallet.paymentMethod")}</Text>
        <View style={styles.methodRow}>
          {(["mtn_momo", "orange_money"] as PaymentMethod[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.methodBtn, method === m && styles.methodBtnActive]}
              onPress={() => setMethod(m)}
            >
              <Ionicons
                name={m === "mtn_momo" ? "phone-portrait-outline" : "phone-landscape-outline"}
                size={20}
                color={method === m ? "#fff" : Colors.text2}
              />
              <Text style={[styles.methodLabel, method === m && styles.methodLabelActive]}>
                {m === "mtn_momo" ? t("wallet.mtn") : t("wallet.orange")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t("wallet.topupPhone")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("wallet.phonePlaceholder")}
            placeholderTextColor={Colors.text3}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {/* Fee note */}
        <View style={styles.noteRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
          <Text style={styles.noteText}>{t("wallet.topupFee")}</Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
          onPress={handleTopUp}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.confirmBtnText}>{t("wallet.topupBtn")}</Text>
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
  sectionLabel: { fontSize: 13, fontWeight: "700", color: Colors.text2, textTransform: "uppercase", letterSpacing: 0.5 },
  quickAmounts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  quickBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  quickText: { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  quickTextActive: { color: Colors.primary },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  input: { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.text },
  methodRow: { flexDirection: "row", gap: 10 },
  methodBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  methodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodLabel: { fontSize: 14, fontWeight: "600", color: Colors.text2 },
  methodLabelActive: { color: "#fff" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  noteText: { fontSize: 12, color: Colors.text2, flex: 1 },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
