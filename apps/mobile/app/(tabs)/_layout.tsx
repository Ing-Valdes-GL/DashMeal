import { Tabs, Redirect } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors, Shadow } from "@/lib/theme";

function TabIcon({ name, color, size }: { name: React.ComponentProps<typeof Ionicons>["name"]; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  const { isAuthenticated, isGuest } = useAuthStore();

  if (!isAuthenticated && !isGuest) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 24 : 10,
          paddingTop: 8,
          ...Shadow.sm,
        },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: "#BDBDBD",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Accueil",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          tabBarLabel: "Réels",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "play-circle" : "play-circle-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          tabBarLabel: "Marketplace",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "storefront" : "storefront-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarLabel: "Commandes",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "receipt" : "receipt-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "Profil",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} color={color} size={size} />
          ),
        }}
      />

      {/* Hidden screens — no tab icon */}
      <Tabs.Screen name="catalog"    options={{ href: null }} />
      <Tabs.Screen name="cart"       options={{ href: null }} />
      <Tabs.Screen name="favorites"  options={{ href: null }} />
    </Tabs>
  );
}
