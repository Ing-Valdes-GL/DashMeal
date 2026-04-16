import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPostForm } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import i18n from "@/lib/i18n";
import { Colors, Radius, Shadow } from "@/lib/theme";

interface MenuItem {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  iconBg: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();

  const { data: ordersResp } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["my-orders"],
    queryFn: () => apiGet("/orders/my-orders"),
    staleTime: 1000 * 60,
  });
  const orderCount = ordersResp?.data?.length ?? 0;

  const { data: favResp } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["my-favorites"],
    queryFn: () => apiGet("/users/me/favorites"),
    staleTime: 1000 * 60 * 5,
  });
  const favCount = favResp?.data?.length ?? 0;

  // ── Upload avatar ──────────────────────────────────────────────────────────
  const avatarMutation = useMutation({
    mutationFn: async (uri: string) => {
      const formData = new FormData();
      const filename = uri.split("/").pop() ?? "avatar.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      formData.append("avatar", { uri, name: filename, type: mime } as any);
      return apiPostForm("/users/me/avatar", formData);
    },
    onSuccess: (resp: any) => {
      const avatar_url = resp?.data?.avatar_url ?? resp?.avatar_url;
      if (avatar_url && user) setUser({ ...user, avatar_url } as any);
    },
    onError: () => Alert.alert("Erreur", "Impossible de mettre à jour la photo."),
  });

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Autorisez l'accès à votre galerie dans les paramètres.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      avatarMutation.mutate(result.assets[0].uri);
    }
  };

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnexion", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
    ]);
  };

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: "Mon compte",
      items: [
        { icon: "person-outline",   iconColor: "#FF7A2F", iconBg: "#FFF0E8", label: "Informations personnelles", onPress: () => router.push("/profile/personal") },
        { icon: "location-outline", iconColor: "#2196F3", iconBg: "#E3F2FD", label: "Mes adresses",              onPress: () => router.push("/profile/addresses") },
        { icon: "card-outline",     iconColor: "#4CAF50", iconBg: "#E8F5E9", label: "Paiement par défaut",        onPress: () => router.push("/profile/payment") },
      ],
    },
    {
      title: "Activité",
      items: [
        { icon: "receipt-outline",       iconColor: "#9C27B0", iconBg: "#F3E5F5", label: "Mes commandes",   onPress: () => router.push("/(tabs)/orders") },
        { icon: "heart-outline",         iconColor: "#E91E63", iconBg: "#FCE4EC", label: "Mes favoris",     onPress: () => router.push("/profile/favorites") },
        { icon: "notifications-outline", iconColor: "#FF9800", iconBg: "#FFF3E0", label: "Notifications",   onPress: () => {} },
      ],
    },
    {
      title: "Aide & Support",
      items: [
        { icon: "help-circle-outline", iconColor: "#00BCD4", iconBg: "#E0F7FA", label: "FAQ",        onPress: () => {} },
        { icon: "settings-outline",    iconColor: "#795548", iconBg: "#EFEBE9", label: "Paramètres", onPress: () => {} },
      ],
    },
    {
      title: "",
      items: [
        { icon: "log-out-outline", iconColor: Colors.error, iconBg: "#FFEBEE", label: "Se déconnecter", onPress: handleLogout, danger: true },
      ],
    },
  ];

  const avatarUrl = (user as any)?.avatar_url as string | undefined;
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* Avatar & infos */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.85}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.editAvatarBtn}>
              {avatarMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera-outline" size={14} color="#fff" />
              }
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{user?.name ?? "Utilisateur"}</Text>
          <Text style={styles.phone}>{user?.phone ?? ""}</Text>
          {user?.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
              <Text style={styles.verifiedText}>Compte vérifié</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{orderCount}</Text>
            <Text style={styles.statLabel}>Commandes</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{favCount}</Text>
            <Text style={styles.statLabel}>Favoris</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>0 pts</Text>
            <Text style={styles.statLabel}>Fidélité</Text>
          </View>
        </View>

        {/* Langue */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <View style={styles.langCard}>
            <View style={styles.langIcon}>
              <Ionicons name="language-outline" size={18} color="#2196F3" />
            </View>
            <Text style={styles.langLabel}>Langue</Text>
            <View style={styles.langToggle}>
              {(["fr", "en"] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langBtn, i18n.language === lang && styles.langBtnActive]}
                  onPress={() => i18n.changeLanguage(lang)}
                >
                  <Text style={[styles.langBtnText, i18n.language === lang && styles.langBtnTextActive]}>
                    {lang.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Menu sections */}
        {menuSections.map((section, si) => (
          <View key={si} style={styles.section}>
            {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
            <View style={styles.menuCard}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuRow, i < section.items.length - 1 && styles.menuRowBorder]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon} size={18} color={item.iconColor} />
                  </View>
                  <Text style={[styles.menuLabel, item.danger && { color: Colors.error }]}>
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.version}>Dash Meal v1.0.0</Text>
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  avatarSection: { alignItems: "center", paddingVertical: 24, backgroundColor: Colors.bg },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: Colors.primary },
  avatarFallback: { backgroundColor: "#FFE8D9", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 30, fontWeight: "700", color: Colors.primary },
  editAvatarBtn: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.bg,
  },
  name:  { fontSize: 20, fontWeight: "700", color: Colors.text, marginBottom: 4 },
  phone: { fontSize: 14, color: Colors.text2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  verifiedText:  { fontSize: 12, color: Colors.success, fontWeight: "500" },
  statsCard: {
    flexDirection: "row", marginHorizontal: 16, marginTop: 16,
    backgroundColor: Colors.card, borderRadius: Radius.lg, paddingVertical: 16, ...Shadow.sm,
  },
  stat:      { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.text3 },
  statDiv:   { width: 1, backgroundColor: Colors.divider },
  section: { marginTop: 12, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: Colors.text3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 },
  langCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 14, ...Shadow.sm,
  },
  langIcon: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: "#E3F2FD", alignItems: "center", justifyContent: "center" },
  langLabel: { flex: 1, fontSize: 14, fontWeight: "500", color: Colors.text },
  langToggle: { flexDirection: "row", gap: 4 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.inputBg },
  langBtnActive: { backgroundColor: Colors.primary },
  langBtnText:       { fontSize: 12, fontWeight: "700", color: Colors.text2 },
  langBtnTextActive: { color: "#fff" },
  menuCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, overflow: "hidden", ...Shadow.sm },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, gap: 14 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  menuIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "500", color: Colors.text },
  version: { textAlign: "center", color: Colors.border, fontSize: 12, marginTop: 24, marginBottom: 8 },
});
