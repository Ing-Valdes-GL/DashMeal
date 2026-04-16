import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/auth";
import { apiPost } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";

export default function DriverLoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();

    if (!cleanPhone || !cleanPin) {
      Alert.alert("Champs requis", "Renseignez votre numéro et votre PIN.");
      return;
    }
    if (cleanPin.length < 4) {
      Alert.alert("PIN invalide", "Le PIN doit faire au moins 4 chiffres.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost("/auth/driver/login", { phone: cleanPhone, pin: cleanPin });
      const { access_token, refresh_token, driver } = res.data as {
        access_token: string;
        refresh_token: string;
        driver: { id: string; name: string; phone: string };
      };

      await SecureStore.setItemAsync("dm_user_role", "driver");
      await login({ ...driver, is_verified: true, role: "driver" }, access_token, refresh_token);
      router.replace("/(driver)/deliveries");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Numéro ou PIN incorrect.";
      Alert.alert("Connexion impossible", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="bicycle" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Espace livreur</Text>
          <Text style={styles.subtitle}>Connectez-vous avec votre numéro et PIN fourni par votre admin</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.label}>Numéro de téléphone</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={18} color={Colors.text3} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="+237 6XX XXX XXX"
              placeholderTextColor={Colors.text3}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoComplete="tel"
            />
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>PIN</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.text3} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="••••"
              placeholderTextColor={Colors.text3}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              maxLength={8}
            />
            <TouchableOpacity onPress={() => setShowPin((v) => !v)} style={styles.eyeBtn}>
              <Ionicons
                name={showPin ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={Colors.text3}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Se connecter</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },
  container: { flexGrow: 1, padding: 24, justifyContent: "center" },

  header: { alignItems: "center", marginBottom: 32 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
    ...Shadow.primary,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: Colors.textDark2, textAlign: "center", lineHeight: 20 },

  card: {
    backgroundColor: Colors.darkSurf,
    borderRadius: Radius.xl,
    padding: 24,
    ...Shadow.md,
  },
  label: { fontSize: 13, fontWeight: "600", color: Colors.textDark2, marginBottom: 8 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.darkInput,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
  },
  eyeBtn: { padding: 4 },

  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    ...Shadow.primary,
  },
  btnDisabled: { backgroundColor: Colors.text3 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
