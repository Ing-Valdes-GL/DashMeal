import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Dimensions, Modal, TextInput,
  KeyboardAvoidingView, Platform, RefreshControl, Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { apiGet, apiPost } from "@/lib/api";
import { Colors, Radius, Shadow, Spacing } from "@/lib/theme";

// ─── Pool de numéros de carte (persisté localement) ──────────────────────────
// Génère 3 numéros à 16 chiffres (4 groupes de 4) localement — instantané.
// Le pool est sauvegardé dans AsyncStorage : après le choix de l'utilisateur,
// les 2 numéros restants sont conservés pour une utilisation ultérieure.
const POOL_KEY = "dm_card_number_pool";

function generateRawNumber(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

async function getCardPool(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(POOL_KEY);
    if (raw) {
      const pool: string[] = JSON.parse(raw);
      // Invalider le cache si les numéros ne sont pas exactement 8 chiffres
      if (pool.length > 0 && pool.every((n) => /^\d{8}$/.test(n))) return pool;
      await AsyncStorage.removeItem(POOL_KEY);
    }
  } catch {}
  // Génération locale instantanée — 3 numéros à 8 chiffres
  const pool = Array.from({ length: 3 }, generateRawNumber);
  await AsyncStorage.setItem(POOL_KEY, JSON.stringify(pool));
  return pool;
}

async function consumeFromPool(chosen: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(POOL_KEY);
    if (!raw) return;
    const pool: string[] = JSON.parse(raw);
    const remaining = pool.filter((n) => n !== chosen);
    if (remaining.length === 0) {
      await AsyncStorage.removeItem(POOL_KEY);
    } else {
      await AsyncStorage.setItem(POOL_KEY, JSON.stringify(remaining));
    }
  } catch {}
}

const { width: W } = Dimensions.get("window");
const CARD_H = Math.round((W - 32) / 1.586);

// ─── Détection opérateur Cameroun ────────────────────────────────────────────
type Operator = "MTN" | "Orange" | null;

function detectOperator(phone: string): Operator {
  const digits = phone.replace(/\D/g, "");
  // Normaliser : extraire les 9 chiffres locaux
  let local = digits;
  if (local.startsWith("00237")) local = local.slice(5);
  else if (local.startsWith("237")) local = local.slice(3);
  const prefix = parseInt(local.slice(0, 3), 10);
  if (isNaN(prefix)) return null;
  // MTN : 650-654, 658-659, 670-679, 680-687
  if ((prefix >= 650 && prefix <= 654) || (prefix >= 658 && prefix <= 659) ||
      (prefix >= 670 && prefix <= 679) || (prefix >= 680 && prefix <= 687)) return "MTN";
  // Orange : 655-657, 688-689, 690-699
  if ((prefix >= 655 && prefix <= 657) || (prefix >= 688 && prefix <= 689) ||
      (prefix >= 690 && prefix <= 699)) return "Orange";
  return null;
}

