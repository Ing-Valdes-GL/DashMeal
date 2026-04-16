import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";

interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  branches: { name: string; address: string } | null;
}

export default function DriverProfileScreen() {
  const { logout } = useAuthStore();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["driver-profile"],
    queryFn: () => apiGet<{ data: DriverProfile }>("/delivery/me"),
  });

  const profile = data?.data;

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Quitter l'espace livreur ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync("dm_user_role");
          await logout();
          router.replace("/(driver)/login");
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {profile?.name?.slice(0, 2).toUpperCase() ?? "LV"}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.name ?? "—"}</Text>
        <Text style={styles.phone}>{profile?.phone ?? "—"}</Text>
        <View style={[styles.activeBadge, { backgroundColor: profile?.is_active ? "#f0fdf4" : "#fef2f2" }]}>
          <View style={[styles.activeDot, { backgroundColor: profile?.is_active ? Colors.success : Colors.error }]} />
          <Text style={[styles.activeText, { color: profile?.is_active ? Colors.success : Colors.error }]}>
            {profile?.is_active ? "Actif" : "Suspendu"}
          </Text>
        </View>
      </View>

      {/* Info card */}
      <View style={styles.card}>
        {profile?.branches && (
          <>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="storefront-outline" size={16} color={Colors.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.infoLabel}>Agence assignée</Text>
                <Text style={styles.infoValue}>{profile.branches.name}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={16} color={Colors.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.infoLabel}>Adresse agence</Text>
                <Text style={styles.infoValue}>{profile.branches.address}</Text>
              </View>
            </View>
            <View style={styles.divider} />
          </>
        )}
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.infoLabel}>Membre depuis</Text>
            <Text style={styles.infoValue}>
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                : "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  content: { padding: 20, paddingTop: 56, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  avatarSection: { alignItems: "center", marginBottom: 8 },
  avatarCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
    ...Shadow.primary,
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: Colors.primary },
  name: { fontSize: 20, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  phone: { fontSize: 14, color: Colors.text3, marginBottom: 10 },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  activeText: { fontSize: 12, fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.sm,
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  infoIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  flex1: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: "600", color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: "600", color: Colors.text, lineHeight: 20 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 10 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.full,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: Colors.error },
});
