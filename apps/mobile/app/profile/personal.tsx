import { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiPatch, apiGet } from "@/lib/api";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Colors, Radius, Shadow } from "@/lib/theme";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

interface FullProfile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  google_id: string | null;
  apple_id: string | null;
  created_at: string;
  preferred_locale?: string;
}

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery<FullProfile>({
    queryKey: ["me"],
    queryFn: () => apiGet("/users/me").then((r: any) => r?.data ?? r),
    staleTime: 60_000,
  });

  // Form state — synced once from server profile
  const [name,  setName]  = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [edited, setEdited] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Sync once profile loads (server is source of truth)
  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setPhone(profile.phone ?? "");
    setEdited(false);
  }, [profile?.id]); // only re-run if profile identity changes

  const isSocial     = !!(profile?.google_id || profile?.apple_id);
  const provider     = profile?.apple_id ? "Apple" : profile?.google_id ? "Google" : "";
  // Phone is read-only only for verified phone accounts (not social)
  const phoneReadOnly = !isSocial && !!(profile?.phone);
  const hasPhone      = !!(profile?.phone);
  const avatarUrl     = profile?.avatar_url ?? user?.avatar_url;
  const initials      = (profile?.name ?? user?.name ?? "?")
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; phone?: string }) =>
      apiPatch("/users/me", data),
    onSuccess: (resp: any) => {
      const updated: Partial<FullProfile> = resp?.data ?? resp;
      if (user) {
        setUser({
          ...user,
          name:  updated.name  ?? name,
          phone: updated.phone ?? phone,
        } as any);
      }
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setEdited(false);
      Alert.alert(t("common.success"), t("personal.updateSuccess"));
    },
    onError: () => Alert.alert(t("common.error"), t("personal.updateError")),
  });

  const handleSave = () => {
    const trimName  = name.trim();
    const trimPhone = phone.trim().replace(/\s/g, "");

    if (!trimName || trimName.length < 2) {
      Alert.alert(t("personal.invalidName"), t("personal.nameMinLength"));
      return;
    }
    if (!phoneReadOnly && trimPhone) {
      if (!/^\+?[1-9]\d{7,14}$/.test(trimPhone)) {
        Alert.alert(t("common.error"), t("personal.phoneInvalid"));
        return;
      }
    }

    const payload: { name?: string; phone?: string } = {};
    if (trimName  !== (profile?.name  ?? "")) payload.name  = trimName;
    if (!phoneReadOnly && trimPhone !== (profile?.phone ?? "")) payload.phone = trimPhone;
    if (Object.keys(payload).length === 0) { setEdited(false); return; }

    updateMutation.mutate(payload);
  };

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.error"), "Accès à la galerie refusé.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingPhoto(true);
    try {
      const asset  = result.assets[0];
      const token  = await SecureStore.getItemAsync("dm_access_token");
      const form   = new FormData();
      form.append("avatar", { uri: asset.uri, name: "avatar.jpg", type: asset.mimeType ?? "image/jpeg" } as any);

      const base = process.env.EXPO_PUBLIC_API_URL ?? "";
      const resp = await axios.post(`${base}/users/me/avatar`, form, {
        headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` },
      });

      const newUrl: string | undefined = resp.data?.data?.avatar_url;
      if (newUrl) {
        if (user) setUser({ ...user, avatar_url: newUrl } as any);
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    } catch {
      Alert.alert(t("common.error"), t("personal.photoError"));
    } finally {
      setUploadingPhoto(false);
    }
  }, [user, t, queryClient]);

  if (profileLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("personal.title")}</Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("personal.title")}</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Bannière profil incomplet (utilisateurs sociaux sans téléphone) */}
        {isSocial && !hasPhone && (
          <View style={styles.incompleteBanner}>
            <Ionicons name="alert-circle-outline" size={22} color="#b45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.incompleteBannerTitle}>{t("personal.incompleteTitle")}</Text>
              <Text style={styles.incompleteBannerMsg}>{t("personal.incompleteMsg")}</Text>
            </View>
          </View>
        )}

        {/* ── Avatar ───────────────────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
            activeOpacity={0.8}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              {uploadingPhoto
                ? <ActivityIndicator size={13} color="#fff" />
                : <Ionicons name="camera" size={15} color="#fff" />}
            </View>
          </TouchableOpacity>

          <Text style={styles.changePhotoLabel}>
            {uploadingPhoto ? t("personal.uploadingPhoto") : t("personal.changePhoto")}
          </Text>

          <View style={styles.badgeRow}>
            {profile?.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.verifiedText}>{t("personal.verified")}</Text>
              </View>
            )}
            {isSocial && provider ? (
              <View style={styles.socialBadge}>
                <Ionicons
                  name={provider === "Apple" ? "logo-apple" : "logo-google"}
                  size={13}
                  color={Colors.text3}
                />
                <Text style={styles.socialBadgeText}>
                  {t("personal.socialLinked")} {provider}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Formulaire ────────────────────────────────────────────────────── */}
        <View style={styles.card}>

          {/* Nom complet */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("personal.fullName")}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(v) => { setName(v); setEdited(true); }}
              placeholder={t("personal.namePh")}
              placeholderTextColor={Colors.text3}
              autoCapitalize="words"
              maxLength={100}
            />
          </View>

          <View style={styles.divider} />

          {/* Email (lecture seule) */}
          {profile?.email ? (
            <>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t("personal.emailAddress")}</Text>
                <View style={styles.readonlyWrap}>
                  <Ionicons name="mail-outline" size={17} color={Colors.text3} />
                  <Text style={styles.readonlyText} numberOfLines={1}>{profile.email}</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{t("personal.emailReadOnly")}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.divider} />
            </>
          ) : null}

          {/* Téléphone */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("personal.phoneNumber")}</Text>

            {phoneReadOnly ? (
              <>
                <View style={styles.readonlyWrap}>
                  <Ionicons name="call-outline" size={17} color={Colors.text3} />
                  <Text style={styles.readonlyText}>{profile?.phone ?? "—"}</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{t("personal.notEditable")}</Text>
                  </View>
                </View>
                <Text style={styles.hint}>{t("personal.phoneHint")}</Text>
              </>
            ) : (
              <>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="call-outline" size={17} color={Colors.text3} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: "transparent" }]}
                    value={phone}
                    onChangeText={(v) => { setPhone(v); setEdited(true); }}
                    placeholder={t("personal.phonePh")}
                    placeholderTextColor={Colors.text3}
                    keyboardType="phone-pad"
                    maxLength={20}
                  />
                </View>
                <Text style={styles.hint}>{t("personal.phoneEditHint")}</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Infos compte ──────────────────────────────────────────────────── */}
        <View style={[styles.card, { marginTop: 12 }]}>
          {/* Membre depuis */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="calendar-outline" size={17} color={Colors.text3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoRowLabel}>{t("personal.memberSince")}</Text>
              <Text style={styles.infoRowValue}>
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
                  : "—"}
              </Text>
            </View>
          </View>

          {/* Langue préférée */}
          {profile?.preferred_locale ? (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="language-outline" size={17} color={Colors.text3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowLabel}>Langue</Text>
                  <Text style={styles.infoRowValue}>
                    {profile.preferred_locale === "fr" ? "Français" : "English"}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* ── Bouton Enregistrer ────────────────────────────────────────────── */}
        {edited && (
          <TouchableOpacity
            style={[styles.saveBtn, updateMutation.isPending && styles.saveBtnOff]}
            onPress={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>{t("personal.saveChanges")}</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.pageBg },
  safe:       { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  content: { padding: 16, paddingBottom: 48 },

  // ─── Incomplete banner
  incompleteBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fef9c3", borderRadius: Radius.md,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#fde68a",
  },
  incompleteBannerTitle: { fontSize: 13, fontWeight: "700", color: "#92400e", marginBottom: 3 },
  incompleteBannerMsg:   { fontSize: 12, color: "#78350f", lineHeight: 17 },

  // ─── Avatar
  avatarSection: { alignItems: "center", paddingTop: 8, paddingBottom: 20, gap: 10 },
  avatarWrap:    { width: 96, height: 96, position: "relative" },
  avatarImg: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: Colors.primary,
  },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "#FFE8D9",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: Colors.primary,
  },
  avatarInitials: { fontSize: 32, fontWeight: "800", color: Colors.primary },
  cameraOverlay: {
    position: "absolute", bottom: 1, right: 1,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.bg,
  },
  changePhotoLabel: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText:  { fontSize: 12, color: Colors.success, fontWeight: "600" },
  socialBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.inputBg, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  socialBadgeText: { fontSize: 11, color: Colors.text3, fontWeight: "600" },

  // ─── Card / form
  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 16, ...Shadow.sm },
  field: { gap: 7 },
  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: Colors.text3,
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.text,
  },
  inputWithIcon: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.inputBg, borderRadius: Radius.md,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 14 },

  // ─── Read-only fields
  readonlyWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 4,
  },
  readonlyText:  { flex: 1, fontSize: 15, color: Colors.text2 },
  pill: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontSize: 11, color: Colors.text3, fontWeight: "600" },
  hint: { fontSize: 11, color: Colors.text3, fontStyle: "italic" },

  // ─── Info rows (below the form)
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.inputBg,
    alignItems: "center", justifyContent: "center",
  },
  infoRowLabel: { fontSize: 11, color: Colors.text3, marginBottom: 2 },
  infoRowValue: { fontSize: 14, fontWeight: "600", color: Colors.text },

  // ─── Save button
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: "center", marginTop: 20,
  },
  saveBtnOff:  { backgroundColor: Colors.border },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
