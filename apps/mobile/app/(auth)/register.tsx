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
import { StatusBar } from "expo-status-bar";
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
      router.push({ pathname: "/(auth)/otp", params: { phone } });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message;
      if (!err?.response) setError("Impossible de joindre le serveur");
      else setError(msg ?? t("common.error"));
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AuthDecoration />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Inscrivez-vous pour commencer</Text>

          <View style={styles.form}>
            {/* Name */}
            <Text style={styles.label}>NOM COMPLET</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.text3} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Jean Dupont"
                placeholderTextColor={Colors.text3}
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>NUMÉRO DE TÉLÉPHONE</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color={Colors.text3} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="ex : 6 90 00 00 00"
                placeholderTextColor={Colors.text3}
                keyboardType="phone-pad"
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
              style={[styles.btn, registerMutation.isPending && styles.btnOff]}
              onPress={() => { setError(""); registerMutation.mutate(); }}
              disabled={registerMutation.isPending || !name || !phone || !password}
              activeOpacity={0.85}
            >
              {registerMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>S'INSCRIRE</Text>
              }
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Déjà un compte ? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  scroll:    { flexGrow: 1, padding: 28, paddingTop: 56 },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center", marginBottom: 32,
  },
  title:    { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textDark2, marginBottom: 32 },
  form:     { gap: 2 },
  label:    { fontSize: 11, fontWeight: "600", color: Colors.textDark2, letterSpacing: 0.8, marginBottom: 8 },
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
  btnOff:   { opacity: 0.55 },
  btnText:  { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 1 },
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 20 },
  loginText: { color: Colors.textDark2, fontSize: 14 },
  loginLink: { color: Colors.primary, fontWeight: "700", fontSize: 14 },
});
