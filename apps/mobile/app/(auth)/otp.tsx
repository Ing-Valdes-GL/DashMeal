import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
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
  circle: { position: "absolute", borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  c1:     { width: 300, height: 300, top: -120, right: -80, backgroundColor: "rgba(255,255,255,0.03)" },
  c2:     { width: 200, height: 200, top: 60,   right: -60, backgroundColor: "transparent" },
});

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
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (!val && idx > 0) inputs.current[idx - 1]?.focus();
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
            <Ionicons name="phone-portrait-outline" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Vérification</Text>
          <Text style={styles.subtitle}>
            Nous avons envoyé un code à{"\n"}
            <Text style={styles.phone}>{phone}</Text>
          </Text>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(r) => { if (r) inputs.current[i] = r; }}
                style={[styles.box, digit && styles.boxFilled]}
                value={digit}
                onChangeText={(v) => handleDigit(v.slice(-1), i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Resend */}
          <TouchableOpacity
            onPress={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            style={styles.resendRow}
          >
            <Text style={styles.resendText}>
              Renvoyer dans{" "}
              <Text style={styles.resendTimer}>50 sec</Text>
            </Text>
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
              : <Text style={styles.btnText}>VÉRIFIER</Text>
            }
          </TouchableOpacity>
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
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5, borderColor: "rgba(255,122,47,0.3)",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  title:    { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 14, color: Colors.textDark2, textAlign: "center", lineHeight: 22, marginBottom: 36 },
  phone:    { color: "#fff", fontWeight: "600" },
  otpRow:   { flexDirection: "row", gap: 10, marginBottom: 20 },
  box: {
    width: 48, height: 56, borderRadius: Radius.sm,
    backgroundColor: Colors.darkInput,
    borderWidth: 1.5, borderColor: "transparent",
    textAlign: "center", fontSize: 22, fontWeight: "700", color: "#fff",
  },
  boxFilled: { borderColor: Colors.primary, backgroundColor: "rgba(255,122,47,0.1)" },
  resendRow: { marginBottom: 24 },
  resendText: { fontSize: 13, color: Colors.textDark2 },
  resendTimer: { color: Colors.primary, fontWeight: "600" },
  error: { color: "#FF6B6B", fontSize: 13, marginBottom: 16 },
  btn: {
    height: 52, borderRadius: Radius.full, width: "100%",
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    ...Shadow.primary,
  },
  btnOff:  { opacity: 0.55 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 1 },
});
