import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [edited, setEdited] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => apiPatch("/users/me", data),
    onSuccess: (resp: any) => {
      const updated = resp?.data ?? resp;
      if (user) setUser({ ...user, name: updated.name ?? name } as any);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setEdited(false);
      Alert.alert("Succès", "Informations mises à jour.");
    },
    onError: () => Alert.alert("Erreur", "Impossible de mettre à jour le profil."),
  });

  const handleSave = () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert("Nom invalide", "Le nom doit contenir au moins 2 caractères.");
      return;
    }
    updateMutation.mutate({ name: name.trim() });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Informations personnelles</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar initials display */}
        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.name ?? "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </Text>
          </View>
          {user?.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
              <Text style={styles.verifiedText}>Compte vérifié</Text>
            </View>
          )}
        </View>

        {/* Form */}
        <View style={styles.card}>
          {/* Nom */}
          <View style={styles.field}>
            <Text style={styles.label}>Nom complet</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(v) => { setName(v); setEdited(v.trim() !== user?.name); }}
              placeholder="Votre nom"
              placeholderTextColor={Colors.text3}
              autoCapitalize="words"
              maxLength={100}
            />
          </View>

          <View style={styles.divider} />

          {/* Téléphone (lecture seule) */}
          <View style={styles.field}>
            <Text style={styles.label}>Numéro de téléphone</Text>
            <View style={styles.readonlyRow}>
              <Text style={styles.readonlyValue}>{user?.phone ?? "—"}</Text>
              <View style={styles.readonlyBadge}>
                <Text style={styles.readonlyBadgeText}>Non modifiable</Text>
              </View>
            </View>
            <Text style={styles.hint}>Le numéro est lié à votre compte via OTP</Text>
          </View>
        </View>

        {/* Membre depuis */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={16} color={Colors.text3} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Membre depuis</Text>
              <Text style={styles.infoValue}>
                {(user as any)?.created_at
                  ? new Date((user as any).created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
                  : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Save button */}
        {edited && (
          <TouchableOpacity
            style={[styles.saveBtn, updateMutation.isPending && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
            }
          </TouchableOpacity>
        )}
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
  backBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  content: { padding: 16, paddingBottom: 40 },
  avatarRow: { alignItems: "center", paddingVertical: 24, gap: 10 },
  avatarCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "#FFE8D9", alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: Colors.primary,
  },
  avatarText: { fontSize: 26, fontWeight: "700", color: Colors.primary },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontSize: 12, color: Colors.success, fontWeight: "500" },
  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.sm },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: "700", color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 14 },
  readonlyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  readonlyValue: { flex: 1, fontSize: 15, color: Colors.text2, paddingVertical: 12 },
  readonlyBadge: { backgroundColor: Colors.inputBg, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  readonlyBadgeText: { fontSize: 11, color: Colors.text3, fontWeight: "600" },
  hint: { fontSize: 11, color: Colors.text3, fontStyle: "italic" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, color: Colors.text3, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: "600", color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
