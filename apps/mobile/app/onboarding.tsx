import { useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    key: "welcome",
    title: "Bienvenue sur\nDash Meal",
    subtitle: "Vos courses livrées à domicile ou disponibles en Click & Collect dans votre supermarché préféré.",
    icon: null,
    isLogo: true,
  },
  {
    key: "catalog",
    title: "Parcourez\nle catalogue",
    subtitle: "Des milliers de produits frais et épicerie, classés par catégorie pour trouver facilement ce que vous cherchez.",
    icon: "grid-outline",
    color: "#3b82f6",
  },
  {
    key: "order",
    title: "Commandez\nen un clic",
    subtitle: "Choisissez entre la livraison à domicile ou le Click & Collect. Payez avec Mobile Money (MTN, Orange).",
    icon: "flash-outline",
    color: "#f97316",
  },
  {
    key: "track",
    title: "Suivez votre\ncommande",
    subtitle: "Recevez des notifications en temps réel. Scannez votre QR code en agence pour retirer votre commande.",
    icon: "location-outline",
    color: "#22c55e",
  },
];

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
      <StatusBar style="light" />
      <LinearGradient colors={["#0a0f1e", "#0c1428"]} style={StyleSheet.absoluteFill} />

      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={styles.skip} onPress={finish}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(i) => i.key}
        onMomentumScrollEnd={(e) => {
          setCurrent(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Illustration */}
            <View style={styles.illustrationWrap}>
              {item.isLogo ? (
                <Image
                  source={require("../assets/logo.png")}
                  style={styles.logo}
                  contentFit="contain"
                />
              ) : (
                <View style={[styles.iconCircle, { borderColor: item.color + "40", backgroundColor: item.color + "15" }]}>
                  <Ionicons name={item.icon as any} size={80} color={item.color} />
                </View>
              )}
            </View>

            {/* Text */}
            <View style={styles.textBlock}>
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === current && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity style={styles.btn} onPress={goNext}>
          <LinearGradient
            colors={["#f97316", "#ea580c"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.btnGrad}
          >
            <Text style={styles.btnText}>
              {isLast ? "Commencer" : "Suivant"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1e" },
  skip: {
    position: "absolute", top: 56, right: 24, zIndex: 10,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: "#0f172a", borderRadius: 20, borderWidth: 1, borderColor: "#1e293b",
  },
  skipText: { color: "#64748b", fontSize: 13, fontWeight: "500" },
  slide: {
    width,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  illustrationWrap: {
    width: width * 0.72,
    height: height * 0.38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  logo: {
    width: width * 0.72,
    height: height * 0.38,
  },
  iconCircle: {
    width: 180, height: 180, borderRadius: 90,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2,
  },
  textBlock: { alignItems: "center", gap: 14 },
  slideTitle: {
    fontSize: 32, fontWeight: "800", color: "#fff",
    textAlign: "center", lineHeight: 40,
    letterSpacing: -0.5,
  },
  slideSubtitle: {
    fontSize: 15, color: "#64748b", textAlign: "center",
    lineHeight: 23, maxWidth: 300,
  },
  bottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingBottom: 48, paddingTop: 20,
    gap: 20, alignItems: "center",
    backgroundColor: "transparent",
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#1e293b",
  },
  dotActive: {
    width: 24, backgroundColor: "#f97316",
  },
  btn: { width: "100%", borderRadius: 16, overflow: "hidden" },
  btnGrad: {
    height: 56, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
