import { useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Colors, Radius, Shadow } from "@/lib/theme";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    key: "favorites",
    title: "Vos favoris,\ntous au même endroit",
    subtitle: "Des milliers de produits frais et épicerie disponibles près de chez vous.",
    icon: "heart-outline" as const,
    iconColor: "#FF7A2F",
    iconBg: "#FFF0E8",
  },
  {
    key: "order",
    title: "Commandez\nchez votre agence",
    subtitle: "Click & Collect ou livraison à domicile — vous choisissez. Paiement Mobile Money simple et sécurisé.",
    icon: "restaurant-outline" as const,
    iconColor: "#FF7A2F",
    iconBg: "#FFF0E8",
  },
  {
    key: "track",
    title: "Offres de livraison\ngratuite",
    subtitle: "Suivez votre commande en temps réel et récupérez-la avec votre QR code en agence.",
    icon: "bicycle-outline" as const,
    iconColor: "#FF7A2F",
    iconBg: "#FFF0E8",
  },
];

// ─── Fan decoration ───────────────────────────────────────────────────────────
function FanDecoration() {
  return (
    <View style={fan.container} pointerEvents="none">
      {[...Array(8)].map((_, i) => (
        <View
          key={i}
          style={[
            fan.stripe,
            {
              transform: [{ rotate: `${i * 11 - 40}deg` }],
              opacity: 0.08 + i * 0.025,
            },
          ]}
        />
      ))}
    </View>
  );
}

const fan = StyleSheet.create({
  container: {
    position: "absolute", bottom: -60, right: -60,
    width: 280, height: 280,
    alignItems: "center", justifyContent: "center",
  },
  stripe: {
    position: "absolute",
    width: 280, height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    transformOrigin: "left center",
  } as any,
});

export default function OnboardingScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const goNext = () => {
    if (current < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: current + 1 });
      setCurrent(current + 1);
    } else {
      finish();
    }
  };

  const finish = async () => {
    await SecureStore.setItemAsync("dm_onboarded", "true");
    router.replace("/(auth)/login");
  };

  const isLast = current === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <FanDecoration />

      {/* Logo */}
      <View style={styles.logoRow}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          contentFit="contain"
        />
        {!isLast && (
          <TouchableOpacity onPress={finish}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(i) => i.key}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Illustration */}
            <View style={[styles.illustrationCircle, { backgroundColor: item.iconBg }]}>
              <Ionicons name={item.icon} size={100} color={item.iconColor} />
            </View>
            {/* Dots */}
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === current && styles.dotActive]}
                />
              ))}
            </View>
            {/* Text */}
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Bottom */}
      <View style={styles.bottom}>
        <TouchableOpacity style={styles.btn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.btnText}>
            {isLast ? "COMMENCER" : "SUIVANT"}
          </Text>
        </TouchableOpacity>
        {!isLast && (
          <TouchableOpacity onPress={finish} style={styles.skipBottom}>
            <Text style={styles.skipBottomText}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  logoRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingTop: 56, paddingBottom: 8,
  },
  logo: { width: 120, height: 48 },
  skipText: { fontSize: 14, color: Colors.text2 },
  slide: {
    width,
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  illustrationCircle: {
    width: 260, height: 260, borderRadius: 130,
    alignItems: "center", justifyContent: "center",
    marginBottom: 32,
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: 28 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { width: 24, borderRadius: 3, backgroundColor: Colors.primary },
  slideTitle: {
    fontSize: 26, fontWeight: "800", color: Colors.text,
    textAlign: "center", lineHeight: 34, marginBottom: 14,
  },
  slideSubtitle: {
    fontSize: 14, color: Colors.text2, textAlign: "center",
    lineHeight: 22, maxWidth: 300,
  },
  bottom: {
    paddingHorizontal: 24, paddingBottom: 52, paddingTop: 16,
    alignItems: "center", gap: 14,
  },
  btn: {
    width: "100%", height: 52, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    ...Shadow.primary,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  skipBottom: { paddingVertical: 4 },
  skipBottomText: { fontSize: 14, color: Colors.text2 },
});
