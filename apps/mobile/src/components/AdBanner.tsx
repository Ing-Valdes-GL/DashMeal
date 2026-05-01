import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";

const { width: W } = Dimensions.get("window");

interface Ad {
  id: string;
  title: string;
  image_url: string;
  brand_name: string;
}

export function AdBanner() {
  const { user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [opacity] = useState(new Animated.Value(0));

  const { data: ad } = useQuery<Ad | null>({
    queryKey: ["active-ad", user?.id],
    queryFn: () => apiGet<Ad | null>("/ads/user/active"),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
    refetchOnMount: true,
  });

  const impressionMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/ads/${id}/impression`, {}),
  });

  useEffect(() => {
    if (ad && !dismissed) {
      setImageError(false);
      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
        impressionMutation.mutate(ad.id);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [ad?.id]);

  const dismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  if (!ad || dismissed) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {/* Badge pub */}
      <View style={styles.pubBadge}>
        <Ionicons name="megaphone-outline" size={10} color="#fff" />
        <Text style={styles.pubBadgeText}>Pub</Text>
      </View>

      {/* Bouton fermer */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={dismiss}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Ionicons name="close" size={16} color="#fff" />
      </TouchableOpacity>

      {/* Image ou fallback */}
      {imageError ? (
        <View style={styles.imageFallback}>
          <Ionicons name="megaphone-outline" size={32} color="rgba(255,255,255,0.4)" />
          <Text style={styles.imageFallbackTitle}>{ad.title}</Text>
          <Text style={styles.imageFallbackBrand}>par {ad.brand_name}</Text>
        </View>
      ) : (
        <Image
          source={{ uri: ad.image_url }}
          style={styles.image}
          contentFit="cover"
          transition={300}
          onError={() => setImageError(true)}
        />
      )}

      {/* Footer */}
      {!imageError && (
        <View style={styles.footer}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>{ad.title}</Text>
            <Text style={styles.brand} numberOfLines={1}>par {ad.brand_name}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: "#1a1a2e",
    ...Shadow.card,
  },
  pubBadge: {
    position: "absolute", top: 8, left: 8, zIndex: 10,
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
  },
  pubBadgeText: { fontSize: 10, color: "#fff", fontWeight: "600", letterSpacing: 0.5 },
  closeBtn: {
    position: "absolute", top: 8, right: 8, zIndex: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  image: { width: "100%", height: 160 },
  imageFallback: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  imageFallbackTitle: {
    fontSize: 16, fontWeight: "700", color: "#fff", textAlign: "center",
  },
  imageFallbackBrand: {
    fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center",
  },
  footer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12, paddingVertical: 8,
    position: "absolute", bottom: 0, left: 0, right: 0,
  },
  title: { fontSize: 13, fontWeight: "700", color: "#fff" },
  brand: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 },
});
