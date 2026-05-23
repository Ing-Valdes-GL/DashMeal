import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { apiPost, apiPatch } from "@/lib/api";
import { Colors, Radius } from "@/lib/theme";

type Method = "current" | "email" | "sms";
type Step = 1 | 2;

const RESEND_DELAY = 60;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [method, setMethod] = useState<Method>("current");
  const [step, setStep]     = useState<Step>(1);

  // Champs communs
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  // Méthode "mot de passe actuel"
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrent, setShowCurrent]         = useState(false);

  // Méthodes OTP
  const [contact, setContact]   = useState("");
  const [otp, setOtp]           = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pré-remplir avec email/phone du user
  useEffect(() => {
    if (method === "email" && user?.email) setContact(user.email);
    else if (method === "sms" && user?.phone) setContact(user.phone);
    else setContact("");
    setStep(1);
    setOtp("");
    setCountdown(0);
  }, [method]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCountdown() {
    setCountdown(RESEND_DELAY);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  const sendOtpMutation = useMutation({
    mutationFn: () => {
      if (method === "email") return apiPost("/auth/user/send-email-otp", { email: contact });
      return apiPost("/auth/user/send-otp", { phone: contact });
    },
    onSuccess: () => { setStep(2); startCountdown(); },
    onError: () => Alert.alert(t("common.error"), t("changePassword.errorGeneric")),
  });

  const changeMutation = useMutation({
    mutationFn: () => {
      if (method === "current") {
        return apiPost("/users/me/change-password", {
          method: "current",
          current_password: currentPassword,
          new_password: newPassword,
        });
      }
      return apiPost("/users/me/change-password", {
        method,
        contact,
        otp,
        new_password: newPassword,
      });
    },
    onSuccess: () => {
      Alert.alert(
        t("changePassword.successTitle"),
        t("changePassword.successMsg"),
        [{ text: "OK", onPress: () => router.back() }],
      );
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error;
      if (code === "INVALID_PASSWORD") {
        Alert.alert(t("common.error"), t("changePassword.errorInvalid"));
      } else if (code === "INVALID_OTP") {
        Alert.alert(t("common.error"), t("changePassword.errorOtp"));
      } else {
        Alert.alert(t("common.error"), t("changePassword.errorGeneric"));
      }
    },
  });

  function validate(): boolean {
    if (newPassword.length < 8) {
      Alert.alert(t("common.error"), t("changePassword.tooShort")); return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t("common.error"), t("changePassword.mismatch")); return false;
    }
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;
    changeMutation.mutate();
  }

  // ── Rendu méthode ────────────────────────────────────────────────────────────

  const METHODS: { key: Method; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: "current", icon: "lock-closed-outline", label: t("changePassword.methodCurrent") },
    { key: "email",   icon: "mail-outline",         label: t("changePassword.methodEmail") },
    { key: "sms",     icon: "phone-portrait-outline", label: t("changePassword.methodSms") },
  ];

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t("changePassword.title")}</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Sélecteur de méthode */}
          <Text style={s.subtitle}>{t("changePassword.subtitle")}</Text>

          <View style={s.methodRow}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[s.methodChip, method === m.key && s.methodChipActive]}
                onPress={() => setMethod(m.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={m.icon}
                  size={18}
                  color={method === m.key ? "#fff" : Colors.text2}
                />
                <Text style={[s.methodLabel, method === m.key && s.methodLabelActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ─── Méthode 1 : mot de passe actuel ─── */}
          {method === "current" && (
            <View style={s.form}>
              <Field
                label={t("changePassword.currentPassword")}
                placeholder={t("changePassword.currentPasswordPh")}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secure={!showCurrent}
                onToggle={() => setShowCurrent(!showCurrent)}
              />
              <Field
                label={t("changePassword.newPassword")}
                placeholder={t("changePassword.newPasswordPh")}
                value={newPassword}
                onChangeText={setNewPassword}
                secure={!showNew}
                onToggle={() => setShowNew(!showNew)}
              />
              <Field
                label={t("changePassword.confirmPassword")}
                placeholder={t("changePassword.confirmPasswordPh")}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secure={!showConfirm}
                onToggle={() => setShowConfirm(!showConfirm)}
              />
              <PasswordStrength password={newPassword} />
              <SubmitBtn
                label={t("changePassword.changeBtn")}
                loading={changeMutation.isPending}
                onPress={handleSubmit}
                disabled={!currentPassword || !newPassword || !confirmPassword}
              />
            </View>
          )}

          {/* ─── Méthodes OTP (email ou SMS) ─── */}
          {(method === "email" || method === "sms") && (
            <View style={s.form}>
              {/* Indicateur d'étape */}
              <View style={s.stepRow}>
                <StepDot active={step >= 1} done={step > 1} n={1} />
                <View style={[s.stepLine, step > 1 && s.stepLineDone]} />
                <StepDot active={step >= 2} done={false} n={2} />
              </View>
              <Text style={s.stepLabel}>
                {step === 1 ? t("changePassword.step1") : t("changePassword.step2")}
              </Text>

              {/* Étape 1 : saisir email ou téléphone */}
              {step === 1 && (
                <>
                  <Field
                    label={method === "email" ? t("changePassword.emailLabel") : t("changePassword.phoneLabel")}
                    placeholder={method === "email" ? t("changePassword.emailPh") : t("changePassword.phonePh")}
                    value={contact}
                    onChangeText={setContact}
                    keyboardType={method === "email" ? "email-address" : "phone-pad"}
                  />
                  <SubmitBtn
                    label={t("changePassword.sendCode")}
                    loading={sendOtpMutation.isPending}
                    onPress={() => { if (contact.trim()) sendOtpMutation.mutate(); }}
                    disabled={!contact.trim()}
                  />
                </>
              )}

              {/* Étape 2 : code + nouveau mot de passe */}
              {step === 2 && (
                <>
                  <View style={s.codeSentBox}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    <Text style={s.codeSentText}>
                      {t("changePassword.codeSentTo")} <Text style={{ fontWeight: "700" }}>{contact}</Text>
                    </Text>
                  </View>

                  <Field
                    label={t("changePassword.otpLabel")}
                    placeholder={t("changePassword.otpPh")}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Field
                    label={t("changePassword.newPassword")}
                    placeholder={t("changePassword.newPasswordPh")}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secure={!showNew}
                    onToggle={() => setShowNew(!showNew)}
                  />
                  <Field
                    label={t("changePassword.confirmPassword")}
                    placeholder={t("changePassword.confirmPasswordPh")}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secure={!showConfirm}
                    onToggle={() => setShowConfirm(!showConfirm)}
                  />
                  <PasswordStrength password={newPassword} />

                  {/* Renvoyer le code */}
                  <TouchableOpacity
                    style={s.resendBtn}
                    onPress={() => { if (countdown === 0) sendOtpMutation.mutate(); }}
                    disabled={countdown > 0 || sendOtpMutation.isPending}
                  >
                    <Text style={[s.resendText, countdown > 0 && { color: Colors.text3 }]}>
                      {countdown > 0
                        ? `${t("changePassword.resendIn")} ${countdown}s`
                        : t("changePassword.resend")}
                    </Text>
                  </TouchableOpacity>

                  <SubmitBtn
                    label={t("changePassword.changeBtn")}
                    loading={changeMutation.isPending}
                    onPress={handleSubmit}
                    disabled={otp.length < 6 || !newPassword || !confirmPassword}
                  />
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function Field({
  label, placeholder, value, onChangeText, secure, onToggle, keyboardType, maxLength,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void;
  secure?: boolean; onToggle?: () => void;
  keyboardType?: "email-address" | "phone-pad" | "number-pad";
  maxLength?: number;
}) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <View style={f.inputRow}>
        <TextInput
          style={f.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.text3}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize="none"
          maxLength={maxLength}
        />
        {onToggle && (
          <TouchableOpacity onPress={onToggle} style={f.eye}>
            <Ionicons name={secure ? "eye-outline" : "eye-off-outline"} size={20} color={Colors.text3} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNum   = /[0-9]/.test(password);
  const hasSpec  = /[^A-Za-z0-9]/.test(password);
  const score    = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);

  if (!password) return null;
  const colors = ["#EF4444", "#F97316", "#EAB308", "#22C55E"];
  const labels = ["Faible", "Moyen", "Fort", "Très fort"];

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              backgroundColor: i <= score ? colors[score - 1] : Colors.border,
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 11, color: score > 0 ? colors[score - 1] : Colors.text3 }}>
        {score > 0 ? labels[score - 1] : ""}
      </Text>
    </View>
  );
}

function SubmitBtn({ label, loading, onPress, disabled }: {
  label: string; loading: boolean; onPress: () => void; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.submitBtn, (disabled || loading) && s.submitBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={s.submitText}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

function StepDot({ active, done, n }: { active: boolean; done: boolean; n: number }) {
  return (
    <View style={[sd.dot, active && sd.dotActive, done && sd.dotDone]}>
      {done
        ? <Ionicons name="checkmark" size={14} color="#fff" />
        : <Text style={[sd.num, active && { color: "#fff" }]}>{n}</Text>
      }
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.pageBg },
  safe:     { backgroundColor: Colors.bg },
  header:   {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.bg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:      {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle:  { fontSize: 17, fontWeight: "700", color: Colors.text },
  scroll:       { padding: 20, paddingBottom: 60 },
  subtitle:     { fontSize: 14, color: Colors.text2, marginBottom: 16, textAlign: "center" },

  methodRow:    { flexDirection: "row", gap: 8, marginBottom: 24 },
  methodChip:   {
    flex: 1, flexDirection: "column", alignItems: "center", gap: 4,
    paddingVertical: 12, paddingHorizontal: 6,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  methodChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodLabel:      { fontSize: 10, fontWeight: "600", color: Colors.text2, textAlign: "center" },
  methodLabelActive: { color: "#fff" },

  form:     { gap: 0 },

  stepRow:  { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 6 },
  stepLineDone: { backgroundColor: Colors.primary },
  stepLabel:{ fontSize: 13, fontWeight: "600", color: Colors.text2, marginBottom: 20, textAlign: "center" },

  codeSentBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
    padding: 12, marginBottom: 16,
  },
  codeSentText: { fontSize: 13, color: Colors.text, flex: 1, lineHeight: 18 },

  resendBtn:  { alignSelf: "center", marginBottom: 8, marginTop: -4 },
  resendText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  submitBtn:  {
    backgroundColor: Colors.primary, borderRadius: Radius.xl,
    height: 56, alignItems: "center", justifyContent: "center",
    marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});

const f = StyleSheet.create({
  wrap:     { marginBottom: 16 },
  label:    { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14,
  },
  input:    { flex: 1, height: 52, fontSize: 15, color: Colors.text },
  eye:      { padding: 4 },
});

const sd = StyleSheet.create({
  dot:      {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.pageBg, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  dotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dotDone:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  num:       { fontSize: 12, fontWeight: "700", color: Colors.text3 },
});
