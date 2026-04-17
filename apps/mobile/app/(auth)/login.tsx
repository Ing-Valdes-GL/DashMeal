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
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";

// ─── Décoration cercles (style auth Figma) ────────────────────────────────────
function AuthDecoration() {
  return (
    <View style={deco.wrap} pointerEvents="none">
      <View style={[deco.circle, deco.c1]} />
      <View style={[deco.circle, deco.c2]} />
      <View style={[deco.circle, deco.c3]} />
    </View>
  );
}
const deco = StyleSheet.create({
  wrap:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  circle: { position: "absolute", borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  c1:     { width: 300, height: 300, top: -120, right: -80, backgroundColor: "rgba(255,255,255,0.03)" },
  c2:     { width: 200, height: 200, top: 60,   right: -60,  backgroundColor: "transparent" },
  c3:     { width: 160, height: 160, top: -40,  right: 60,   backgroundColor: "transparent" },
});

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
      const msg  = err?.response?.data?.error?.message;
      if (code === "PHONE_NOT_VERIFIED")   setError("Compte non vérifié");
      else if (code === "ACCOUNT_SUSPENDED") setError("Ce compte a été suspendu");
      else if (msg) setError(msg);
      else if (!err?.response) setError("Impossible de joindre le serveur");
      else setError(t("auth.invalidCredentials"));
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AuthDecoration />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={require("../../assets/logo.png")} style={styles.logo} contentFit="contain" />
          </View>

          <Text style={styles.title}>Se connecter</Text>
          <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>

          {/* Card form */}
          <View style={styles.form}>
            <Text style={styles.label}>NUMÉRO DE TÉLÉPHONE</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color={Colors.text3} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="ex : 6 90 00 00 00"
                placeholderTextColor={Colors.text3}
                keyboardType="phone-pad"
                autoComplete="tel"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>MOT DE PASSE</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.text3} style={styles.icon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={Colors.text3}
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={{ padding: 4 }}>
                <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.text3} />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, (loginMutation.isPending || !phone || !password) && styles.btnOff]}
              onPress={() => { setError(""); loginMutation.mutate(); }}
              disabled={loginMutation.isPending || !phone || !password}
              activeOpacity={0.85}
            >
              {loginMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>SE CONNECTER</Text>
              }
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Pas de compte ? </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                <Text style={styles.registerLink}>S'inscrire</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.driverRow}
              onPress={() => router.push("/(driver)/login")}
            >
              <Ionicons name="bicycle-outline" size={16} color={Colors.textDark2} />
              <Text style={styles.driverText}>Accès livreur</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  scroll:    { flexGrow: 1, padding: 28, paddingTop: 48 },
  logoWrap:  { alignItems: "center", marginBottom: 24 },
  logo:      { width: 160, height: 100 },
  title:     { fontSize: 28, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 6 },
  subtitle:  { fontSize: 14, color: Colors.textDark2, textAlign: "center", marginBottom: 36 },
  form:      { gap: 2 },
  label:     { fontSize: 11, fontWeight: "600", color: Colors.textDark2, letterSpacing: 0.8, marginBottom: 8 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.darkInput, borderRadius: Radius.md,
    paddingHorizontal: 14, height: 52,
  },
  icon:  { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 15 },
  error: { color: "#FF6B6B", fontSize: 13, textAlign: "center", marginTop: 8 },
  btn: {
    height: 52, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    marginTop: 28,
    ...Shadow.primary,
  },
  btnOff:    { opacity: 0.55 },
  btnText:   { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 1 },
  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 20 },
  registerText: { color: Colors.textDark2, fontSize: 14 },
  registerLink: { color: Colors.primary, fontWeight: "700", fontSize: 14 },
  driverRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 16, padding: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
  },
  driverText: { color: Colors.textDark2, fontSize: 13, fontWeight: "600" },
});
