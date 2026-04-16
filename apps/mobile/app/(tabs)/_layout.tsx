import { Tabs, Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Shadow } from "@/lib/theme";

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
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
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
          backgroundColor: Colors.bg,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
          ...Shadow.sm,
        },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Accueil",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          tabBarLabel: "Catalogue",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
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
          tabBarLabel: "Commandes",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
