import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost } from "@/lib/api";
import { Colors, Radius, Shadow, Spacing } from "@/lib/theme";

type Step = "card" | "pin" | "payment";
type PaymentMethod = "mtn_momo" | "orange_money";

export default function ActivateWalletScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState<Step>("card");
  const [cardNumbers, setCardNumbers] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [loadingCards, setLoadingCards] = useState(false);

  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mtn_momo");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCardNumbers = useCallback(async () => {
    setLoadingCards(true);
    try {
      const res = await apiGet("/user-wallet/card-numbers");
      setCardNumbers(res.data ?? []);
    } catch {
      Alert.alert(t("common.error"), t("common.retry"));
    } finally {
      setLoadingCards(false);
    }
  }, [t]);

  // Fetch on mount
  useState(() => { fetchCardNumbers(); });

  const handleNextFromCard = () => {
    if (!selectedCard) { Alert.alert(t("common.error"), t("wallet.pickCardNumber")); return; }
    setStep("pin");
  };

  const handleNextFromPin = () => {
    if (pin.length < 5) { Alert.alert(t("common.error"), t("wallet.pinTooShort")); return; }
    if (pin !== pinConfirm) { Alert.alert(t("common.error"), t("wallet.pinMismatch")); return; }
    setStep("payment");
  };

  const handleActivate = async () => {
    const amount = parseFloat(initialAmount);
    if (!paymentPhone.trim()) { Alert.alert(t("common.error"), "Entrez votre numéro Mobile Money."); return; }
    if (isNaN(amount) || amount < 10) { Alert.alert(t("common.error"), "Le montant minimum est de 10 FCFA."); return; }

    setLoading(true);
    try {
      await apiPost("/user-wallet/activate", {
        card_number: selectedCard,
        pin,
        payment_phone: paymentPhone.trim(),
        payment_method: paymentMethod,
        initial_amount: amount,
      });
      Alert.alert(t("common.success"), "Votre wallet a été activé. Vérifiez votre téléphone pour confirmer le paiement.", [
        { text: "OK", onPress: () => router.replace("/wallet" as any) },
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
        <TouchableOpacity onPress={() => { if (step === "card") router.back(); else setStep(step === "payment" ? "pin" : "card"); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("wallet.activateTitle")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Steps indicator */}
      <View style={styles.stepsRow}>
        {(["card", "pin", "payment"] as Step[]).map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, step === s && styles.stepDotActive, (step === "pin" && i === 0) || (step === "payment" && i <= 1) ? styles.stepDotDone : {}]}>
              {((step === "pin" && i === 0) || (step === "payment" && i <= 1)) ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={[styles.stepNum, step === s && styles.stepNumActive]}>{i + 1}</Text>
              )}
            </View>
            {i < 2 && <View style={[styles.stepLine, (step === "pin" && i === 0) || (step === "payment" && i <= 1) ? styles.stepLineDone : {}]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Step 1: Choose card number */}
        {step === "card" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("wallet.pickCardNumber")}</Text>
            <Text style={styles.sectionSubtitle}>Choisissez votre numéro de carte Dash Meal</Text>
            {loadingCards ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
            ) : (
              <>
                <View style={styles.cardGrid}>
                  {cardNumbers.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.cardNumBtn, selectedCard === num && styles.cardNumBtnActive]}
                      onPress={() => setSelectedCard(num)}
                    >
                      <Text style={[styles.cardNumText, selectedCard === num && styles.cardNumTextActive]}>
                        {num.slice(0, 4)} {num.slice(4)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={fetchCardNumbers}>
                  <Ionicons name="refresh" size={16} color={Colors.primary} />
                  <Text style={styles.refreshText}>{t("wallet.generateNew")}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.nextBtn, !selectedCard && styles.nextBtnDisabled]} onPress={handleNextFromCard} disabled={!selectedCard}>
              <Text style={styles.nextBtnText}>{t("common.next")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: PIN */}
        {step === "pin" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("wallet.choosePin")}</Text>
            <Text style={styles.sectionSubtitle}>Ce code sécurise vos paiements wallet</Text>
            <PinInput label={t("wallet.pinLabel")} value={pin} onChange={setPin} />
            <PinInput label={t("wallet.confirmPin")} value={pinConfirm} onChange={setPinConfirm} />
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextFromPin}>
              <Text style={styles.nextBtnText}>{t("common.next")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Initial deposit */}
        {step === "payment" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("wallet.paymentMethod")}</Text>
            <Text style={styles.sectionSubtitle}>Effectuez votre premier dépôt pour activer le wallet</Text>

            <View style={styles.methodRow}>
              {(["mtn_momo", "orange_money"] as PaymentMethod[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Ionicons
                    name={m === "mtn_momo" ? "phone-portrait-outline" : "phone-landscape-outline"}
                    size={20}
                    color={paymentMethod === m ? "#fff" : Colors.text2}
                  />
                  <Text style={[styles.methodLabel, paymentMethod === m && styles.methodLabelActive]}>
                    {m === "mtn_momo" ? t("wallet.mtn") : t("wallet.orange")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t("wallet.topupPhone")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("wallet.phonePlaceholder")}
                placeholderTextColor={Colors.text3}
                keyboardType="phone-pad"
                value={paymentPhone}
                onChangeText={setPaymentPhone}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t("wallet.initialDeposit")}</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex : 5000"
                placeholderTextColor={Colors.text3}
                keyboardType="numeric"
                value={initialAmount}
                onChangeText={setInitialAmount}
              />
            </View>

            <View style={styles.noteRow}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.text3} />
              <Text style={styles.noteText}>{t("wallet.topupFee")}</Text>
            </View>

            <TouchableOpacity style={[styles.nextBtn, loading && styles.nextBtnDisabled]} onPress={handleActivate} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.nextBtnText}>{t("wallet.activateBtn")}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PinInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, styles.pinInput]}
        placeholder="•••••"
        placeholderTextColor={Colors.text3}
        keyboardType="numeric"
        maxLength={5}
        secureTextEntry
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, ""))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },

  stepsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 20, backgroundColor: Colors.bg, paddingHorizontal: 40 },
  stepItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.border },
  stepDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  stepDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNum: { fontSize: 12, fontWeight: "700", color: Colors.text3 },
  stepNumActive: { color: Colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: Colors.primary },

  scroll: { padding: Spacing.md },
  section: { gap: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  sectionSubtitle: { fontSize: 14, color: Colors.text2, lineHeight: 20, marginTop: -8 },

  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cardNumBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  cardNumBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  cardNumText: { fontSize: 16, fontWeight: "700", color: Colors.text2, letterSpacing: 2 },
  cardNumTextActive: { color: Colors.primary },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: 8 },
  refreshText: { fontSize: 13, color: Colors.primary, fontWeight: "600" },

  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  input: { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.text },
  pinInput: { fontSize: 24, letterSpacing: 8, textAlign: "center" },

  methodRow: { flexDirection: "row", gap: 10 },
  methodBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  methodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodLabel: { fontSize: 14, fontWeight: "600", color: Colors.text2 },
  methodLabelActive: { color: "#fff" },

  noteRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  noteText: { fontSize: 12, color: Colors.text3, flex: 1 },

  nextBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  nextBtnDisabled: { backgroundColor: Colors.border },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
