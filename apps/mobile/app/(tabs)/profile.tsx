import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { useState } from "react";

interface MenuItem {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  route?: string;
  toggle?: boolean;
  danger?: boolean;
  badge?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isAuthenticated, isGuest, logout } = useAuthStore();
  const [notifications, setNotifications] = useState(true);

  const MENU: MenuItem[][] = [
    [
      { key: "orders",   icon: "bag-check-outline",        label: t("profile.myOrders"),         route: "/orders" },
      { key: "wallet",   icon: "wallet-outline",            label: t("wallet.title"),              route: "/wallet" },
      { key: "catalog",  icon: "grid-outline",              label: t("catalog.title"),             route: "/(tabs)/catalog" },
      { key: "details",  icon: "person-outline",            label: t("profile.myInfo"),            route: "/profile/personal" },
      { key: "address",  icon: "location-outline",          label: t("profile.deliveryAddresses"), route: "/profile/addresses" },
      { key: "payment",  icon: "card-outline",              label: t("profile.paymentMethods"),    route: "/profile/payment" },
      { key: "promo",    icon: "pricetag-outline",          label: t("profile.promoCard"),         route: "/profile/promo" },
    ],
    [
      { key: "notif",    icon: "notifications-outline",     label: t("profile.notifications"),    toggle: true },
      { key: "help",     icon: "help-circle-outline",       label: t("profile.helpSupport"),      route: "/help" },
      { key: "about",    icon: "information-circle-outline",label: t("profile.about"),            route: "/about" },
    ],
    [
      { key: "logout",   icon: "log-out-outline",           label: t("profile.logout"),           danger: true },
    ],
  ];

  const handleLogout = () => {
    Alert.alert(
      t("profile.logoutTitle"),
      t("profile.logoutMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.logoutBtn"),
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/welcome");
          },
        },
      ]
    );
  };

  const handlePress = (item: MenuItem) => {
    if (item.key === "logout") { handleLogout(); return; }
    if (item.route) router.push(item.route as any);
  };

  if (isGuest || !isAuthenticated) {
    return (
      <View style={s.container}>
        <StatusBar style="dark" />
        <SafeAreaView edges={["top"]} style={s.safe}>
          <View style={s.header}><Text style={s.headerTitle}>{t("profile.title")}</Text></View>
        </SafeAreaView>
        <View style={s.authWall}>
          <View style={s.authIcon}><Ionicons name="person-outline" size={56} color={Colors.text3} /></View>
          <Text style={s.authTitle}>{t("profile.authTitle")}</Text>
          <Text style={s.authSub}>{t("profile.authSub")}</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={s.loginBtnText}>{t("profile.loginBtn")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.registerBtn} onPress={() => router.push("/(auth)/register")}>
            <Text style={s.registerBtnText}>{t("profile.registerBtn")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <View style={s.header}><Text style={s.headerTitle}>{t("profile.title")}</Text></View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Avatar card */}
        <View style={s.avatarCard}>
          <View style={s.avatarWrap}>
            {user?.avatar_url
              ? <Image source={{ uri: user.avatar_url }} style={s.avatar} contentFit="cover" />
              : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarInitial}>
                    {(user?.name ?? "U").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )
            }
            <TouchableOpacity style={s.avatarEdit}>
              <Ionicons name="camera-outline" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={s.avatarInfo}>
            <Text style={s.avatarName}>{user?.name ?? t("profile.user")}</Text>
            <Text style={s.avatarMeta}>{user?.email ?? user?.phone ?? ""}</Text>
          </View>
          <TouchableOpacity style={s.editBtn} onPress={() => router.push("/profile/personal" as any)}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Menu groups */}
        {MENU.map((group, gi) => (
          <View key={gi} style={s.group}>
            {group.map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  s.menuItem,
                  idx === group.length - 1 && s.menuItemLast,
                ]}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
                disabled={item.toggle}
              >
                <View style={[s.menuIcon, item.danger && s.menuIconDanger]}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.danger ? Colors.error : Colors.primary}
                  />
                </View>
                <Text style={[s.menuLabel, item.danger && s.menuLabelDanger]}>
                  {item.label}
                </Text>
                {item.badge && (
                  <View style={s.badge}><Text style={s.badgeText}>{item.badge}</Text></View>
                )}
                {item.toggle ? (
                  <Switch
                    value={notifications}
                    onValueChange={setNotifications}
                    trackColor={{ true: Colors.primary, false: Colors.border }}
                    thumbColor="#fff"
                  />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <Text style={s.version}>Dash Meal v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.bg },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },

  // Auth wall
  authWall: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  authIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  authTitle: { fontSize: 18, fontWeight: "700", color: Colors.text, textAlign: "center" },
  authSub: { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 22 },
  loginBtn: { marginTop: 12, height: 52, width: "100%", borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  registerBtn: { height: 52, width: "100%", borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  registerBtnText: { color: Colors.primary, fontWeight: "700", fontSize: 15 },

  // Avatar card
  avatarCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    margin: 16, padding: 16, backgroundColor: Colors.bg,
    borderRadius: Radius.lg, ...Shadow.sm,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { fontSize: 24, fontWeight: "800", color: Colors.primary },
  avatarEdit: {
    position: "absolute", bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.bg,
  },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 2 },
  avatarMeta: { fontSize: 13, color: Colors.text2 },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },

  // Menu
  group: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.bg, borderRadius: Radius.lg, ...Shadow.sm,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  menuIconDanger: { backgroundColor: "#FFEBEE" },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: Colors.text },
  menuLabelDanger: { color: Colors.error },
  badge: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  version: { textAlign: "center", fontSize: 12, color: Colors.text3, marginTop: 4, marginBottom: 16 },
});
