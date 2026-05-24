import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Colors, Radius, Shadow } from "@/lib/theme";

function AuthDecoration() {
  return (
    <View style={deco.wrap} pointerEvents="none">
      <View style={[deco.circle, deco.c1]} />
      <View style={[deco.circle, deco.c2]} />
    </View>
  );
}
const deco = StyleSheet.create({
  wrap:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  circle: { position: "absolute", borderRadius: 999, borderWidth: 1 },
  c1:     { width: 300, height: 300, top: -120, right: -80, backgroundColor: "rgba(255,122,47,0.06)", borderColor: "rgba(255,122,47,0.1)" },
  c2:     { width: 200, height: 200, top: 60,   right: -60, backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.05)" },
});

export default function OtpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { identifier, via, prefill } = useLocalSearchParams<{ identifier: string; via?: string; prefill?: string }>();
  const isEmail = via === "email" || (identifier && identifier.includes("@"));
  const { login } = useAuthStore();
  const [otp, setOtp] = useState(prefill ? prefill.split("").slice(0, 6) : ["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef<TextInput[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCountdown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const verifyEndpoint = isEmail ? "/auth/user/verify-email" : "/auth/user/verify-phone";
  const resendEndpoint = isEmail ? "/auth/user/resend-email-otp" : "/auth/user/request-reset";
  const identifierKey  = isEmail ? "email" : "phone";

  const verifyMutation = useMutation({
    mutationFn: () => apiPost<{ data: { user: any; tokens: { access_token: string; refresh_token: string } } }>(
      verifyEndpoint,
      { [identifierKey]: identifier, code: otp.join("") }
    ),
    onSuccess: async (res) => {
      await login(res.data.user, res.data.tokens.access_token, res.data.tokens.refresh_token);
      router.replace("/(tabs)");
    },
    onError: () => setError(t("auth.invalidCode")),
  });

  const resendMutation = useMutation({
    mutationFn: () => apiPost<{ data: { otp_code?: string } }>(resendEndpoint, { [identifierKey]: identifier }),
    onSuccess: (res) => {
      setError("");
      startCountdown();
      if (res.data.otp_code) setOtp(res.data.otp_code.split("").slice(0, 6));
    },
    onError: () => setError(t("auth.cantResend")),
  });

  const handleDigit = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setError("");
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (!val && idx > 0) inputs.current[idx - 1]?.focus();
  };

  // Handle paste — auto-fill all boxes
  const handlePaste = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    if (digits.length === 6) {
      setOtp(digits.split(""));
      inputs.current[5]?.focus();
    }
  };

  const code = otp.join("");

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AuthDecoration />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Ionicons
              name={isEmail ? "mail-outline" : "phone-portrait-outline"}
              size={32} color={Colors.primary}
            />
          </View>

          <Text style={styles.title}>{t("auth.verificationTitle")}</Text>
          <Text style={styles.subtitle}>
            {isEmail ? t("auth.verificationEmailSub") + "\n" : t("auth.verificationSmsSub") + "\n"}
            <Text style={styles.identifierText}>{identifier}</Text>
          </Text>

          {isEmail && (
            <View style={styles.emailHintBox}>
              <Ionicons name="information-circle-outline" size={14} color="#60A5FA" />
              <Text style={styles.emailHintText}>{t("auth.emailHint")}</Text>
            </View>
          )}

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(r) => { if (r) inputs.current[i] = r; }}
                style={[styles.box, digit && styles.boxFilled]}
                value={digit}
                onChangeText={(v) => {
                  if (v.length > 1) { handlePaste(v); return; }
                  handleDigit(v.slice(-1), i);
                }}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Resend */}
          <TouchableOpacity
            onPress={() => countdown === 0 && resendMutation.mutate()}
            disabled={countdown > 0 || resendMutation.isPending}
            style={styles.resendRow}
          >
            {resendMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : countdown > 0 ? (
              <Text style={styles.resendText}>
                {t("auth.resendIn")} <Text style={styles.resendTimer}>{countdown}s</Text>
              </Text>
            ) : (
              <Text style={[styles.resendText, { color: Colors.primary }]}>{t("auth.resendCode")}</Text>
            )}
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, (verifyMutation.isPending || code.length < 6) && styles.btnOff]}
            onPress={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending || code.length < 6}
            activeOpacity={0.85}
          >
            {verifyMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t("auth.verify")}</Text>
            }
          </TouchableOpacity>

          <Text style={styles.changeHint}>
            {t("auth.wrongAddress")}{" "}
            <Text style={{ color: Colors.primary }} onPress={() => router.back()}>{t("auth.modify")}</Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg, padding: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  content:  { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(255,122,47,0.12)",
    borderWidth: 1.5, borderColor: "rgba(255,122,47,0.3)",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  title:          { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 10, textAlign: "center" },
  subtitle:       { fontSize: 14, color: Colors.textDark2, textAlign: "center", lineHeight: 22, marginBottom: 20 },
  identifierText: { color: "#fff", fontWeight: "700" },

  emailHintBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(96,165,250,0.12)",
    borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 28,
  },
  emailHintText: { fontSize: 12, color: "#93C5FD", flex: 1 },

  otpRow:    { flexDirection: "row", gap: 10, marginBottom: 20 },
  box: {
    width: 48, height: 58, borderRadius: Radius.sm,
    backgroundColor: Colors.darkInput,
    borderWidth: 1.5, borderColor: "transparent",
    textAlign: "center", fontSize: 24, fontWeight: "700", color: "#fff",
  },
  boxFilled: { borderColor: Colors.primary, backgroundColor: "rgba(255,122,47,0.1)" },

  resendRow: { marginBottom: 20, minHeight: 24, alignItems: "center" },
  resendText:  { fontSize: 13, color: Colors.textDark2 },
  resendTimer: { color: Colors.primary, fontWeight: "600" },

  error: { color: "#FF6B6B", fontSize: 13, marginBottom: 14, textAlign: "center" },

  btn: {
    height: 52, borderRadius: Radius.full, width: "100%",
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", ...Shadow.primary,
  },
  btnOff:  { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 1 },

  changeHint: { marginTop: 16, fontSize: 13, color: Colors.textDark2, textAlign: "center" },
});
