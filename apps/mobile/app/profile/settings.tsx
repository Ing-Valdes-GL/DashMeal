/**
 * Paramètres utilisateur — /profile/settings
 *
 * - Langue : FR / EN via setLanguage() (persiste dans AsyncStorage)
 * - Notifications : toggles orders + promos (PATCH /users/settings)
 * - Compte : changer le mot de passe
 * - Danger zone : supprimer le compte
 *
 * API:
 *   GET  /users/settings → { language, notifications_orders, notifications_promos }
 *   PATCH /users/settings → { language?, notifications_orders?, notifications_promos? }
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { apiGet, apiDelete, apiPatch } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { setLanguage } from "@/lib/i18n";
import i18n from "@/lib/i18n";
import { useAuthStore } from "@/stores/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserSettings {
  language: "fr" | "en";
  notifications_orders: boolean;
  notifications_promos: boolean;
}

interface SettingsResponse {
  success: boolean;
  data: UserSettings;
}

// ─── Section container ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={section.wrap}>
      <Text style={section.title}>{title.toUpperCase()}</Text>
      <View style={section.card}>{children}</View>
    </View>
  );
}

const section = StyleSheet.create({
  wrap:  { marginBottom: 8 },
  title: { fontSize: 11, fontWeight: "700", color: Colors.text3, letterSpacing: 0.8, marginBottom: 8, paddingLeft: 4 },
  card:  { backgroundColor: Colors.bg, borderRadius: Radius.lg, overflow: "hidden", ...Shadow.sm },
});

// ─── Row components ───────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  iconColor,
  iconBg,
  label,
  sub,
  value,
  onChange,
  isLast,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  iconBg: string;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[rowStyles.row, !isLast && rowStyles.borderBottom]}>
      <View style={[rowStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.label}>{label}</Text>
        {sub && <Text style={rowStyles.sub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
        thumbColor={value ? Colors.primary : Colors.bg}
        ios_backgroundColor={Colors.border}
      />
    </View>
  );
}

function NavRow({
  icon,
  iconColor,
  iconBg,
  label,
  sub,
  onPress,
  isLast,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  iconBg: string;
  label: string;
  sub?: string;
  onPress: () => void;
  isLast?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[rowStyles.row, !isLast && rowStyles.borderBottom]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[rowStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.label, danger && { color: Colors.error }]}>{label}</Text>
        {sub && <Text style={rowStyles.sub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.border} />
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  iconWrap: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontWeight: "500", color: Colors.text },
  sub:   { fontSize: 12, color: Colors.text3, marginTop: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  // ── Load settings ──────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["user-settings"],
    queryFn: () => apiGet("/users/settings"),
    staleTime: 1000 * 60 * 5,
  });

  const remoteSettings = data?.data;

  // Local state (mirrors remote, tracks dirty changes)
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifPromos, setNotifPromos] = useState(true);
  const [currentLang, setCurrentLang] = useState<"fr" | "en">(
    (i18n.language as "fr" | "en") ?? "fr"
  );
  const [dirty, setDirty] = useState(false);

  // Sync when remote data arrives
  useEffect(() => {
    if (remoteSettings) {
      setNotifOrders(remoteSettings.notifications_orders);
      setNotifPromos(remoteSettings.notifications_promos);
      setCurrentLang(remoteSettings.language ?? "fr");
    }
  }, [remoteSettings]);

  // ── Save notifications mutation ────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () =>
      apiPatch("/users/settings", {
        notifications_orders: notifOrders,
        notifications_promos: notifPromos,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      setDirty(false);
      Alert.alert("Succès", "Paramètres de notification enregistrés.");
    },
    onError: () => Alert.alert("Erreur", "Impossible de sauvegarder les paramètres."),
  });

  // ── Delete account ─────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => apiDelete("/users/me"),
    onSuccess: async () => {
      await logout();
      router.replace("/(auth)/login");
    },
    onError: () => Alert.alert("Erreur", "Impossible de supprimer le compte pour l'instant."),
  });

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Supprimer le compte",
      "Cette action est irréversible. Toutes vos données seront supprimées définitivement.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirmation finale",
              "Êtes-vous absolument certain de vouloir supprimer votre compte ?",
              [
                { text: "Non", style: "cancel" },
                { text: "Oui, supprimer", style: "destructive", onPress: () => deleteMutation.mutate() },
              ]
            );
          },
        },
      ]
    );
  };

  // ── Language change ────────────────────────────────────────────────────────
  const handleLanguageChange = async (lang: "fr" | "en") => {
    if (lang === currentLang) return;
    setCurrentLang(lang);
    await setLanguage(lang);
    // Persist preference to backend
    apiPatch("/users/settings", { language: lang }).catch(() => {});
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Language ─────────────────────────────────────────────────── */}
        <Section title="Langue">
          <View style={styles.langRow}>
            <View style={[rowStyles.iconWrap, { backgroundColor: "#E3F2FD" }]}>
              <Ionicons name="language-outline" size={18} color="#2196F3" />
            </View>
            <Text style={[rowStyles.label, { flex: 1 }]}>Langue de l'application</Text>
            <View style={styles.langToggle}>
              {(["fr", "en"] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langBtn,
                    currentLang === lang && styles.langBtnActive,
                  ]}
                  onPress={() => handleLanguageChange(lang)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.langBtnText,
                      currentLang === lang && styles.langBtnTextActive,
                    ]}
                  >
                    {lang === "fr" ? "Français" : "English"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* ── Notifications ─────────────────────────────────────────────── */}
        <Section title="Notifications">
          <ToggleRow
            icon="receipt-outline"
            iconColor="#FF9800"
            iconBg="#FFF3E0"
            label="Commandes"
            sub="Mises à jour du statut de vos commandes"
            value={notifOrders}
            onChange={(v) => { setNotifOrders(v); setDirty(true); }}
          />
          <ToggleRow
            icon="megaphone-outline"
            iconColor="#9C27B0"
            iconBg="#F3E5F5"
            label="Promotions"
            sub="Offres spéciales et nouveaux produits"
            value={notifPromos}
            onChange={(v) => { setNotifPromos(v); setDirty(true); }}
            isLast
          />
        </Section>

        {/* Save button */}
        {dirty && (
          <TouchableOpacity
            style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]}
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            activeOpacity={0.85}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Enregistrer les préférences</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── Account ───────────────────────────────────────────────────── */}
        <Section title="Compte">
          <NavRow
            icon="lock-closed-outline"
            iconColor="#4CAF50"
            iconBg="#E8F5E9"
            label="Changer mon mot de passe"
            sub="Modifier votre mot de passe actuel"
            onPress={() => router.push("/profile/change-password")}
            isLast
          />
        </Section>

        {/* ── Danger zone ───────────────────────────────────────────────── */}
        <Section title="Zone de danger">
          <NavRow
            icon="trash-outline"
            iconColor={Colors.error}
            iconBg="#FFEBEE"
            label="Supprimer mon compte"
            sub="Action irréversible — toutes vos données seront perdues"
            onPress={confirmDeleteAccount}
            danger
            isLast
          />
        </Section>

        {/* Delete loading */}
        {deleteMutation.isPending && (
          <View style={styles.deletingRow}>
            <ActivityIndicator color={Colors.error} size="small" />
            <Text style={styles.deletingText}>Suppression en cours…</Text>
          </View>
        )}

        <Text style={styles.version}>Dash Meal v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:    { padding: 16, paddingBottom: 48 },

  headerSafe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },

  // Language selector
  langRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  langToggle: {
    flexDirection: "column", gap: 6,
  },
  langBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full, backgroundColor: Colors.inputBg,
    borderWidth: 1.5, borderColor: "transparent",
  },
  langBtnActive: {
    backgroundColor: Colors.primaryLight, borderColor: Colors.primary,
  },
  langBtnText: { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  langBtnTextActive: { color: Colors.primary },

  // Save button
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 14, marginBottom: 16, ...Shadow.primary,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Deleting state
  deletingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 12,
  },
  deletingText: { fontSize: 13, color: Colors.error },

  version: { textAlign: "center", color: Colors.text3, fontSize: 12, marginTop: 20 },
});