const OPERATOR_INFO: Record<NonNullable<Operator>, { color: string; ussd: string; method: string; label: string }> = {
  MTN:    { color: "#FFC107", ussd: "*126#",    method: "mtn_mobile_money", label: "MTN MoMo" },
  Orange: { color: "#FF6B00", ussd: "#150*50#", method: "orange_money",     label: "Orange Money" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Wallet {
  id: string;
  balance: number;
  card_number: string;
  card_name: string;
  is_active: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  type: "credit" | "debit" | "topup" | "transfer" | "withdrawal" | "activation";
  amount: number;
  description: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
  reference?: string;
}

// ─── Carte DashPay ───────────────────────────────────────────────────────────
function DashPayCard({ wallet, onActivate }: { wallet: Wallet | null; onActivate: () => void }) {
  const { t } = useTranslation();
  const activated = !!(wallet?.is_active && wallet?.card_number);

  return (
    <TouchableOpacity
      style={card.wrap}
      activeOpacity={activated ? 1 : 0.85}
      onPress={activated ? undefined : onActivate}
    >
      <View style={card.circle1} />
      <View style={card.circle2} />
      <View style={card.circle3} />

      <View style={[card.content, !activated && { opacity: 0.28 }]}>
        <View style={card.topRow}>
          <Image source={require("../../assets/logo2.png")} style={card.logo} resizeMode="contain" />
          <Text style={card.label}>DashPay</Text>
          <Ionicons name="card-outline" size={20} color="rgba(255,255,255,0.55)" />
        </View>

        <View>
          <Text style={card.balanceLabel}>{t("wallet.balance")}</Text>
          <Text style={card.balance}>
            {activated
              ? `${(wallet!.balance ?? 0).toLocaleString("fr-FR")} FCFA`
              : "0 FCFA"}
          </Text>
        </View>

        <View style={card.bottomRow}>
          <Text style={card.cardNum}>
            {activated && wallet!.card_number
              ? `•••• •••• •••• ${wallet!.card_number.slice(-4)}`
              : "•••• •••• •••• ••••"}
          </Text>
          <Text style={card.tag}>DASHPAY</Text>
        </View>
      </View>

      {!activated && (
        <View style={card.frosted}>
          <Ionicons name="lock-closed-outline" size={30} color="#fff" />
          <Text style={card.frostedTitle}>{t("wallet.activateTitle")}</Text>
          <Text style={card.frostedSub}>{t("wallet.activateSub")}</Text>
          <TouchableOpacity style={card.cta} onPress={onActivate}>
            <Text style={card.ctaText}>{t("wallet.activate")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Bouton action (Recharger / Envoyer / Retirer) ───────────────────────────
function ActionBtn({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={act.btn} onPress={onPress} activeOpacity={0.7}>
      <View style={act.icon}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={act.label}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Ligne transaction ────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.type === "credit" || tx.type === "topup" || tx.type === "activation";
  const icon: React.ComponentProps<typeof Ionicons>["name"] =
    tx.type === "topup"       ? "arrow-down-circle-outline"
    : tx.type === "transfer"  ? "swap-horizontal-outline"
    : tx.type === "withdrawal"? "arrow-up-circle-outline"
    : tx.type === "activation"? "rocket-outline"
    : isCredit                ? "add-circle-outline"
    :                           "remove-circle-outline";

  return (
    <View style={tx_.row}>
      <View style={[tx_.icon, { backgroundColor: isCredit ? "#E8F5E9" : "#FFF3E0" }]}>
        <Ionicons name={icon} size={20} color={isCredit ? Colors.primary : "#FF9800"} />
      </View>
      <View style={tx_.info}>
        <Text style={tx_.desc} numberOfLines={1}>{tx.description}</Text>
        <Text style={tx_.date}>{new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</Text>
      </View>
      <View style={tx_.right}>
        <Text style={[tx_.amount, { color: isCredit ? Colors.primary : Colors.error }]}>
          {isCredit ? "+" : "-"}{tx.amount.toLocaleString("fr-FR")} F
        </Text>
        <View style={[tx_.status, { backgroundColor: tx.status === "completed" ? "#E8F5E9" : tx.status === "failed" ? "#FFEBEE" : "#FFF8E1" }]}>
          <Text style={[tx_.statusText, { color: tx.status === "completed" ? Colors.primary : tx.status === "failed" ? Colors.error : "#FF9800" }]}>
            {tx.status === "completed" ? "✓" : tx.status === "failed" ? "✗" : "…"}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Modal Activation ─────────────────────────────────────────────────────────
function ActivateModal({
  visible, onClose, onSuccess,
}: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"card" | "pin" | "payment" | "waiting">("card");
  const [cardNumbers, setCardNumbers] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("500");
  const [loading, setLoading] = useState(false);
  const operator = detectOperator(phone);
  const opInfo = operator ? OPERATOR_INFO[operator] : null;

  // reference Campay retourné après initiation + polling
  const [reference, setReference] = useState<string | null>(null);
  const [ussdCode, setUssdCode]   = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<"pending" | "completed" | "failed">("pending");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);
  const MAX_POLLS = 60; // 3 min (60 × 3s)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => {
    if (visible) {
      setStep("card");
      setSelectedCard("");
      setPin("");
      setPinConfirm("");
      setPhone("");
      setAmount("500");
      setReference(null);
      setUssdCode(null);
      setPollStatus("pending");
      pollCount.current = 0;
      stopPolling();
      getCardPool().then(setCardNumbers);
    } else {
      stopPolling();
    }
  }, [visible]);

  const [checking, setChecking] = useState(false);

  const checkNow = async () => {
    if (!reference || checking || pollStatus !== "pending") return;
    setChecking(true);
    try {
      const res: any = await apiGet(`/user-wallet/payment-status/${reference}`);
      const s: string = res?.status ?? "pending";
      if (s === "completed") {
        stopPolling(); setPollStatus("completed");
        await consumeFromPool(selectedCard);
        setTimeout(onSuccess, 1200);
      } else if (s === "failed") {
        stopPolling(); setPollStatus("failed");
      }
    } catch {} finally {
      setChecking(false);
    }
  };

  // Lancer le polling après avoir obtenu la reference
  useEffect(() => {
    if (!reference) return;
    pollCount.current = 0;
    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      try {
        const res: any = await apiGet(`/user-wallet/payment-status/${reference}`);
        const s: string = res?.status ?? "pending";
        if (s === "completed") {
          stopPolling();
          setPollStatus("completed");
          await consumeFromPool(selectedCard);
          setTimeout(onSuccess, 1200);
        } else if (s === "failed") {
          stopPolling();
          setPollStatus("failed");
        } else if (pollCount.current >= MAX_POLLS) {
          stopPolling();
          setPollStatus("failed");
        }
      } catch {}
    }, 3000);
    return stopPolling;
  }, [reference]);

  const handleActivate = async () => {
    if (!selectedCard) return Alert.alert("", t("wallet.act.noCard"));
    if (pin.length < 4)  return Alert.alert("", t("wallet.act.pinShort"));
    if (pin !== pinConfirm) return Alert.alert("", t("wallet.act.pinMismatch"));
    if (!phone) return Alert.alert("", t("wallet.act.noPhone"));
    if (!operator) return Alert.alert("", t("wallet.act.unknownOperator"));
    setLoading(true);
    try {
      const res: any = await apiPost("/user-wallet/activate", {
        card_number: selectedCard, pin,
        payment_phone: phone,
        payment_method: opInfo!.method,
        initial_amount: Number(amount) || 10,
      });
      // Utiliser le code USSD de l'opérateur détecté si Campay n'en fournit pas
      setUssdCode(res?.ussd_code ?? opInfo!.ussd);
      setReference(res?.reference ?? null);
      setStep("waiting");
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.response?.data?.error?.message ?? t("wallet.act.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView edges={["top"]} style={m.safe}>
          <View style={m.header}>
            <TouchableOpacity onPress={() => { stopPolling(); onClose(); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={m.headerTitle}>{t("wallet.activateTitle")}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            {/* Steps indicator (caché pendant waiting) */}
            {step !== "waiting" && (
              <View style={m.steps}>
                {(["card", "pin", "payment"] as const).map((s, i) => (
                  <View key={s} style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[m.stepDot, step === s && m.stepActive,
                      (step === "pin" && i === 0) || (step === "payment" && i < 2) ? m.stepDone : null]}>
                      <Text style={m.stepNum}>{i + 1}</Text>
                    </View>
                    {i < 2 && <View style={m.stepLine} />}
                  </View>
                ))}
              </View>
            )}

            {/* Étape 1 — Choisir numéro */}
            {step === "card" && (
              <View style={m.section}>
                <Text style={m.sectionTitle}>{t("wallet.act.chooseCard")}</Text>
                <Text style={m.sectionSub}>{t("wallet.act.chooseCardSub")}</Text>
                {cardNumbers.length === 0
                  ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
                  : cardNumbers.map((num) => (
                    <TouchableOpacity key={num}
                      style={[m.cardOption, selectedCard === num && m.cardOptionActive]}
                      onPress={() => setSelectedCard(num)}>
                      <Text style={[m.cardOptionNum, selectedCard === num && { color: Colors.primary }]}>{num}</Text>
                      {selectedCard === num && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                    </TouchableOpacity>
                  ))}
                <TouchableOpacity style={[m.nextBtn, !selectedCard && m.nextBtnDisabled]}
                  onPress={() => selectedCard && setStep("pin")}>
                  <Text style={m.nextBtnText}>{t("common.next")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Étape 2 — PIN */}
            {step === "pin" && (
              <View style={m.section}>
                <Text style={m.sectionTitle}>{t("wallet.act.createPin")}</Text>
                <Text style={m.sectionSub}>{t("wallet.act.createPinSub")}</Text>
                <Text style={m.fieldLabel}>{t("wallet.act.pin")}</Text>
                <TextInput style={m.input} value={pin} onChangeText={setPin}
                  secureTextEntry keyboardType="numeric" maxLength={6}
                  placeholder="••••" placeholderTextColor={Colors.text3} />
                <Text style={m.fieldLabel}>{t("wallet.act.pinConfirm")}</Text>
                <TextInput style={m.input} value={pinConfirm} onChangeText={setPinConfirm}
                  secureTextEntry keyboardType="numeric" maxLength={6}
                  placeholder="••••" placeholderTextColor={Colors.text3} />
                <TouchableOpacity style={[m.nextBtn, (pin.length < 4 || pin !== pinConfirm) && m.nextBtnDisabled]}
                  onPress={() => pin.length >= 4 && pin === pinConfirm && setStep("payment")}>
                  <Text style={m.nextBtnText}>{t("common.next")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Étape 3 — Paiement */}
            {step === "payment" && (
              <View style={m.section}>
                <Text style={m.sectionTitle}>{t("wallet.act.initialDeposit")}</Text>
                <Text style={m.sectionSub}>{t("wallet.act.initialDepositSub")}</Text>
                <Text style={m.fieldLabel}>{t("wallet.act.phone")}</Text>
                <View style={m.phoneRow}>
                  <TextInput style={[m.input, { flex: 1 }]} value={phone} onChangeText={setPhone}
                    keyboardType="phone-pad" placeholder="+237 6XX XXX XXX"
                    placeholderTextColor={Colors.text3} />
                  {opInfo && (
                    <View style={[m.opBadge, { backgroundColor: opInfo.color }]}>
                      <Text style={m.opBadgeText}>{opInfo.label}</Text>
                    </View>
                  )}
                </View>
                {opInfo && (
                  <View style={m.ussdHint}>
                    <Ionicons name="information-circle-outline" size={15} color={Colors.text2} />
                    <Text style={m.ussdHintText}>
                      {t("wallet.act.ussdHint")} <Text style={{ fontWeight: "800", color: Colors.text }}>{opInfo.ussd}</Text>
                    </Text>
                  </View>
                )}
                {phone.length > 5 && !opInfo && (
                  <View style={[m.ussdHint, { backgroundColor: "#FFF8E1" }]}>
                    <Ionicons name="warning-outline" size={15} color="#FF9800" />
                    <Text style={[m.ussdHintText, { color: "#FF9800" }]}>{t("wallet.act.unknownOperator")}</Text>
                  </View>
                )}
                <Text style={m.fieldLabel}>{t("wallet.act.amount")} (min 10 FCFA)</Text>
                <TextInput style={m.input} value={amount} onChangeText={setAmount}
                  keyboardType="numeric" placeholder="10" placeholderTextColor={Colors.text3} />
                <TouchableOpacity style={[m.nextBtn, (!phone || !opInfo || loading) && m.nextBtnDisabled]}
                  onPress={handleActivate} disabled={!phone || !opInfo || loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={m.nextBtnText}>{t("wallet.activate")}</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Étape 4 — Attente paiement */}
            {step === "waiting" && (
              <View style={m.waitBox}>
                {pollStatus === "completed" ? (
                  <>
                    <View style={m.waitIcon}><Ionicons name="checkmark-circle" size={56} color={Colors.primary} /></View>
                    <Text style={m.waitTitle}>{t("wallet.pay.success")}</Text>
                    <Text style={m.waitSub}>{t("wallet.pay.successSub")}</Text>
                  </>
                ) : pollStatus === "failed" ? (
                  <>
                    <View style={[m.waitIcon, { backgroundColor: "#FFEBEE" }]}>
                      <Ionicons name="close-circle" size={56} color={Colors.error} />
                    </View>
                    <Text style={[m.waitTitle, { color: Colors.error }]}>{t("wallet.pay.failed")}</Text>
                    <Text style={m.waitSub}>{t("wallet.pay.failedSub")}</Text>
                    <TouchableOpacity style={[m.nextBtn, { marginTop: 24 }]} onPress={() => { stopPolling(); onClose(); }}>
                      <Text style={m.nextBtnText}>{t("common.close")}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 20 }} />
                    <Text style={m.waitTitle}>{t("wallet.pay.waiting")}</Text>
                    <Text style={m.waitSub}>{t("wallet.pay.waitingSub")}</Text>
                    {ussdCode && (
                      <View style={m.ussdBox}>
                        <Text style={m.ussdLabel}>{t("wallet.pay.ussd")}</Text>
                        <Text style={m.ussdCode}>{ussdCode}</Text>
                      </View>
                    )}
                    <Text style={m.waitHint}>{t("wallet.pay.hint")}</Text>
                    <TouchableOpacity
                      style={[m.checkBtn, checking && { opacity: 0.6 }]}
                      onPress={checkNow}
                      disabled={checking}
                    >
                      {checking
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Text style={m.checkBtnText}>{t("wallet.pay.checkNow")}</Text>
                      }
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Modal Recharge ───────────────────────────────────────────────────────────
function TopUpModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [ussdCode, setUssdCode]   = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<"pending" | "completed" | "failed">("pending");
  const [waiting, setWaiting] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);
  const MAX_POLLS = 60;
  const QUICK = [1000, 2000, 5000, 10000];
  const operator = detectOperator(phone);
  const opInfo = operator ? OPERATOR_INFO[operator] : null;

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => {
    if (!visible) { stopPolling(); setWaiting(false); setReference(null); setPollStatus("pending"); setChecking(false); }
  }, [visible]);

  const checkNow = async () => {
    if (!reference || checking || pollStatus !== "pending") return;
    setChecking(true);
    try {
      const res: any = await apiGet(`/user-wallet/payment-status/${reference}`);
      const s: string = res?.status ?? "pending";
      if (s === "completed") { stopPolling(); setPollStatus("completed"); setTimeout(onSuccess, 1200); }
      else if (s === "failed") { stopPolling(); setPollStatus("failed"); }
    } catch {} finally { setChecking(false); }
  };

  useEffect(() => {
    if (!reference) return;
    pollCount.current = 0;
    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      try {
        const res: any = await apiGet(`/user-wallet/payment-status/${reference}`);
        const s: string = res?.status ?? "pending";
        if (s === "completed") {
          stopPolling();
          setPollStatus("completed");
          setTimeout(onSuccess, 1200);
        } else if (s === "failed" || pollCount.current >= MAX_POLLS) {
          stopPolling();
          setPollStatus("failed");
        }
      } catch {}
    }, 3000);
    return stopPolling;
  }, [reference]);

  const handleTopUp = async () => {
    const n = Number(amount);
    if (!phone || n < 10) return Alert.alert("", t("wallet.topup.invalid"));
    if (!opInfo) return Alert.alert("", t("wallet.act.unknownOperator"));
    setLoading(true);
    try {
      const res: any = await apiPost("/user-wallet/topup", { amount: n, phone, payment_method: opInfo.method });
      setUssdCode(res?.ussd_code ?? opInfo.ussd);
      setReference(res?.reference ?? null);
      setWaiting(true);
      setPollStatus("pending");
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.response?.data?.error?.message ?? t("wallet.topup.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView edges={["top"]} style={m.safe}>
          <View style={m.header}>
            <TouchableOpacity onPress={() => { stopPolling(); onClose(); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={m.headerTitle}>{t("wallet.topUp")}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            {!waiting ? (
              <View style={m.section}>
                <Text style={m.fieldLabel}>{t("wallet.act.phone")}</Text>
                <View style={m.phoneRow}>
                  <TextInput style={[m.input, { flex: 1 }]} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+237 6XX XXX XXX" placeholderTextColor={Colors.text3} />
                  {opInfo && (
                    <View style={[m.opBadge, { backgroundColor: opInfo.color }]}>
                      <Text style={m.opBadgeText}>{opInfo.label}</Text>
                    </View>
                  )}
                </View>
                {opInfo && (
                  <View style={m.ussdHint}>
                    <Ionicons name="information-circle-outline" size={15} color={Colors.text2} />
                    <Text style={m.ussdHintText}>{t("wallet.act.ussdHint")} <Text style={{ fontWeight: "800", color: Colors.text }}>{opInfo.ussd}</Text></Text>
                  </View>
                )}
                <Text style={m.fieldLabel}>{t("wallet.act.amount")}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  {QUICK.map((q) => (
                    <TouchableOpacity key={q} style={[m.quickBtn, amount === String(q) && m.quickBtnActive]} onPress={() => setAmount(String(q))}>
                      <Text style={[m.quickBtnText, amount === String(q) && { color: Colors.primary }]}>{q.toLocaleString("fr-FR")} F</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={m.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Autre montant" placeholderTextColor={Colors.text3} />
                <TouchableOpacity style={[m.nextBtn, (!phone || !opInfo || !amount || loading) && m.nextBtnDisabled]} onPress={handleTopUp} disabled={!phone || !opInfo || !amount || loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={m.nextBtnText}>{t("wallet.topUp")}</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={m.waitBox}>
                {pollStatus === "completed" ? (
                  <>
                    <View style={m.waitIcon}><Ionicons name="checkmark-circle" size={56} color={Colors.primary} /></View>
                    <Text style={m.waitTitle}>{t("wallet.pay.success")}</Text>
                    <Text style={m.waitSub}>{t("wallet.pay.successSub")}</Text>
                  </>
                ) : pollStatus === "failed" ? (
                  <>
                    <View style={[m.waitIcon, { backgroundColor: "#FFEBEE" }]}>
                      <Ionicons name="close-circle" size={56} color={Colors.error} />
                    </View>
                    <Text style={[m.waitTitle, { color: Colors.error }]}>{t("wallet.pay.failed")}</Text>
                    <Text style={m.waitSub}>{t("wallet.pay.failedSub")}</Text>
                    <TouchableOpacity style={[m.nextBtn, { marginTop: 24 }]} onPress={() => { stopPolling(); onClose(); }}>
                      <Text style={m.nextBtnText}>{t("common.close")}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 20 }} />
                    <Text style={m.waitTitle}>{t("wallet.pay.waiting")}</Text>
                    <Text style={m.waitSub}>{t("wallet.pay.waitingSub")}</Text>
                    {ussdCode && (
                      <View style={m.ussdBox}>
                        <Text style={m.ussdLabel}>{t("wallet.pay.ussd")}</Text>
                        <Text style={m.ussdCode}>{ussdCode}</Text>
                      </View>
                    )}
                    <Text style={m.waitHint}>{t("wallet.pay.hint")}</Text>
                    <TouchableOpacity
                      style={[m.checkBtn, checking && { opacity: 0.6 }]}
                      onPress={checkNow}
                      disabled={checking}
                    >
                      {checking
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Text style={m.checkBtnText}>{t("wallet.pay.checkNow")}</Text>
                      }
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function WalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  const [wallet, setWallet]           = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [showTopUp, setShowTopUp]     = useState(false);

  const load = useCallback(async () => {
    try {
      const w: any = await apiGet("/user-wallet");
      setWallet(w ?? null);
      if (w) {
        const tx: any = await apiGet("/user-wallet/transactions", { limit: 20 });
        setTransactions(Array.isArray(tx?.transactions) ? tx.transactions : []);
      }
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const onActivated = () => {
    setShowActivate(false);
    setLoading(true);
    load();
    Alert.alert("🎉 " + t("wallet.activated"), t("wallet.activatedMsg"));
  };

  const onToppedUp = () => {
    setShowTopUp(false);
    setRefreshing(true);
    load();
  };

  if (!isAuthenticated) {
    return (
      <View style={s.container}>
        <StatusBar style="dark" />
        <SafeAreaView edges={["top"]}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>DashPay</Text>
            <View style={{ width: 36 }} />
          </View>
        </SafeAreaView>
        <View style={s.authWall}>
          <Ionicons name="wallet-outline" size={56} color={Colors.text3} />
          <Text style={s.authTitle}>{t("profile.authTitle")}</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={s.loginBtnText}>{t("profile.loginBtn")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.bg }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>DashPay</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      {loading
        ? <View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
        : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          >
            {/* Carte DashPay */}
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <DashPayCard wallet={wallet} onActivate={() => setShowActivate(true)} />
            </View>

            {/* Actions rapides (wallet actif uniquement) */}
            {wallet?.is_active && (
              <View style={act.row}>
                <ActionBtn icon="add-circle-outline"    label={t("wallet.topUp")} onPress={() => setShowTopUp(true)} />
                <ActionBtn icon="swap-horizontal-outline" label={t("wallet.send")}  onPress={() => Alert.alert("Bientôt", "Transfert disponible prochainement")} />
                <ActionBtn icon="arrow-up-circle-outline" label={t("wallet.withdraw")} onPress={() => Alert.alert("Bientôt", "Retrait disponible prochainement")} />
              </View>
            )}

            {/* Informations carte (si actif) */}
            {wallet?.is_active && (
              <View style={s.infoCard}>
                <View style={s.infoRow}>
                  <Ionicons name="person-circle-outline" size={18} color={Colors.text2} />
                  <Text style={s.infoLabel}>{t("wallet.cardHolder")}</Text>
                  <Text style={s.infoVal}>{wallet.card_name}</Text>
                </View>
                <View style={s.divider} />
                <View style={s.infoRow}>
                  <Ionicons name="card-outline" size={18} color={Colors.text2} />
                  <Text style={s.infoLabel}>{t("wallet.cardNumber")}</Text>
                  <Text style={s.infoVal}>•••• {wallet.card_number?.slice(-4)}</Text>
                </View>
              </View>
            )}

            {/* Historique */}
            {wallet?.is_active && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t("wallet.history")}</Text>
                {transactions.length === 0
                  ? (
                    <View style={s.empty}>
                      <Ionicons name="receipt-outline" size={40} color={Colors.text3} />
                      <Text style={s.emptyText}>{t("wallet.empty")}</Text>
                    </View>
                  )
                  : transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
                }
              </View>
            )}
          </ScrollView>
        )}

      <ActivateModal visible={showActivate} onClose={() => setShowActivate(false)} onSuccess={onActivated} />
      <TopUpModal    visible={showTopUp}    onClose={() => setShowTopUp(false)}    onSuccess={onToppedUp} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card = StyleSheet.create({
  wrap:    { height: CARD_H, borderRadius: 18, backgroundColor: "#C0392B", overflow: "hidden", position: "relative", ...Shadow.md },
  circle1: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "#E74C3C", top: -80, right: -60, opacity: 0.7 },
  circle2: { position: "absolute", width: 160, height: 160, borderRadius: 80,  backgroundColor: "#FFC107", bottom: -60, left: 30,  opacity: 0.45 },
  circle3: { position: "absolute", width: 100, height: 100, borderRadius: 50,  backgroundColor: "#F39C12", top: 20,    left: -30, opacity: 0.3 },
  content: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 22, paddingVertical: 20, justifyContent: "space-between" },
  topRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  logo:    { width: 32, height: 32, borderRadius: 8 },
  label:   { flex: 1, fontSize: 16, fontWeight: "800", color: "rgba(255,255,255,0.95)", letterSpacing: 0.8 },
  balanceLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 4, letterSpacing: 0.5 },
  balance: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardNum: { fontSize: 14, color: "rgba(255,255,255,0.78)", letterSpacing: 2.5, fontWeight: "600" },
  tag:     { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.85)", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  frosted: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(8,8,8,0.62)", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 28 },
  frostedTitle: { color: "#fff", fontSize: 17, fontWeight: "800", textAlign: "center" },
  frostedSub:   { color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center", lineHeight: 18 },
  cta:     { backgroundColor: "#FFC107", paddingHorizontal: 28, paddingVertical: 11, borderRadius: 99, marginTop: 8 },
  ctaText: { color: "#1A1A1A", fontSize: 14, fontWeight: "800" },
});

const act = StyleSheet.create({
  row:   { flexDirection: "row", justifyContent: "space-evenly", marginTop: 20, marginHorizontal: 16, backgroundColor: Colors.bg, borderRadius: Radius.lg, paddingVertical: 16, ...Shadow.sm },
  btn:   { alignItems: "center", gap: 8 },
  icon:  { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12, fontWeight: "600", color: Colors.text2 },
});

const tx_ = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  icon:   { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  info:   { flex: 1 },
  desc:   { fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 2 },
  date:   { fontSize: 12, color: Colors.text3 },
  right:  { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 14, fontWeight: "700" },
  status: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 10, fontWeight: "800" },
});

const m = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  body:        { padding: 20, paddingBottom: 40 },
  steps:       { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 28 },
  stepDot:     { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.border, alignItems: "center", justifyContent: "center" },
  stepActive:  { backgroundColor: Colors.primary },
  stepDone:    { backgroundColor: Colors.primaryDark },
  stepNum:     { fontSize: 12, fontWeight: "700", color: "#fff" },
  stepLine:    { width: 40, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  section:     { gap: 12 },
  sectionTitle:{ fontSize: 17, fontWeight: "700", color: Colors.text },
  sectionSub:  { fontSize: 13, color: Colors.text2, lineHeight: 18, marginBottom: 8 },
  fieldLabel:  { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  input:       { height: 52, backgroundColor: Colors.inputBg, borderRadius: Radius.md, paddingHorizontal: 16, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  cardOption:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: Colors.inputBg, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  cardOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  cardOptionNum: { fontSize: 17, fontWeight: "700", color: Colors.text, letterSpacing: 3, fontVariant: ["tabular-nums"] },
  nextBtn:     { height: 54, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", justifyContent: "center", marginTop: 8 },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  quickBtn:    { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.inputBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  quickBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  quickBtnText:   { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  // Opérateur télécom
  phoneRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  opBadge:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  opBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  ussdHint:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.pageBg, borderRadius: 8, padding: 10 },
  ussdHintText:{ fontSize: 12, color: Colors.text2, flex: 1, lineHeight: 18 },
  // Écran d'attente paiement
  waitBox:   { alignItems: "center", paddingTop: 40, paddingHorizontal: 8, gap: 12 },
  waitIcon:  { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  waitTitle: { fontSize: 20, fontWeight: "800", color: Colors.text, textAlign: "center" },
  waitSub:   { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 22 },
  waitHint:  { fontSize: 12, color: Colors.text3, textAlign: "center", marginTop: 8 },
  ussdBox:   { marginTop: 20, backgroundColor: Colors.pageBg, borderRadius: Radius.lg, padding: 20, alignItems: "center", width: "100%", borderWidth: 1, borderColor: Colors.border },
  ussdLabel: { fontSize: 12, color: Colors.text2, marginBottom: 8, fontWeight: "600", letterSpacing: 0.5 },
  ussdCode:  { fontSize: 26, fontWeight: "800", color: Colors.text, letterSpacing: 3 },
  checkBtn:  { marginTop: 16, height: 44, paddingHorizontal: 28, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  checkBtnText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
});

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.pageBg },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.bg },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  loader:      { flex: 1, alignItems: "center", justifyContent: "center" },
  authWall:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  authTitle:   { fontSize: 18, fontWeight: "700", color: Colors.text, textAlign: "center" },
  loginBtn:    { height: 52, width: "100%", borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  loginBtnText:{ color: "#fff", fontWeight: "700", fontSize: 15 },
  infoCard:    { marginHorizontal: 16, marginTop: 16, backgroundColor: Colors.bg, borderRadius: Radius.lg, ...Shadow.sm, overflow: "hidden" },
  infoRow:     { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel:   { flex: 1, fontSize: 13, color: Colors.text2, fontWeight: "500" },
  infoVal:     { fontSize: 14, fontWeight: "700", color: Colors.text },
  divider:     { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16 },
  section:     { marginTop: 20 },
  sectionTitle:{ fontSize: 16, fontWeight: "700", color: Colors.text, marginHorizontal: 16, marginBottom: 8 },
  empty:       { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyText:   { fontSize: 14, color: Colors.text3 },
});
