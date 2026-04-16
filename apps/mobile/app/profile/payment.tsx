import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useMutation } from "@tanstack/react-query";
import { apiPatch } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";

type PaymentMethod = "orange_money" | "mtn_mobile_money";

const OPERATORS: { id: PaymentMethod; label: string; color: string; bg: string; icon: string }[] = [
  { id: "orange_money",      label: "Orange Money",  color: "#FF6600", bg: "#FFF0E0", icon: "phone-portrait-outline" },
  { id: "mtn_mobile_money",  label: "MTN MoMo",      color: "#FFC107", bg: "#FFFDE7", icon: "phone-portrait-outline" },
];

function detectOperator(phone: string): PaymentMethod | null {
  const digits = phone.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("00237")) local = local.slice(5);
  else if (local.startsWith("237")) local = local.slice(3);
  if (/^69/.test(local) || /^65[5-9]/.test(local) || /^68/.test(local)) return "orange_money";
  if (/^67/.test(local) || /^65[0-4]/.test(local)) return "mtn_mobile_money";
  return null;
}

export default function PaymentScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const savedPhone  = (user as any)?.default_payment_phone  as string | undefined;
  const savedMethod = (user as any)?.default_payment_method as PaymentMethod | undefined;

  const [phone,  setPhone]  = useState(savedPhone  ?? "");
  const [method, setMethod] = useState<PaymentMethod>(savedMethod ?? "orange_money");
  const [edited, setEdited] = useState(false);

  // Auto-detect operator from phone number
  const handlePhoneChange = (v: string) => {
    setPhone(v);
    const detected = detectOperator(v);
    if (detected) setMethod(detected);
    setEdited(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => apiPatch("/users/me/default-payment", { phone: phone.trim(), method }),
    onSuccess: (resp: any) => {
      const data = resp?.data ?? resp;
      if (user) setUser({ ...user, default_payment_phone: data.default_payment_phone ?? phone, default_payment_method: data.default_payment_method ?? method } as any);
      setEdited(false);
      Alert.alert("Succès", "Paiement par défaut enregistré.");
    },
    onError: () => Alert.alert("Erreur", "Impossible d'enregistrer le paiement."),
  });

  const handleSave = () => {
    if (phone.trim().length < 8) {
      Alert.alert("Numéro invalide", "Entrez un numéro Mobile Money valide.");
      return;
    }
    saveMutation.mutate();
  };

  const hasSaved = !!savedPhone;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paiement par défaut</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Current saved payment */}
        {hasSaved && !edited && (
          <View style={styles.savedCard}>
            <View style={styles.savedIconWrap}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedLabel}>Paiement actuel</Text>
              <Text style={styles.savedPhone}>{savedPhone}</Text>
              <Text style={styles.savedMethod}>
                {OPERATORS.find((o) => o.id === savedMethod)?.label ?? savedMethod}
              </Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => setEdited(true)}>
              <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
              <Text style={styles.editBtnText}>Modifier</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#2196F3" />
          <Text style={styles.infoText}>
            Ce numéro sera pré-rempli automatiquement à chaque commande pour vous faire gagner du temps.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Numéro Mobile Money</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>🇨🇲 +237</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="6XXXXXXXX"
              placeholderTextColor={Colors.text3}
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Opérateur</Text>
          <View style={styles.operatorsRow}>
            {OPERATORS.map((op) => (
              <TouchableOpacity
                key={op.id}
                style={[styles.operatorCard, method === op.id && { borderColor: op.color, borderWidth: 2 }]}
                onPress={() => { setMethod(op.id); setEdited(true); }}
                activeOpacity={0.8}
              >
                <View style={[styles.operatorDot, { backgroundColor: op.bg }]}>
                  <Text style={{ fontSize: 20 }}>{op.id === "orange_money" ? "🟠" : "🟡"}</Text>
                </View>
                <Text style={[styles.operatorLabel, method === op.id && { color: op.color }]}>{op.label}</Text>
                {method === op.id && (
                  <Ionicons name="checkmark-circle" size={16} color={op.color} style={{ marginTop: 4 }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!edited || saveMutation.isPending) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!edited || saveMutation.isPending}
        >
          {saveMutation.isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>
                {hasSaved ? "Mettre à jour" : "Enregistrer comme paiement par défaut"}
              </Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  content: { padding: 16, paddingBottom: 40, gap: 14 },

  savedCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 12, ...Shadow.sm,
  },
  savedIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  savedLabel: { fontSize: 11, color: Colors.text3, marginBottom: 2 },
  savedPhone: { fontSize: 16, fontWeight: "700", color: Colors.text },
  savedMethod: { fontSize: 12, color: Colors.text3, marginTop: 1 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryLight },
  editBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },

  infoBanner: {
    flexDirection: "row", gap: 10, backgroundColor: "#E3F2FD",
    borderRadius: Radius.lg, padding: 14, alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 13, color: "#1565C0", lineHeight: 18 },

  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.sm },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  phoneRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  countryCode: { backgroundColor: Colors.inputBg, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 14 },
  countryCodeText: { fontSize: 14, fontWeight: "600", color: Colors.text },
  input: { backgroundColor: Colors.inputBg, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: Colors.text },
  operatorsRow: { flexDirection: "row", gap: 10 },
  operatorCard: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 16,
    backgroundColor: Colors.inputBg, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border, gap: 6,
  },
  operatorDot: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  operatorLabel: { fontSize: 12, fontWeight: "700", color: Colors.text2, textAlign: "center" },

  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
