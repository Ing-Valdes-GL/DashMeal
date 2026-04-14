import { Tabs, Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet } from "react-native";

function CartBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={badge.wrap}>
      <Text style={badge.text}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    position: "absolute", top: -4, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#f97316", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  text: { color: "#fff", fontSize: 9, fontWeight: "700" },
});

export default function TabsLayout() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const cartCount = useCartStore((s) => s.getCount());

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "#1e293b",
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#f97316",
        tabBarInactiveTintColor: "#475569",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("common.search"),
          tabBarLabel: "Accueil",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: "Catalogue",
          tabBarLabel: "Catalogue",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t("cart.title"),
          tabBarLabel: t("cart.title"),
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="cart-outline" size={size} color={color} />
              <CartBadge count={cartCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("orders.title"),
          tabBarLabel: t("orders.title"),
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile.title"),
          tabBarLabel: t("profile.title"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
