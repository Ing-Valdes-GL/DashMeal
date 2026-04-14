import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

export default function OtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { login } = useAuthStore();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const inputs = useRef<TextInput[]>([]);

  const verifyMutation = useMutation({
    mutationFn: () => apiPost("/auth/user/verify-phone", { phone, code: otp.join("") }),
    onSuccess: async (res) => {
      const { user, tokens } = res.data;
      await login(user, tokens.access_token, tokens.refresh_token);
      router.replace("/(tabs)");
    },
    onError: () => setError("Code invalide ou expiré"),
  });

  const resendMutation = useMutation({
    mutationFn: () => apiPost("/auth/user/request-reset", { phone }),
    onSuccess: () => setError(""),
  });

  const handleDigit = (val: string, idx: number) => {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (!val && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const code = otp.join("");

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0a0f1e", "#0f172a"]} style={StyleSheet.absoluteFill} />

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconBg}>
          <Ionicons name="phone-portrait-outline" size={28} color="#f97316" />
        </View>
        <Text style={styles.title}>{t("auth.otpTitle")}</Text>
        <Text style={styles.subtitle}>
          {t("auth.otpSubtitle")}{"\n"}<Text style={styles.phone}>{phone}</Text>
        </Text>

        {/* OTP inputs */}
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { if (r) inputs.current[i] = r; }}
              style={[styles.otpInput, digit && styles.otpInputFilled]}
              value={digit}
              onChangeText={(v) => handleDigit(v.slice(-1), i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (verifyMutation.isPending || code.length < 6) && styles.btnDisabled]}
          onPress={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending || code.length < 6}
        >
          {verifyMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t("auth.verifyButton")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resend}
          onPress={() => resendMutation.mutate()}
          disabled={resendMutation.isPending}
        >
          <Text style={styles.resendText}>{t("auth.resendCode")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e", padding: 24, paddingTop: 60 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#0f172a",
    alignItems: "center", justifyContent: "center", marginBottom: 40,
  },
  content: { alignItems: "center" },
  iconBg: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: "#f97316/10", borderWidth: 1, borderColor: "#f9731630",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
    backgroundColor: "rgba(249,115,22,0.1)",
  } as any,
  title: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 22, marginBottom: 36 },
  phone: { color: "#94a3b8", fontWeight: "600" },
  otpRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  otpInput: {
    width: 48, height: 56, borderRadius: 12,
    backgroundColor: "#0f172a", borderWidth: 1.5, borderColor: "#1e293b",
    textAlign: "center", fontSize: 22, fontWeight: "700", color: "#fff",
  },
  otpInputFilled: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.1)" },
  error: { color: "#f87171", fontSize: 13, marginBottom: 16 },
  btn: {
    backgroundColor: "#f97316", borderRadius: 14, height: 52, width: "100%",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#f97316", shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  resend: { marginTop: 20 },
  resendText: { color: "#f97316", fontSize: 14, fontWeight: "500" },
});
