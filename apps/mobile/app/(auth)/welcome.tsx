import {
  View, Text, StyleSheet, TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/auth";
import { Colors, Radius, Shadow } from "@/lib/theme";


export default function WelcomeScreen() {
  const router = useRouter();
  const { continueAsGuest } = useAuthStore();

  const handleGuest = () => {
    continueAsGuest();
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background */}
      <LinearGradient
        colors={["#1B2138", "#0F1526", "#0a0f1e"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative circles */}
      <View style={deco.c1} />
      <View style={deco.c2} />
      <View style={deco.c3} />

      {/* Logo */}
      <View style={styles.logoWrap}>
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.brand}>Dash Meal</Text>
        <Text style={styles.tagline}>Votre food-tech du quotidien</Text>
      </View>

      {/* Illustration placeholder */}
      <View style={styles.illustrationWrap}>
        <View style={styles.illustrationCircle}>
          <Ionicons name="restaurant" size={80} color="rgba(255,122,47,0.9)" />
        </View>
        <View style={[styles.floatBadge, styles.floatBadge1]}>
          <Text style={styles.floatText}>🚀 Livraison rapide</Text>
        </View>
        <View style={[styles.floatBadge, styles.floatBadge2]}>
          <Text style={styles.floatText}>⭐ 4.9/5 clients</Text>
        </View>
      </View>

      {/* CTA section */}
      <View style={styles.cta}>
        <Text style={styles.ctaTitle}>Bienvenue !</Text>
        <Text style={styles.ctaSubtitle}>
          La meilleure nourriture de votre région, livrée en un instant.
        </Text>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push("/(auth)/login")}
          activeOpacity={0.88}
        >
          <Text style={styles.btnPrimaryText}>SE CONNECTER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push("/(auth)/register")}
          activeOpacity={0.88}
        >
          <Text style={styles.btnSecondaryText}>CRÉER UN COMPTE</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.guestBtn} onPress={handleGuest} activeOpacity={0.7}>
          <Text style={styles.guestText}>Continuer sans compte</Text>
        </TouchableOpacity>

        <Text style={styles.legalNote}>
          En continuant, vous acceptez nos{" "}
          <Text style={styles.legalLink} onPress={() => router.push("/terms" as any)}>
            Conditions d'utilisation
          </Text>{" "}
          et notre{" "}
          <Text style={styles.legalLink} onPress={() => router.push("/privacy" as any)}>
            Politique de confidentialité
          </Text>
        </Text>
      </View>
    </View>
  );
}

const deco = StyleSheet.create({
  c1: {
    position: "absolute", width: 380, height: 380,
    borderRadius: 190, top: -140, right: -120,
    backgroundColor: "rgba(255,122,47,0.07)",
    borderWidth: 1, borderColor: "rgba(255,122,47,0.12)",
  },
  c2: {
    position: "absolute", width: 240, height: 240,
    borderRadius: 120, top: 80, left: -80,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  c3: {
    position: "absolute", width: 160, height: 160,
    borderRadius: 80, bottom: 200, right: -40,
    backgroundColor: "rgba(255,122,47,0.05)",
    borderWidth: 1, borderColor: "rgba(255,122,47,0.08)",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B2138" },

  // Logo
  logoWrap:  { alignItems: "center", paddingTop: 72, paddingBottom: 8 },
  logo:      { width: 72, height: 72, borderRadius: 18 },
  brand:     { fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 10 },
  tagline:   { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 },

  // Illustration
  illustrationWrap: { alignItems: "center", justifyContent: "center", flex: 1, position: "relative" },
  illustrationCircle: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,122,47,0.15)",
    borderWidth: 2, borderColor: "rgba(255,122,47,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  floatBadge: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(10px)",
  },
  floatBadge1: { top: 10, right: 20 },
  floatBadge2: { bottom: 20, left: 10 },
  floatText:   { color: "#fff", fontSize: 12, fontWeight: "600" },

  // CTA
  cta: {
    backgroundColor: "#1B2138",
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 40,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  ctaTitle:    { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 8 },
  ctaSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 20 },

  btnPrimary: {
    height: 54, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12, ...Shadow.primary,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 1 },

  btnSecondary: {
    height: 54, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  btnSecondaryText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 1 },

  guestBtn: { alignItems: "center", paddingVertical: 8, marginBottom: 20 },
  guestText: { color: "rgba(255,255,255,0.45)", fontSize: 14, textDecorationLine: "underline" },

  legalNote: { fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 16 },
  legalLink: { color: Colors.primary, textDecorationLine: "underline" },
});
