import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { apiPost } from "@/lib/api";
import { Colors, Radius } from "@/lib/theme";

type Mode = "email" | "phone";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login } = useAuthStore();

  const [mode, setMode] = useState<Mode>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    if (!identifier.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    try {
      const payload = mode === "email"
        ? { email: identifier.trim(), password }
        : { phone: identifier.trim(), password };
      const res = await apiPost("/auth/user/login", payload);
      const { user, access_token, refresh_token } = res.data;
      await SecureStore.setItemAsync("dm_access_token", access_token);
      await SecureStore.setItemAsync("dm_refresh_token", refresh_token);
      login(user, access_token, refresh_token);
      router.replace("/(tabs)");
    } catch (e: any) {
      const code = e?.response?.data?.error?.code;
      if (code === "EMAIL_NOT_VERIFIED") {
        router.push({ pathname: "/(auth)/otp", params: { identifier, via: "email" } });
        return;
      }
      if (code === "PHONE_NOT_VERIFIED") {
        router.push({ pathname: "/(auth)/otp", params: { identifier, via: "phone" } });
        return;
      }
      setError(e?.response?.data?.error?.message ?? t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <StatusBar style="dark" />
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={s.content}>
          <Text style={s.title}>Loging</Text>
          <Text style={s.sub}>Entrez votre email et mot de passe</Text>

          {/* Mode toggle */}
          <View style={s.toggle}>
            {(["email", "phone"] as Mode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.toggleBtn, mode === m && s.toggleBtnActive]}
                onPress={() => { setMode(m); setIdentifier(""); setError(""); }}
              >
                <Text style={[s.toggleText, mode === m && s.toggleTextActive]}>
                  {m === "email" ? "Email" : "Téléphone"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>{mode === "email" ? "Email" : "Téléphone"}</Text>
          <View style={s.inputWrap}>
            <Ionicons name={mode === "email" ? "mail-outline" : "call-outline"} size={18} color={Colors.text3} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder={mode === "email" ? "imshuvo97@gmail.com" : "+237 6XX XXX XXX"}
              placeholderTextColor={Colors.text3}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType={mode === "email" ? "email-address" : "phone-pad"}
              autoCapitalize="none"
            />
          </View>

          <Text style={s.label}>Mot de passe</Text>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.text3} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.text3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
            />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={s.eyeBtn}>
              <Ionicons name={showPwd ? "eye" : "eye-off-outline"} size={18} color={Colors.text3} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.forgotRow}>
            <Text style={s.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Log In</Text>}
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>Or connect with social media</Text>
            <View style={s.divLine} />
          </View>

          <TouchableOpacity style={s.socialBtn} onPress={() => Alert.alert("Google", "Bientôt disponible")}>
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={s.socialText}>Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.socialBtn, { borderColor: "#1877F2" }]} onPress={() => Alert.alert("Facebook", "Bientôt disponible")}>
            <Ionicons name="logo-facebook" size={20} color="#1877F2" />
            <Text style={[s.socialText, { color: "#1877F2" }]}>Continue with Facebook</Text>
          </TouchableOpacity>

          <View style={s.regRow}>
            <Text style={s.regText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={s.regLink}>Signup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  back: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  sub: { fontSize: 14, color: Colors.text2, marginBottom: 24, lineHeight: 22 },
  toggle: { flexDirection: "row", backgroundColor: Colors.pageBg, borderRadius: Radius.md, padding: 4, marginBottom: 24, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.sm, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 13, fontWeight: "600", color: Colors.text3 },
  toggleTextActive: { color: Colors.primary },
  label: { fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 8 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.pageBg, borderRadius: Radius.lg,
    marginBottom: 18, paddingHorizontal: 16, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: Colors.text },
  eyeBtn: { padding: 4 },
  forgotRow: { alignItems: "flex-end", marginBottom: 24, marginTop: -8 },
  forgotText: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  errorText: { fontSize: 13, color: Colors.error, marginBottom: 12, textAlign: "center" },
  btn: {
    height: 67, borderRadius: Radius.full, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: 12, color: Colors.text3 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    height: 52, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: "#EA4335", marginBottom: 14,
  },
  socialText: { fontSize: 14, fontWeight: "600", color: "#EA4335" },
  regRow: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  regText: { fontSize: 14, color: Colors.text2 },
  regLink: { fontSize: 14, color: Colors.primary, fontWeight: "700" },
});
