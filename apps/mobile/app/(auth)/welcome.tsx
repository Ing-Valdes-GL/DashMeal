import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/auth";
import { Colors, Radius } from "@/lib/theme";

export default function WelcomeScreen() {
  const router = useRouter();
  const { continueAsGuest } = useAuthStore();

  return (
    <View style={s.container}>
      <StatusBar style="dark" />

      {/* Green hero */}
      <View style={s.hero}>
        <View style={s.logoWrap}>
          <Image
            source={require("../../assets/logo.png")}
            style={s.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={s.brand}>Dash Meal</Text>
        <Text style={s.tagline}>Vos courses, livrées en un clin d'œil</Text>

        {/* Illustration */}
        <View style={s.illustrationWrap}>
          <View style={s.illustrationCircle}>
            <Ionicons name="basket-outline" size={80} color="#fff" />
          </View>
          <View style={[s.floatCard, s.floatCard1]}>
            <Ionicons name="bicycle-outline" size={14} color={Colors.primary} />
            <Text style={s.floatText}>Livraison rapide</Text>
          </View>
          <View style={[s.floatCard, s.floatCard2]}>
            <Ionicons name="star" size={14} color="#FFC107" />
            <Text style={s.floatText}>4.9 / 5 clients</Text>
          </View>
        </View>
      </View>

      {/* CTA sheet */}
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>Bienvenue !</Text>
        <Text style={s.sheetSub}>La meilleure nourriture de votre région, livrée en un instant.</Text>

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
  container: { flex: 1, backgroundColor: Colors.primary },

  hero: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingTop: 60, paddingHorizontal: 24,
  },
  logoWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  logo: { width: 52, height: 52 },
  brand: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 4 },
  tagline: { fontSize: 14, color: "rgba(255,255,255,0.75)", marginBottom: 28 },

  illustrationWrap: { position: "relative", alignItems: "center" },
  illustrationCircle: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  floatCard: {
    position: "absolute", flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fff", borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  floatCard1: { top: 10, right: -30 },
  floatCard2: { bottom: 10, left: -30 },
  floatText: { fontSize: 11, fontWeight: "700", color: Colors.text },

  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    padding: 28, paddingBottom: 44,
  },
  sheetTitle: { fontSize: 26, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  sheetSub: { fontSize: 14, color: Colors.text2, lineHeight: 22, marginBottom: 24 },

  btnPrimary: {
    height: 67, borderRadius: Radius.full, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
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
