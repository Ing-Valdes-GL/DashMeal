import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
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
  c1:     { width: 300, height: 300, top: -120, right: -80, backgroundColor: "rgba(83,177,117,0.06)", borderColor: "rgba(83,177,117,0.12)" },
  c2:     { width: 180, height: 180, top: 60,   right: -50, backgroundColor: "transparent", borderColor: "rgba(83,177,117,0.08)" },
});

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [error, setError] = useState("");

  const handleSocial = (provider: "google" | "apple") => {
    const name = provider === "google" ? "Google" : "Apple";
    Alert.alert(t("auth.comingSoon"), t("auth.comingSoonMsg", { provider: name }));
  };

  const registerMutation = useMutation({
    mutationFn: () => {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      return apiPost<{ data: { otp_code?: string } }>("/auth/user/register", {
        name,
        email: email.trim().toLowerCase(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
    },
    onSuccess: (res) => {
      router.push({
        pathname: "/(auth)/otp",
        params: { identifier: email.trim().toLowerCase(), via: "email", prefill: res.data.otp_code ?? "" },
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message;
      if (!err?.response) setError(t("auth.serverError"));
      else setError(msg ?? t("auth.genericError"));
    },
  });

  const validate = (): boolean => {
    if (!firstName.trim() || !lastName.trim()) { setError(t("auth.nameRequired")); return false; }
    if (!email.trim() || !email.includes("@")) { setError(t("auth.emailInvalid")); return false; }
    if (password.length < 8) { setError(t("auth.passwordTooShort")); return false; }
    if (password !== confirm) { setError(t("auth.passwordMismatch")); return false; }
    if (!acceptedTos) { setError(t("auth.tosRequired")); return false; }
    return true;
  };

  const handleSubmit = () => {
    setError("");
    if (!validate()) return;
    registerMutation.mutate();
  };

  const canSubmit = firstName.trim() && lastName.trim() && email.trim() && password && confirm && acceptedTos;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <AuthDecoration />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.title}>{t("auth.registerTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.registerSubtitle")}</Text>

          {/* Social */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocial("google")} activeOpacity={0.8}>
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocial("apple")} activeOpacity={0.8}>
              <Ionicons name="logo-apple" size={18} color="#fff" />
              <Text style={styles.socialText}>Apple</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("auth.orCreate")}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name row */}
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t("auth.firstName").toUpperCase()}</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={16} color={Colors.text3} style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.firstNamePh")}
                    placeholderTextColor={Colors.text3}
                    autoCapitalize="words"
                    value={firstName}
                    onChangeText={(v) => { setFirstName(v); setError(""); }}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t("auth.lastName").toUpperCase()}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.lastNamePh")}
                    placeholderTextColor={Colors.text3}
                    autoCapitalize="words"
                    value={lastName}
                    onChangeText={(v) => { setLastName(v); setError(""); }}
                  />
                </View>
              </View>
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>EMAIL <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={Colors.text3} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={t("auth.emailPh")}
                placeholderTextColor={Colors.text3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(v) => { setEmail(v); setError(""); }}
              />
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>{t("auth.phone").toUpperCase()} <Text style={styles.optional}>{t("common.optional")}</Text></Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color={Colors.text3} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={t("auth.phonePh")}
                placeholderTextColor={Colors.text3}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(v) => { setPhone(v); setError(""); }}
              />
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>{t("auth.password").toUpperCase()} <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.text3} style={styles.icon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={t("auth.passwordMin")}
                placeholderTextColor={Colors.text3}
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(""); }}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={{ padding: 4 }}>
                <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.text3} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>{t("auth.confirmPassword").toUpperCase()}</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.text3} style={styles.icon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor={Colors.text3}
                secureTextEntry={!showConfirm}
                value={confirm}
                onChangeText={(v) => { setConfirm(v); setError(""); }}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={{ padding: 4 }}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.text3} />
              </TouchableOpacity>
            </View>

            {/* Password strength indicator */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1,2,3,4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      password.length >= i * 2
                        ? password.length >= 8
                          ? { backgroundColor: Colors.success }
                          : { backgroundColor: Colors.warning }
                        : {},
                    ]}
                  />
                ))}
                <Text style={styles.strengthLabel}>
                  {password.length < 4 ? t("auth.passwordWeak") : password.length < 8 ? t("auth.passwordMedium") : t("auth.passwordStrong")}
                </Text>
              </View>
            )}

            {/* ToS checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAcceptedTos(!acceptedTos)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acceptedTos && styles.checkboxChecked]}>
                {acceptedTos && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.checkboxText}>
                {t("auth.tosAccept")}{" "}
                <Text style={styles.link} onPress={() => {}}>{t("auth.tosLink")}</Text>
                {" "}{t("auth.tosAnd")}{" "}
                <Text style={styles.link} onPress={() => {}}>{t("auth.privacyLink")}</Text>
              </Text>
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, (!canSubmit || registerMutation.isPending) && styles.btnOff]}
              onPress={handleSubmit}
              disabled={!canSubmit || registerMutation.isPending}
              activeOpacity={0.85}
            >
              {registerMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{t("auth.createBtn")}</Text>
              }
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>{t("auth.hasAccount")} </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Text style={styles.loginLink}>{t("auth.loginButton")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll:    { flexGrow: 1, padding: 24, paddingTop: 52 },

  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.pageBg,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  title:    { fontSize: 26, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.text2, marginBottom: 24 },

  // Social
  socialRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  socialBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 46, borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  socialIcon: { fontSize: 18, fontWeight: "800", color: Colors.text },
  socialText: { color: Colors.text, fontSize: 14, fontWeight: "600" },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.text2, fontSize: 12 },

  // Form
  form:    { gap: 2 },
  nameRow: { flexDirection: "row", gap: 12 },
  label:   { fontSize: 11, fontWeight: "600", color: Colors.text2, letterSpacing: 0.8, marginBottom: 8 },
  required: { color: Colors.primary },
  optional: { color: Colors.text3, fontWeight: "400", fontSize: 10, letterSpacing: 0 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 50,
  },
  icon:  { marginRight: 10 },
  input: { flex: 1, color: Colors.text, fontSize: 15 },

  // Password strength
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  strengthBar: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
  },
  strengthLabel: { fontSize: 11, color: Colors.text2, minWidth: 36 },

  // Checkbox
  checkboxRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    marginTop: 18, marginBottom: 4,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.pageBg,
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxText: { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 19 },
  link: { color: Colors.primary, textDecorationLine: "underline" },

  error: { color: "#EF4444", fontSize: 13, textAlign: "center", marginTop: 8 },

  btn: {
    height: 52, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    marginTop: 20, ...Shadow.primary,
  },
  btnOff:  { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 1 },

  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 20, marginBottom: 16 },
  loginText: { color: Colors.text2, fontSize: 14 },
  loginLink: { color: Colors.primary, fontWeight: "700", fontSize: 14 },
});
