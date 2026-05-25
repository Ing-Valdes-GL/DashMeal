import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withRepeat, withSequence,
  cancelAnimation, FadeIn, FadeInUp, Easing,
} from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { Colors, Radius } from "@/lib/theme";

const { height } = Dimensions.get("window");
const IMAGE_H = Math.round(height * 0.54);

const SLIDES = [
  {
    key: "fresh",
    uri: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80",
    bg: "#EDF7ED",
    title: "Produits frais\nlivrés chez vous",
    subtitle: "Des milliers de produits locaux disponibles près de chez vous, livrés en un instant.",
  },
  {
    key: "order",
    uri: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80",
    bg: "#FFF8EC",
    title: "Commandez\nfacilement",
    subtitle: "Click & Collect ou livraison à domicile. Paiement Mobile Money simple et sécurisé.",
  },
  {
    key: "deliver",
    uri: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=800&auto=format&fit=crop&q=80",
    bg: "#EAF4FB",
    title: "Livraison rapide\ngarantie",
    subtitle: "Suivez votre commande en temps réel et récupérez-la avec votre QR code en agence.",
  },
  {
    key: "pickup",
    uri: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop&q=80",
    bg: "#F3EEFF",
    title: "Commandez et passez\nrécupérer quand vous décidez",
    subtitle: "Évitez les longues files d'attente et soyez prioritaire grâce au QR code de votre commande.",
  },
];

// ── Image flottante ────────────────────────────────────────────────────────────
function FloatingImage({ uri }: { uri: string }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0,   { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1
    );
    return () => cancelAnimation(translateY);
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[s.floatWrap, floatStyle]}>
      <Image
        source={{ uri }}
        style={s.heroImage}
        contentFit="cover"
        transition={600}
      />
    </Animated.View>
  );
}

// ── Modal localisation ─────────────────────────────────────────────────────────
function LocationModal({ visible, onAllow, onSkip }: {
  visible: boolean; onAllow: () => void; onSkip: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={loc.overlay}>
        <View style={loc.sheet}>
          <View style={loc.iconWrap}>
            <Ionicons name="location" size={44} color={Colors.primary} />
          </View>
          <Text style={loc.title}>Activez votre localisation</Text>
          <Text style={loc.sub}>
            Pour vous montrer les boutiques à proximité et estimer les temps de livraison.
          </Text>
          {["Boutiques les plus proches", "Estimation précise de livraison", "Suggestions personnalisées"].map((b) => (
            <View key={b} style={loc.row}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Text style={loc.rowText}>{b}</Text>
            </View>
          ))}
          <TouchableOpacity style={loc.btn} onPress={onAllow}>
            <Text style={loc.btnText}>Activer la localisation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={loc.skip} onPress={onSkip}>
            <Text style={loc.skipText}>Pas maintenant</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Écran principal ────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [showLocation, setShowLocation] = useState(false);

  // Animated dot widths (pill → circle)
  const d0 = useSharedValue(28);
  const d1 = useSharedValue(8);
  const d2 = useSharedValue(8);
  const d3 = useSharedValue(8);

  useEffect(() => {
    d0.value = withTiming(current === 0 ? 28 : 8, { duration: 300 });
    d1.value = withTiming(current === 1 ? 28 : 8, { duration: 300 });
    d2.value = withTiming(current === 2 ? 28 : 8, { duration: 300 });
    d3.value = withTiming(current === 3 ? 28 : 8, { duration: 300 });
  }, [current]);

  const dotStyle0 = useAnimatedStyle(() => ({ width: d0.value }));
  const dotStyle1 = useAnimatedStyle(() => ({ width: d1.value }));
  const dotStyle2 = useAnimatedStyle(() => ({ width: d2.value }));
  const dotStyle3 = useAnimatedStyle(() => ({ width: d3.value }));
  const dotStyles = [dotStyle0, dotStyle1, dotStyle2, dotStyle3];

  const finish = async () => {
    await SecureStore.setItemAsync("dm_onboarded", "true");
    router.replace("/(auth)/welcome");
  };

  const goNext = () => {
    if (current < SLIDES.length - 1) setCurrent((c) => c + 1);
    else finish();
  };

  useEffect(() => {
    const t = setTimeout(() => setShowLocation(true), 900);
    return () => clearTimeout(t);
  }, []);

  const slide = SLIDES[current];

  return (
    <View style={s.container}>
      <StatusBar style="dark" />

      <LocationModal
        visible={showLocation}
        onAllow={async () => {
          setShowLocation(false);
          try { await Location.requestForegroundPermissionsAsync(); } catch {}
        }}
        onSkip={() => setShowLocation(false)}
      />

      {/* Bouton Passer */}
      {current < SLIDES.length - 1 && (
        <TouchableOpacity style={s.skipBtn} onPress={finish}>
          <Text style={s.skipText}>Passer</Text>
        </TouchableOpacity>
      )}

      {/* Zone image — remontage sur changement de slide → animation d'entrée */}
      <View style={[s.imageSection, { backgroundColor: slide.bg }]}>
        <Animated.View key={`img-${current}`} entering={FadeIn.duration(500)} style={s.imageFill}>
          <FloatingImage uri={slide.uri} />
        </Animated.View>
        <LinearGradient
          colors={["transparent", Colors.bg]}
          style={s.gradient}
          pointerEvents="none"
        />
      </View>

      {/* Contenu texte — glisse vers le haut à chaque slide */}
      <Animated.View key={`txt-${current}`} entering={FadeInUp.delay(160).duration(420)} style={s.textSection}>
        {/* Indicateurs */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[s.dot, i === current && s.dotActive, dotStyles[i]]}
            />
          ))}
        </View>

        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.sub}>{slide.subtitle}</Text>
      </Animated.View>

      {/* Bouton CTA */}
      <View style={s.bottom}>
        <TouchableOpacity style={s.btn} onPress={goNext} activeOpacity={0.85}>
          <Text style={s.btnText}>
            {current === SLIDES.length - 1 ? "Commencer" : "Suivant"}
          </Text>
          <Ionicons
            name={current === SLIDES.length - 1 ? "rocket-outline" : "arrow-forward"}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  skipBtn: {
    position: "absolute", top: 56, right: 20, zIndex: 20,
    paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.85)", borderRadius: Radius.full,
  },
  skipText: { fontSize: 13, color: Colors.text2, fontWeight: "600" },

  // Image section
  imageSection: {
    height: IMAGE_H,
    overflow: "hidden",
  },
  imageFill: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 24,
  },
  floatWrap: {
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  heroImage: {
    flex: 1,
    borderRadius: 28,
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },

  // Text section
  textSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: 20 },
  dot: {
    height: 8, borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: { backgroundColor: Colors.primary },
  title: {
    fontSize: 28, fontWeight: "800", color: Colors.text,
    lineHeight: 38, marginBottom: 12,
  },
  sub: {
    fontSize: 15, color: Colors.text2,
    lineHeight: 24, maxWidth: 320,
  },

  // Bottom CTA
  bottom: { paddingHorizontal: 24, paddingBottom: 48, paddingTop: 12 },
  btn: {
    height: 64, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

const loc = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, alignItems: "center",
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text, textAlign: "center", marginBottom: 10 },
  sub: { fontSize: 14, color: Colors.text2, textAlign: "center", lineHeight: 22, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch", marginBottom: 10 },
  rowText: { fontSize: 14, color: Colors.text2, flex: 1 },
  btn: {
    width: "100%", height: 56, borderRadius: Radius.full, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginTop: 14, marginBottom: 10,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  skip: { paddingVertical: 10 },
  skipText: { color: Colors.text3, fontSize: 14 },
});
