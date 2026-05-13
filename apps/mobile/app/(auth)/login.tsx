import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { apiPost } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type Mode = "email" | "phone";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login } = useAuthStore();

  const [mode, setMode]           = useState<Mode>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]   = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]         = useState("");

  // Google OAuth via expo-auth-session
  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "dashmeal", path: "auth" });

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
    },
    discovery,
  );

  const handleGoogleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert("Configuration manquante", "Google Client ID non configuré. Ajoutez EXPO_PUBLIC_GOOGLE_CLIENT_ID dans .env.local");
      return;
    }
    setGoogleLoading(true);
    setError("");
    try {
      const result = await promptAsync();
      if (result?.type === "success") {
        const { id_token } = result.params;
        const res = await apiPost("/auth/user/google", { id_token });
        const { user, tokens } = res.data;
        await SecureStore.setItemAsync("dm_access_token", tokens.access_token);
        await SecureStore.setItemAsync("dm_refresh_token", tokens.refresh_token);
        login(user, tokens.access_token, tokens.refresh_token);
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Connexion Google échouée. Réessayez.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    setError("");
    if (!identifier.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    try {
      const normalizedIdentifier = mode === "email"
        ? identifier.trim().toLowerCase()
        : identifier.trim();
      const payload = { identifier: normalizedIdentifier, password };
      const res = await apiPost("/auth/user/login", payload);
      const { user, tokens } = res.data;
      await SecureStore.setItemAsync("dm_access_token", tokens.access_token);
      await SecureStore.setItemAsync("dm_refresh_token", tokens.refresh_token);
      login(user, tokens.access_token, tokens.refresh_token);
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
      setError(e?.response?.data?.error?.message ?? "Identifiants incorrects. Réessayez.");
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
          <Text style={s.title}>Connexion</Text>
          <Text style={s.sub}>Entrez vos identifiants</Text>

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

          <Text style={s.label}>{mode === "email" ? "Adresse email" : "Numéro de téléphone"}</Text>
          <View style={s.inputWrap}>
            <Ionicons name={mode === "email" ? "mail-outline" : "call-outline"} size={18} color={Colors.text3} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder={mode === "email" ? "exemple@email.com" : "+237 6XX XXX XXX"}
              placeholderTextColor={Colors.text3}
              value={identifier}
              onChangeText={(v) => { setIdentifier(v); setError(""); }}
              keyboardType={mode === "email" ? "email-address" : "phone-pad"}
              autoCapitalize="none"
              autoComplete={mode === "email" ? "email" : "tel"}
            />
          </View>

          <Text style={[s.label, { marginTop: 14 }]}>Mot de passe</Text>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.text3} style={s.inputIcon} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor={Colors.text3}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(""); }}
              secureTextEntry={!showPwd}
            />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={s.eyeBtn}>
              <Ionicons name={showPwd ? "eye" : "eye-off-outline"} size={18} color={Colors.text3} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.forgotRow}>
            <Text style={s.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Se connecter</Text>}
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>ou continuer avec</Text>
            <View style={s.divLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={s.googleBtn}
            onPress={handleGoogleLogin}
            disabled={googleLoading || !request}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={Colors.text} size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text style={s.googleText}>Continuer avec Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={s.regRow}>
            <Text style={s.regText}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={s.regLink}>S'inscrire</Text>
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
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.pageBg, borderRadius: Radius.lg, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: Colors.border },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  eyeBtn: { padding: 4 },

  forgotRow: { alignSelf: "flex-end", marginTop: 10, marginBottom: 4 },
  forgotText: { fontSize: 13, color: Colors.primary, fontWeight: "600" },

  errorText: { color: Colors.error, fontSize: 13, marginTop: 8, textAlign: "center" },

  btn: { height: 56, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 20, ...Shadow.primary },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: 12, color: Colors.text3, fontWeight: "500" },

  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, height: 56, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  googleText: { fontSize: 15, fontWeight: "600", color: Colors.text },

  regRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24 },
  regText: { color: Colors.text2, fontSize: 14 },
  regLink: { color: Colors.primary, fontWeight: "700", fontSize: 14 },
});
