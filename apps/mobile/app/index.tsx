import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ActivityIndicator, View } from "react-native";
import * as SecureStore from "expo-secure-store";

export default function Index() {
  const { isAuthenticated, isGuest, isLoading } = useAuthStore();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync("dm_onboarded").then((v) => {
      setOnboarded(v === "true");
    });
  }, []);

  if (isLoading || onboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0a0f1e", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#FF7A2F" size="large" />
      </View>
    );
  }

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (isAuthenticated) return <Redirect href="/(tabs)" />;
  if (isGuest)         return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/welcome" />;
}
