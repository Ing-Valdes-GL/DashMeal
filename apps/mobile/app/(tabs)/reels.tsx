import { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius, Shadow } from "@/lib/theme";

const { width: W, height: H } = Dimensions.get("window");
const REEL_HEIGHT = H;

interface Reel {
  id: string;
  thumbnail_url?: string;
  video_url?: string;
  caption: string;
  likes: number;
  comments: number;
  liked?: boolean;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
  };
  branch?: {
    id: string;
    name: string;
    logo_url?: string;
  };
}

// Mock data — replace with real API when ready
const MOCK_REELS: Reel[] = [
  {
    id: "1",
    caption: "Notre burger du chef 🍔 — inratable !",
    likes: 1243,
    comments: 87,
    liked: false,
    product: { id: "p1", name: "Burger du Chef", price: 3500 },
    branch:  { id: "b1", name: "Burger House Yaoundé" },
  },
  {
    id: "2",
    caption: "Pizza Margherita fraîche du four 🍕",
    likes: 892,
    comments: 45,
    liked: true,
    product: { id: "p2", name: "Pizza Margherita", price: 5000 },
    branch:  { id: "b2", name: "La Bella Napoli" },
  },
  {
    id: "3",
    caption: "Ndolé aux crevettes, le classique camerounais 🇨🇲",
    likes: 3210,
    comments: 214,
    liked: false,
    product: { id: "p3", name: "Ndolé aux crevettes", price: 2500 },
    branch:  { id: "b3", name: "Saveurs du Pays" },
  },
  {
    id: "4",
    caption: "Smoothie tropical 🥭🍍 — rafraîchissant !",
    likes: 567,
    comments: 32,
    liked: false,
    product: { id: "p4", name: "Smoothie Tropical", price: 1500 },
    branch:  { id: "b4", name: "Fresh Bar" },
  },
];

// ─── Single Reel ──────────────────────────────────────────────────────────────
function ReelItem({ item, isVisible }: { item: Reel; isVisible: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [liked, setLiked] = useState(item.liked ?? false);
  const [likeCount, setLikeCount] = useState(item.likes);

  const handleLike = () => {
    if (!isAuthenticated) { router.push("/(auth)/welcome"); return; }
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const handleBuy = () => {
    if (!isAuthenticated) { router.push("/(auth)/welcome"); return; }
    if (item.product) {
      router.push({ pathname: "/product/[id]", params: { id: item.product.id } });
    }
  };

  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  return (
    <View style={reel.container}>
      {/* Background */}
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient
          colors={["#1B2138", "#252B47", "#0a0f1e"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={reel.overlay} />

      {/* Play indicator (placeholder) */}
      {!item.thumbnail_url && (
        <View style={reel.playIconWrap}>
          <View style={reel.playIconCircle}>
            <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.6)" />
          </View>
          <Text style={reel.videoLabel}>Vidéo bientôt disponible</Text>
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView edges={["top"]} style={reel.topBar}>
        <Text style={reel.topTitle}>Réels</Text>
        <TouchableOpacity style={reel.searchBtn}>
          <Ionicons name="search-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Right actions */}
      <View style={reel.actions}>
        {/* Branch avatar */}
        <TouchableOpacity style={reel.avatarWrap}>
          {item.branch?.logo_url ? (
            <Image source={{ uri: item.branch.logo_url }} style={reel.branchAvatar} contentFit="cover" />
          ) : (
            <View style={[reel.branchAvatar, reel.branchAvatarFallback]}>
              <Ionicons name="storefront" size={20} color={Colors.primary} />
            </View>
          )}
          <View style={reel.followBadge}>
            <Ionicons name="add" size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity style={reel.actionBtn} onPress={handleLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? "#FF4D6D" : "#fff"} />
          <Text style={reel.actionCount}>{formatCount(likeCount)}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={reel.actionBtn}>
          <Ionicons name="chatbubble-outline" size={26} color="#fff" />
          <Text style={reel.actionCount}>{formatCount(item.comments)}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={reel.actionBtn}>
          <Ionicons name="share-social-outline" size={26} color="#fff" />
          <Text style={reel.actionCount}>Partager</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={reel.bottom}>
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={reel.bottomGradient} />
        <View style={reel.bottomContent}>
          {/* Branch name */}
          {item.branch && (
            <View style={reel.branchRow}>
              <Ionicons name="storefront-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={reel.branchName}>{item.branch.name}</Text>
            </View>
          )}
          <Text style={reel.caption}>{item.caption}</Text>

          {/* Buy button */}
          {item.product && (
            <TouchableOpacity style={reel.buyBtn} onPress={handleBuy} activeOpacity={0.88}>
              <View style={reel.buyBtnInner}>
                <Ionicons name="cart-outline" size={15} color="#fff" />
                <Text style={reel.buyBtnText}>{item.product.name}</Text>
                <View style={reel.priceBadge}>
                  <Text style={reel.priceText}>{formatCurrency(item.product.price)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const reel = StyleSheet.create({
  container: { width: W, height: REEL_HEIGHT, backgroundColor: "#000" },
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },

  playIconWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  playIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  videoLabel:   { color: "rgba(255,255,255,0.5)", fontSize: 13 },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 8,
  },
  topTitle:  { fontSize: 18, fontWeight: "800", color: "#fff" },
  searchBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  actions: {
    position: "absolute", right: 14, bottom: 160,
    alignItems: "center", gap: 20,
  },
  avatarWrap:  { position: "relative", marginBottom: 4 },
  branchAvatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: "#fff",
  },
  branchAvatarFallback: { backgroundColor: "#FFE8D9", alignItems: "center", justifyContent: "center" },
  followBadge: {
    position: "absolute", bottom: -6, left: "50%",
    transform: [{ translateX: -10 }],
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary, borderWidth: 1.5, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  actionBtn: { alignItems: "center", gap: 3 },
  actionCount: { fontSize: 11, color: "#fff", fontWeight: "600" },

  bottom:          { position: "absolute", bottom: 0, left: 0, right: 0, height: 200 },
  bottomGradient:  { ...StyleSheet.absoluteFillObject },
  bottomContent:   { position: "absolute", bottom: 0, left: 16, right: 72, paddingBottom: 28 },
  branchRow:       { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  branchName:      { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  caption:         { fontSize: 14, color: "#fff", lineHeight: 20, marginBottom: 12 },

  buyBtn: {
    alignSelf: "flex-start",
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    ...Shadow.primary,
  },
  buyBtnInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  buyBtnText:  { fontSize: 13, fontWeight: "700", color: "#fff" },
  priceBadge:  { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  priceText:   { fontSize: 12, color: "#fff", fontWeight: "700" },
});

// ─── Reels Screen ─────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const [visibleIdx, setVisibleIdx] = useState(0);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisibleIdx(viewableItems[0].index ?? 0);
    }
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <FlatList
        data={MOCK_REELS}
        keyExtractor={(i) => i.id}
        renderItem={({ item, index }) => (
          <ReelItem item={item} isVisible={index === visibleIdx} />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={REEL_HEIGHT}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: REEL_HEIGHT, offset: REEL_HEIGHT * index, index })}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
      />
    </View>
  );
}
