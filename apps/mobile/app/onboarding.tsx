import { useRef, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { Colors, Radius } from "@/lib/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    key: "fresh",
    icon: "leaf-outline" as const,
    iconColor: Colors.primary,
    bg: Colors.primaryLight,
    title: "Produits frais\nlivrés chez vous",
    subtitle: "Des milliers de produits locaux disponibles près de chez vous, livrés en un instant.",
  },
  {
    key: "order",
    icon: "bag-handle-outline" as const,
    iconColor: Colors.primary,
    bg: Colors.primaryLight,
    title: "Commandez\nfacilement",
    subtitle: "Click & Collect ou livraison à domicile. Paiement Mobile Money simple et sécurisé.",
  },
  {
    key: "deliver",
    icon: "bicycle-outline" as const,
    iconColor: Colors.primary,
    bg: Colors.primaryLight,
    title: "Livraison rapide\ngarantie",
    subtitle: "Suivez votre commande en temps réel et récupérez-la avec votre QR code en agence.",
  },
];

function LocationModal({ visible, onAllow, onSkip }: { visible: boolean; onAllow: () => void; onSkip: () => void }) {
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

export default function OnboardingScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [showLocation, setShowLocation] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowLocation(true), 900);
    return () => clearTimeout(t);
  }, []);

  const finish = async () => {
    await SecureStore.setItemAsync("dm_onboarded", "true");
    router.replace("/(auth)/welcome");
  };

  const goNext = () => {
    if (current < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: current + 1 });
      setCurrent(current + 1);
    } else {
      finish();
    }
  };

  return (
    <View style={s.container}>
      <StatusBar style="dark" />

      <LocationModal
        visible={showLocation}
        onAllow={async () => { setShowLocation(false); try { await Location.requestForegroundPermissionsAsync(); } catch {} }}
        onSkip={() => setShowLocation(false)}
      />

      {/* Skip */}
      {current < SLIDES.length - 1 && (
        <TouchableOpacity style={s.skipBtn} onPress={finish}>
          <Text style={s.skipText}>Passer</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.key}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View style={s.slide}>
            <View style={[s.illustrationCircle, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={110} color={item.iconColor} />
            </View>
            <View style={s.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[s.dot, i === current && s.dotActive]} />
              ))}
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.sub}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* CTA */}
      <View style={s.bottom}>
        <TouchableOpacity style={s.btn} onPress={goNext} activeOpacity={0.85}>
          <Text style={s.btnText}>{current === SLIDES.length - 1 ? "Commencer" : "Suivant"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  skipBtn: { position: "absolute", top: 56, right: 20, zIndex: 10, paddingVertical: 8, paddingHorizontal: 12 },
  skipText: { fontSize: 14, color: Colors.text2, fontWeight: "600" },
  slide: { width, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  illustrationCircle: {
    width: 240, height: 240, borderRadius: 120,
    alignItems: "center", justifyContent: "center", marginBottom: 40,
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 28, borderRadius: 4, backgroundColor: Colors.primary },
  title: { fontSize: 26, fontWeight: "800", color: Colors.text, textAlign: "center", lineHeight: 36, marginBottom: 14 },
  sub: { fontSize: 15, color: Colors.text2, textAlign: "center", lineHeight: 24, maxWidth: 300 },
  bottom: { paddingHorizontal: 24, paddingBottom: 52, paddingTop: 16 },
  btn: {
    height: 67, borderRadius: Radius.full, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

const loc = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, alignItems: "center" },
  iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 20 },
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
