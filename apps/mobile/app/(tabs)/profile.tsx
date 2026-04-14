import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import i18n from "@/lib/i18n";

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  rightEl?: React.ReactNode;
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      t("profile.logout"),
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.logout"), style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: "Compte",
      items: [
        { icon: "person-outline", label: t("profile.name"), onPress: () => {} },
        { icon: "receipt-outline", label: t("profile.orderHistory"), onPress: () => router.push("/(tabs)/orders") },
        { icon: "location-outline", label: t("profile.addresses"), onPress: () => {} },
      ],
    },
    {
      title: "Préférences",
      items: [
        {
          icon: "language-outline",
          label: t("profile.language"),
          onPress: () => {},
          rightEl: (
            <View style={styles.langToggle}>
              <TouchableOpacity
                onPress={() => switchLang("fr")}
                style={[styles.langBtn, i18n.language === "fr" && styles.langBtnActive]}
              >
                <Text style={[styles.langText, i18n.language === "fr" && styles.langTextActive]}>FR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => switchLang("en")}
                style={[styles.langBtn, i18n.language === "en" && styles.langBtnActive]}
              >
                <Text style={[styles.langText, i18n.language === "en" && styles.langTextActive]}>EN</Text>
              </TouchableOpacity>
            </View>
          ),
        },
        { icon: "notifications-outline", label: t("profile.notifications"), onPress: () => {} },
      ],
    },
    {
      title: "Sécurité",
      items: [
        { icon: "shield-outline", label: "Changer le mot de passe", onPress: () => {} },
        { icon: "log-out-outline", label: t("profile.logout"), onPress: handleLogout, danger: true },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name ?? "Utilisateur"}</Text>
          <Text style={styles.phone}>{user?.phone ?? ""}</Text>
          {user?.is_verified && (
            <View style={styles.verified}>
              <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
              <Text style={styles.verifiedText}>Vérifié</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Commandes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0 pts</Text>
            <Text style={styles.statLabel}>Fidélité</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Adresses</Text>
          </View>
        </View>

        {/* Menu sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuItem, i < section.items.length - 1 && styles.menuItemBorder]}
                  onPress={item.onPress}
                >
                  <View style={[styles.menuIcon, item.danger && styles.menuIconDanger]}>
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={item.danger ? "#ef4444" : "#94a3b8"}
                    />
                  </View>
                  <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>
                    {item.label}
                  </Text>
                  {item.rightEl ? item.rightEl : (
                    <Ionicons name="chevron-forward" size={14} color="#334155" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* App version */}
        <Text style={styles.version}>Dash Meal v1.0.0</Text>
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  header: { alignItems: "center", paddingTop: 24, paddingBottom: 20, paddingHorizontal: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 2, borderColor: "rgba(249,115,22,0.4)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#f97316" },
  name: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 4 },
  phone: { fontSize: 14, color: "#475569" },
  verified: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  verifiedText: { fontSize: 12, color: "#22c55e", fontWeight: "500" },
  stats: {
    flexDirection: "row", marginHorizontal: 20, marginBottom: 8,
    backgroundColor: "#0f172a", borderRadius: 16, borderWidth: 1, borderColor: "#1e293b",
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 2 },
  statLabel: { fontSize: 11, color: "#475569" },
  statDivider: { width: 1, backgroundColor: "#1e293b" },
  section: { marginTop: 16, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "600", color: "#334155", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 2 },
  sectionCard: { backgroundColor: "#0f172a", borderRadius: 16, borderWidth: 1, borderColor: "#1e293b", overflow: "hidden" },
  menuItem: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, gap: 12,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center",
  },
  menuIconDanger: { backgroundColor: "rgba(239,68,68,0.15)" },
  menuLabel: { flex: 1, fontSize: 14, color: "#e2e8f0", fontWeight: "500" },
  menuLabelDanger: { color: "#ef4444" },
  langToggle: { flexDirection: "row", gap: 4 },
  langBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  langBtnActive: { backgroundColor: "rgba(249,115,22,0.2)", borderWidth: 1, borderColor: "#f97316" },
  langText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  langTextActive: { color: "#f97316" },
  version: { textAlign: "center", color: "#1e293b", fontSize: 12, marginTop: 24 },
});
