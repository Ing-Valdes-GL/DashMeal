import { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, Modal, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/auth";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Colors, Radius } from "@/lib/theme";

const { width: W, height: H } = Dimensions.get("window");
const REEL_HEIGHT = H;

interface Comment {
  id: string; content: string; is_brand_reply: boolean; created_at: string;
  user?: { name: string }; brand?: { name: string };
  replies?: Comment[];
}

interface Reel {
  id: string;
  thumbnail_url?: string;
  video_url?: string;
  caption: string;
  likes_count: number;
  comments_count: number;
  liked_by_user?: boolean;
  product?: { id: string; name: string; price: number; image_url?: string };
  branch?: { id: string; name: string; logo_url?: string };
}

// ─── Comments Sheet ───────────────────────────────────────────────────────────
function CommentsSheet({ reelId, visible, onClose }: { reelId: string; visible: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Comment[] }>({
    queryKey: ["reel-comments", reelId],
    queryFn: () => apiGet(`/reels/${reelId}/comments`),
    enabled: visible,
  });

  const { mutate: postComment, isPending } = useMutation({
    mutationFn: () => apiPost(`/reels/${reelId}/comments`, { content: text.trim() }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["reel-comments", reelId] });
      qc.invalidateQueries({ queryKey: ["reels"] });
    },
  });

  const comments = data?.data ?? [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={cm.wrap}>
          <View style={cm.handle} />
          <View style={cm.header}>
            <Text style={cm.title}>Commentaires</Text>
            <TouchableOpacity onPress={onClose} style={cm.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
              {comments.length === 0 ? (
                <View style={cm.empty}>
                  <Ionicons name="chatbubble-outline" size={40} color={Colors.text3} />
                  <Text style={cm.emptyText}>Aucun commentaire — soyez le premier !</Text>
                </View>
              ) : comments.map((c) => (
                <View key={c.id} style={cm.comment}>
                  <View style={[cm.avatar, c.is_brand_reply && cm.brandAvatar]}>
                    <Ionicons name={c.is_brand_reply ? "storefront" : "person"} size={16} color={c.is_brand_reply ? Colors.primary : Colors.text2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cm.author}>
                      {c.is_brand_reply ? c.brand?.name ?? "Marque" : c.user?.name ?? "Utilisateur"}
                      {c.is_brand_reply && <Text style={cm.brandBadge}> · Marque</Text>}
                    </Text>
                    <Text style={cm.content}>{c.content}</Text>
                    {c.replies?.map((r) => (
                      <View key={r.id} style={cm.reply}>
                        <View style={[cm.avatar, cm.brandAvatar, { width: 24, height: 24 }]}>
                          <Ionicons name="storefront" size={12} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={cm.author}>{r.brand?.name ?? "Marque"}<Text style={cm.brandBadge}> · Marque</Text></Text>
                          <Text style={cm.content}>{r.content}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {isAuthenticated && (
            <View style={cm.inputRow}>
              <TextInput
                style={cm.input}
                placeholder="Ajouter un commentaire…"
                placeholderTextColor={Colors.text3}
                value={text}
                onChangeText={setText}
                multiline
              />
              <TouchableOpacity
                style={[cm.sendBtn, (!text.trim() || isPending) && cm.sendBtnDisabled]}
                onPress={() => text.trim() && postComment()}
                disabled={!text.trim() || isPending}
              >
                {isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Single Reel ──────────────────────────────────────────────────────────────
function ReelItem({ item, isVisible }: { item: Reel; isVisible: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);

  const [liked, setLiked] = useState(item.liked_by_user ?? false);
  const [likeCount, setLikeCount] = useState(item.likes_count);

  const likeMutation = useMutation({
    mutationFn: () => liked ? apiDelete(`/reels/${item.id}/like`) : apiPost(`/reels/${item.id}/like`, {}),
    onMutate: () => {
      setLiked(!liked);
      setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    },
    onError: () => {
      setLiked(liked);
      setLikeCount(likeCount);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reels"] }),
  });

  const handleLike = () => {
    if (!isAuthenticated) { router.push("/(auth)/welcome"); return; }
    likeMutation.mutate();
  };

  const handleBuy = () => {
    if (!isAuthenticated) { router.push("/(auth)/welcome"); return; }
    if (item.product) {
      router.push({ pathname: "/product/[id]", params: { id: item.product.id } });
    }
  };

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  return (
    <View style={reel.container}>
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={["#1B2138", "#252B47", "#0a0f1e"]} style={StyleSheet.absoluteFill} />
      )}
      <View style={reel.overlay} />

      {!item.thumbnail_url && (
        <View style={reel.playIconWrap}>
          <View style={reel.playIconCircle}>
            <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.6)" />
          </View>
        </View>
      )}

      <SafeAreaView edges={["top"]} style={reel.topBar}>
        <Text style={reel.topTitle}>Réels</Text>
      </SafeAreaView>

      <View style={reel.actions}>
        <TouchableOpacity style={reel.avatarWrap}>
          {item.branch?.logo_url ? (
            <Image source={{ uri: item.branch.logo_url }} style={reel.branchAvatar} contentFit="cover" />
          ) : (
            <View style={[reel.branchAvatar, reel.branchAvatarFallback]}>
              <Ionicons name="storefront" size={20} color={Colors.primary} />
            </View>
          )}
          <View style={reel.followBadge}><Ionicons name="add" size={12} color="#fff" /></View>
        </TouchableOpacity>

        <TouchableOpacity style={reel.actionBtn} onPress={handleLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? "#FF4D6D" : "#fff"} />
          <Text style={reel.actionCount}>{fmt(likeCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={reel.actionBtn} onPress={() => setShowComments(true)}>
          <Ionicons name="chatbubble-outline" size={26} color="#fff" />
          <Text style={reel.actionCount}>{fmt(item.comments_count)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={reel.actionBtn}>
          <Ionicons name="share-social-outline" size={26} color="#fff" />
          <Text style={reel.actionCount}>Partager</Text>
        </TouchableOpacity>
      </View>

      <View style={reel.bottom}>
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={reel.bottomGradient} />
        <View style={reel.bottomContent}>
          {item.branch && (
            <View style={reel.branchRow}>
              <Ionicons name="storefront-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={reel.branchName}>{item.branch.name}</Text>
            </View>
          )}
          <Text style={reel.caption}>{item.caption}</Text>
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

      <CommentsSheet reelId={item.id} visible={showComments} onClose={() => setShowComments(false)} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const [visibleIdx, setVisibleIdx] = useState(0);
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading } = useQuery<{ data: Reel[] }>({
    queryKey: ["reels"],
    queryFn: () => apiGet("/reels", { limit: 20 }),
    staleTime: 60_000,
  });

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setVisibleIdx(viewableItems[0].index ?? 0);
  }, []);

  const reels = data?.data ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <StatusBar style="light" />
        <Ionicons name="videocam-outline" size={56} color="rgba(255,255,255,0.3)" />
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: "700" }}>Aucun réel disponible</Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Les restaurants publieront bientôt</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <FlatList
        data={reels}
        keyExtractor={(i) => i.id}
        renderItem={({ item, index }) => (
          <ReelItem item={item} isVisible={index === visibleIdx} />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={REEL_HEIGHT}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, index) => ({ length: REEL_HEIGHT, offset: REEL_HEIGHT * index, index })}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
      />
    </View>
  );
}

const reel = StyleSheet.create({
  container: { width: W, height: REEL_HEIGHT, backgroundColor: "#000" },
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },
  playIconWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  playIconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 },
  topTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  actions: { position: "absolute", right: 14, bottom: 160, alignItems: "center", gap: 20 },
  avatarWrap: { position: "relative", marginBottom: 4 },
  branchAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#fff" },
  branchAvatarFallback: { backgroundColor: "#FFE8D9", alignItems: "center", justifyContent: "center" },
  followBadge: { position: "absolute", bottom: -6, left: "50%", transform: [{ translateX: -10 }], width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  actionBtn: { alignItems: "center", gap: 3 },
  actionCount: { fontSize: 11, color: "#fff", fontWeight: "600" },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 200 },
  bottomGradient: { ...StyleSheet.absoluteFillObject },
  bottomContent: { position: "absolute", bottom: 0, left: 16, right: 72, paddingBottom: 28 },
  branchRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  branchName: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  caption: { fontSize: 14, color: "#fff", lineHeight: 20, marginBottom: 12 },
  buyBtn: { alignSelf: "flex-start", backgroundColor: Colors.primary, borderRadius: Radius.full },
  buyBtnInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  buyBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  priceBadge: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  priceText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

const cm = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  title: { fontSize: 16, fontWeight: "800", color: Colors.text },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: Colors.text3, textAlign: "center" },
  comment: { flexDirection: "row", gap: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.pageBg, alignItems: "center", justifyContent: "center" },
  brandAvatar: { backgroundColor: Colors.primaryLight },
  author: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 2 },
  brandBadge: { color: Colors.primary, fontWeight: "600", fontSize: 11 },
  content: { fontSize: 14, color: Colors.text2, lineHeight: 20 },
  reply: { flexDirection: "row", gap: 8, marginTop: 8, paddingLeft: 4 },
  inputRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.divider, alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: Colors.pageBg, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.text, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
});
