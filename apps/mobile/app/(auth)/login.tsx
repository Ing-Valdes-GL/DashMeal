import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Image } from "expo-image";
import { apiPost } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => apiPost("/auth/user/login", { phone, password }),
    onSuccess: async (res) => {
      const { user, tokens } = res.data;
      await login(user, tokens.access_token, tokens.refresh_token);
      router.replace("/(tabs)");
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code;
      const msg = err?.response?.data?.error?.message;
      if (code === "PHONE_NOT_VERIFIED") {
        setError("Compte non vérifié — vérifiez votre téléphone");
      } else if (code === "ACCOUNT_SUSPENDED") {
        setError("Ce compte a été suspendu");
      } else if (msg) {
        setError(msg);
      } else if (!err?.response) {
        setError("Impossible de joindre le serveur");
      } else {
        setError(t("auth.invalidCredentials"));
      }
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#050d1a", "#0a0f1e", "#0f172a"]} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </View>

          {/* Titles */}
          <Text style={styles.title}>{t("auth.loginTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.loginSubtitle")}</Text>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("auth.phone")}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t("auth.phonePlaceholder")}
                  placeholderTextColor="#334155"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

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
              style={[styles.btn, (loginMutation.isPending || !phone || !password) && styles.btnDisabled]}
              onPress={() => { setError(""); loginMutation.mutate(); }}
              disabled={loginMutation.isPending || !phone || !password}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{t("auth.loginButton")}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.linkText}>
                {t("auth.noAccount")}{" "}
                <Text style={styles.linkBold}>{t("auth.register")}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050d1a" },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 28, paddingTop: 40 },
  logoWrap: {
    alignItems: "center",
    marginBottom: 4,
  },
  logo: {
    width: 240,
    height: 180,
  },
  title: {
    fontSize: 26, fontWeight: "800", color: "#fff",
    textAlign: "center", marginBottom: 6,
  },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 36 },
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
  btnDisabled: { opacity: 0.55 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  link: { alignItems: "center", marginTop: 8 },
  linkText: { color: "#64748b", fontSize: 14 },
  linkBold: { color: "#f97316", fontWeight: "600" },
});
