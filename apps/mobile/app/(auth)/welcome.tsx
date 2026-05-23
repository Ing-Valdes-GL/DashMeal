import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, Easing,
} from "react-native-reanimated";
import { useAuthStore } from "@/stores/auth";
import { Colors, Radius } from "@/lib/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BG_IMAGE = require("../../assets/welcome-bg.jpg") as number;

export default function WelcomeScreen() {
  const router = useRouter();
  const { continueAsGuest } = useAuthStore();

  // ── Animation du logo (flottement vertical doux) ──────────────────────────
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,   { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));


  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* ── Image de fond plein écran ──────────────────────────────────────── */}
      <Image
        source={BG_IMAGE}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={600}
      />

      {/* ── Dégradé sombre sur l'image (du haut vers le bas) ─────────────── */}
      <LinearGradient
        colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.82)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* ── Logo haut droite ──────────────────────────────────────────── */}
        <View style={s.topBar}>
          <Animated.View style={[s.logoWrap, logoStyle]}>
            <Image
              source={require("../../assets/logo2.png")}
              style={s.logo}
              contentFit="contain"
            />
          </Animated.View>
        </View>
      </SafeAreaView>

      {/* ── Feuille CTA en bas ────────────────────────────────────────────── */}
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>Bienvenue !</Text>
        <Text style={s.sheetSub}>
          La meilleure nourriture de votre région, livrée en un instant.
        </Text>

        <TouchableOpacity
          style={s.btnPrimary}
          onPress={() => router.push("/(auth)/login")}
          activeOpacity={0.88}
        >
          <Text style={s.btnPrimaryText}>Se connecter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => router.push("/(auth)/register")}
          activeOpacity={0.88}
        >
          <Text style={s.btnOutlineText}>Créer un compte</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.guestBtn}
          onPress={() => { continueAsGuest(); router.replace("/(tabs)"); }}
        >
          <Text style={s.guestText}>Continuer sans compte</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111" },
  safe: { flex: 1 },

  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    backgroundColor: "#fff",
  },
  logo: { width: 64, height: 64 },

  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 28,
    paddingBottom: 48,
  },
  sheetTitle: { fontSize: 26, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  sheetSub:   { fontSize: 14, color: Colors.text2, lineHeight: 22, marginBottom: 28 },

  btnPrimary: {
    height: 67, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  btnOutline: {
    height: 67, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  btnOutlineText: { color: Colors.primary, fontWeight: "700", fontSize: 16 },

  guestBtn: { alignItems: "center", paddingVertical: 8 },
  guestText: { color: Colors.text3, fontSize: 14, textDecorationLine: "underline" },
});
