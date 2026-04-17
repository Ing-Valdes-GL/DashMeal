import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { apiGet } from "@/lib/api";
import { Colors, Radius, Shadow } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverConversation {
  id: string;
  order_id: string;
  counterpart_name: string;
  counterpart_phone: string | null;
  delivery_status: string | null;
  delivery_address: string | null;
  last_message: {
    content: string | null;
    message_type: "text" | "image" | "voice";
    created_at: string;
    is_mine: boolean;
  } | null;
  unread_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function lastMsgPreview(msg: DriverConversation["last_message"]): string {
  if (!msg) return "Démarrez la conversation";
  if (msg.message_type === "image") return msg.is_mine ? "Vous : 📷 Photo" : "📷 Photo";
  if (msg.message_type === "voice") return msg.is_mine ? "Vous : 🎙️ Note vocale" : "🎙️ Note vocale";
  const text = msg.content ?? "";
  const preview = text.length > 45 ? text.slice(0, 45) + "…" : text;
  return msg.is_mine ? `Vous : ${preview}` : preview;
}

// ─── Conversation card ────────────────────────────────────────────────────────

function ConvCard({ item, onPress }: { item: DriverConversation; onPress: () => void }) {
  const hasUnread = item.unread_count > 0;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Ionicons name="person-outline" size={20} color={Colors.primary} />
        {hasUnread && <View style={styles.unreadDot} />}
      </View>

      {/* Content */}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {item.counterpart_name}
          </Text>
          {item.last_message && (
            <Text style={styles.time}>{formatTime(item.last_message.created_at)}</Text>
          )}
        </View>
        <View style={styles.cardBottom}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {lastMsgPreview(item.last_message)}
          </Text>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unread_count > 9 ? "9+" : item.unread_count}</Text>
            </View>
          )}
        </View>
        {item.delivery_address && (
          <View style={styles.deliveryRow}>
            <Ionicons name="location-outline" size={11} color={Colors.text3} />
            <Text style={styles.deliveryAddr} numberOfLines={1}>{item.delivery_address}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DriverMessagesScreen() {
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery<{ data: DriverConversation[] }>({
    queryKey: ["driver-conversations"],
    queryFn: () => apiGet("/chat/conversations/driver/list"),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const conversations = data?.data ?? [];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          {conversations.some((c) => c.unread_count > 0) && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {conversations.reduce((s, c) => s + c.unread_count, 0)}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={44} color={Colors.border} />
          </View>
          <Text style={styles.emptyTitle}>Aucun message</Text>
          <Text style={styles.emptySubtitle}>
            Les messages des clients apparaîtront ici lorsque vous accepterez des livraisons.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ConvCard
              item={item}
              onPress={() =>
                router.push({
                  pathname: "/chat/[id]",
                  params: { id: item.order_id, type: "driver" },
                })
              }
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },

  headerSafe: { backgroundColor: Colors.bg, ...Shadow.sm },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text, flex: 1 },
  headerBadge: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  headerBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  loader: { flex: 1, alignItems: "center", justifyContent: "center" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", ...Shadow.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.text3, textAlign: "center", lineHeight: 20 },

  list: { paddingVertical: 8 },
  separator: { height: 1, backgroundColor: Colors.divider, marginLeft: 76 },

  card: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    backgroundColor: Colors.bg,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  unreadDot: {
    position: "absolute", top: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.bg,
  },
  cardBody: { flex: 1, gap: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { fontSize: 15, fontWeight: "600", color: Colors.text, flex: 1 },
  nameUnread: { fontWeight: "700" },
  time: { fontSize: 11, color: Colors.text3 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: { fontSize: 13, color: Colors.text3, flex: 1 },
  previewUnread: { color: Colors.text2, fontWeight: "500" },
  unreadBadge: {
    backgroundColor: Colors.primary, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
  },
  unreadCount: { color: "#fff", fontSize: 11, fontWeight: "700" },
  deliveryRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  deliveryAddr: { fontSize: 11, color: Colors.text3, flex: 1 },
});
