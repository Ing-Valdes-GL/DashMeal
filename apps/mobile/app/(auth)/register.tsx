import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  const registerMutation = useMutation({
    mutationFn: () => apiPost("/auth/user/register", { name, phone, password }),
    onSuccess: () => {
      // Navigate to OTP with phone
      router.push({ pathname: "/(auth)/otp", params: { phone } });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message;
      if (!err?.response) {
        setError("Impossible de joindre le serveur");
      } else {
        setError(msg ?? t("common.error"));
      }
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0a0f1e", "#0f172a"]} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.title}>{t("auth.register")}</Text>
          <Text style={styles.subtitle}>{t("auth.loginSubtitle")}</Text>

          <View style={styles.form}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("auth.name")}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t("auth.namePlaceholder")}
                  placeholderTextColor="#334155"
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("auth.phone")}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t("auth.phonePlaceholder")}
                  placeholderTextColor="#334155"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("auth.password")}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor="#334155"
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                  <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, registerMutation.isPending && styles.btnDisabled]}
              onPress={() => { setError(""); registerMutation.mutate(); }}
              disabled={registerMutation.isPending || !name || !phone || !password}
            >
              {registerMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{t("auth.registerButton")}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => router.back()}>
              <Text style={styles.linkText}>
                {t("auth.hasAccount")}{" "}
                <Text style={styles.linkBold}>{t("auth.login")}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#0f172a",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 32 },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: "500", color: "#94a3b8" },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b",
    borderRadius: 12, paddingHorizontal: 12, height: 52,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: "#fff", fontSize: 15 },
  eyeBtn: { padding: 4 },
  error: { color: "#f87171", fontSize: 13, textAlign: "center" },
  btn: {
    backgroundColor: "#f97316", borderRadius: 14, height: 52,
    alignItems: "center", justifyContent: "center", marginTop: 8,
    shadowColor: "#f97316", shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  link: { alignItems: "center", marginTop: 8 },
  linkText: { color: "#64748b", fontSize: 14 },
  linkBold: { color: "#f97316", fontWeight: "600" },
});
