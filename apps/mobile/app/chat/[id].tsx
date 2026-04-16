import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { apiGet, apiPost, apiPostForm } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Colors, Radius, Shadow } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  content: string | null;
  sender_id: string;
  sender_name: string;
  created_at: string;
  is_read: boolean;
  message_type: "text" | "image" | "voice";
  media_url: string | null;
  duration_s: number | null;
}

interface Conversation {
  id: string;
  order_id: string;
  type: "client_driver" | "client_support";
  counterpart_name: string;
  counterpart_phone: string | null;
  counterpart_avatar: string | null;
  order_ref: string;
  unread_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatMsgDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type FlatItem =
  | { type: "date"; label: string }
  | { type: "msg"; msg: ChatMessage };

function buildFlatItems(messages: ChatMessage[]): FlatItem[] {
  const items: FlatItem[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const d = formatMsgDate(msg.created_at);
    if (d !== currentDate) {
      currentDate = d;
      items.push({ type: "date", label: d });
    }
    items.push({ type: "msg", msg });
  }
  return items;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatScreen() {
  // `id` is the orderId; `type` is "driver" or "support"
  const { id: orderId, type = "support" } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  // Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDriver = type === "driver";

  // ── 1. Get or create conversation ─────────────────────────────────────────
  const { data: convResp, isLoading: convLoading } = useQuery<{ success: boolean; data: Conversation }>({
    queryKey: ["conversation-order", orderId, type],
    queryFn: () => apiGet(`/chat/conversations/order/${orderId}`, { type }),
    staleTime: 1000 * 60 * 5,
    enabled: !!orderId,
  });
  const conversation = convResp?.data;
  const conversationId = conversation?.id;

  // ── 2. Messages (poll every 5s) ───────────────────────────────────────────
  const { data: msgsResp, isLoading: msgsLoading } = useQuery<{ success: boolean; data: ChatMessage[] }>({
    queryKey: ["messages", conversationId],
    queryFn: () => apiGet(`/chat/conversations/${conversationId}/messages`),
    refetchInterval: 5000,
    staleTime: 0,
    enabled: !!conversationId,
  });
  const messages = msgsResp?.data ?? [];

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Mark as read when conversation opens
  useEffect(() => {
    if (conversationId) {
      apiPost(`/chat/conversations/${conversationId}/read`).catch(() => {});
    }
  }, [conversationId]);

  // ── 3. Send text ──────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (payload: { content?: string; message_type: string; media_url?: string; duration_s?: number }) =>
      apiPost(`/chat/conversations/${conversationId}/messages`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      setText("");
    },
    onError: () => Alert.alert("Erreur", "Impossible d'envoyer le message."),
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending || !conversationId) return;
    sendMutation.mutate({ content: trimmed, message_type: "text" });
  };

  // ── 4. Send photo ─────────────────────────────────────────────────────────
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Autorisez l'accès à la galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0] || !conversationId) return;

    const uri = result.assets[0].uri;
    const filename = uri.split("/").pop() ?? "photo.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    const form = new FormData();
    form.append("file", { uri, name: filename, type: mime } as any);

    try {
      const resp: any = await apiPostForm("/chat/upload", form);
      const mediaUrl = resp?.data?.url ?? resp?.url;
      if (mediaUrl) {
        sendMutation.mutate({ message_type: "image", media_url: mediaUrl });
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer la photo.");
    }
  };

  // ── 5. Voice recording ────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorisez l'accès au microphone.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement.");
    }
  };

  const stopRecording = async () => {
    if (!recording || !conversationId) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const duration = recordingDuration;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);
      setRecordingDuration(0);
      if (!uri) return;

      const ext = uri.split(".").pop()?.toLowerCase() ?? "m4a";
      const mimeMap: Record<string, string> = { m4a: "audio/mp4", mp4: "audio/mp4", wav: "audio/wav", mp3: "audio/mpeg", aac: "audio/aac", "3gp": "audio/3gpp", webm: "audio/webm" };
      const audioMime = mimeMap[ext] ?? "audio/mp4";
      const filename = `voice_${Date.now()}.${ext}`;
      const form = new FormData();
      form.append("file", { uri, name: filename, type: audioMime } as any);

      const resp: any = await apiPostForm("/chat/upload", form);
      const mediaUrl = resp?.data?.url ?? resp?.url;
      if (mediaUrl) {
        sendMutation.mutate({ message_type: "voice", media_url: mediaUrl, duration_s: duration });
      }
    } catch {
      setRecording(null);
      setRecordingDuration(0);
      Alert.alert("Erreur", "Impossible d'envoyer la note vocale.");
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    try {
      await recording.stopAndUnloadAsync();
    } catch {}
    setRecording(null);
    setRecordingDuration(0);
  };

  // ── Voice playback ────────────────────────────────────────────────────────
  // ── Photo viewer ─────────────────────────────────────────────────────────
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // ── Voice playback ────────────────────────────────────────────────────────
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const handlePlayVoice = async (msg: ChatMessage) => {
    if (!msg.media_url) return;
    if (playingId === msg.id) {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlayingId(null);
      return;
    }
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: msg.media_url });
      soundRef.current = sound;
      setPlayingId(msg.id);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch {
      Alert.alert("Erreur", "Impossible de lire le message vocal.");
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderMessage = (msg: ChatMessage) => {
    const isMine = msg.sender_id === user?.id;

    if (msg.message_type === "image" && msg.media_url) {
      return (
        <View style={[styles.msgRow, isMine && styles.msgRowMine]} key={msg.id}>
          {!isMine && <View style={styles.msgAvatar}>
            <Ionicons name={isDriver ? "bicycle-outline" : "storefront-outline"} size={13} color={Colors.primary} />
          </View>}
          <TouchableOpacity
            style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, { padding: 4 }]}
            onPress={() => setViewerUri(msg.media_url!)}
            activeOpacity={0.9}
          >
            <Image source={{ uri: msg.media_url }} style={styles.bubbleImage} contentFit="cover" />
            <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine, { paddingHorizontal: 8, paddingBottom: 4 }]}>
              {formatMsgTime(msg.created_at)}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (msg.message_type === "voice" && msg.media_url) {
      const isPlaying = playingId === msg.id;
      return (
        <View style={[styles.msgRow, isMine && styles.msgRowMine]} key={msg.id}>
          {!isMine && <View style={styles.msgAvatar}>
            <Ionicons name={isDriver ? "bicycle-outline" : "storefront-outline"} size={13} color={Colors.primary} />
          </View>}
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, styles.voiceBubble]}>
            <TouchableOpacity onPress={() => handlePlayVoice(msg)} style={styles.voicePlayBtn}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={18} color={isMine ? "#fff" : Colors.primary} />
            </TouchableOpacity>
            <View style={styles.voiceWave}>
              {Array.from({ length: 18 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.voiceBar,
                    { height: 6 + Math.abs(Math.sin(i * 0.8)) * 14 },
                    { backgroundColor: isMine ? "rgba(255,255,255,0.7)" : Colors.primary + "60" },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.voiceDuration, isMine && { color: "rgba(255,255,255,0.8)" }]}>
              {msg.duration_s ? formatDuration(msg.duration_s) : "0:00"}
            </Text>
          </View>
        </View>
      );
    }

    // Text message
    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]} key={msg.id}>
        {!isMine && <View style={styles.msgAvatar}>
          <Ionicons name={isDriver ? "bicycle-outline" : "storefront-outline"} size={13} color={Colors.primary} />
        </View>}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{msg.content}</Text>
          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
              {formatMsgTime(msg.created_at)}
            </Text>
            {isMine && (
              <Ionicons
                name={msg.is_read ? "checkmark-done" : "checkmark"}
                size={12}
                color={msg.is_read ? "#B3E5FC" : "rgba(255,255,255,0.6)"}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (convLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const flatItems = buildFlatItems(messages);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.headerContact}>
            {conversation?.counterpart_avatar ? (
              <Image source={{ uri: conversation.counterpart_avatar }} style={styles.headerAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                <Ionicons name={isDriver ? "bicycle-outline" : "storefront-outline"} size={18} color={Colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {conversation?.counterpart_name ?? (isDriver ? "Livreur" : "Agence")}
              </Text>
              <View style={styles.headerMeta}>
                <View style={styles.onlineDot} />
                <Text style={styles.headerMetaText}>
                  {isDriver ? "Livreur" : "Agence"} · #{orderId?.slice(0, 6).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            {conversation?.counterpart_phone && (
              <TouchableOpacity style={styles.headerActionBtn}>
                <Ionicons name="call-outline" size={18} color={Colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.headerActionBtn}>
              <Ionicons name="ellipsis-vertical" size={18} color={Colors.text2} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        {msgsLoading && !conversationId ? (
          <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
        ) : flatItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.border} />
            </View>
            <Text style={styles.emptyTitle}>Démarrez la conversation</Text>
            <Text style={styles.emptySubtitle}>
              {isDriver
                ? "Échangez avec votre livreur en temps réel"
                : "Contactez l'agence pour toute question sur votre commande"
              }
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={flatItems}
            keyExtractor={(item, i) => item.type === "date" ? `date-${i}` : item.msg.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              if (item.type === "date") {
                return (
                  <View style={styles.dateSep}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateLabel}>{item.label}</Text>
                    <View style={styles.dateLine} />
                  </View>
                );
              }
              return renderMessage(item.msg);
            }}
          />
        )}

        {/* Recording bar */}
        {recording ? (
          <View style={styles.recordingBar}>
            <TouchableOpacity onPress={cancelRecording} style={styles.recordCancelBtn}>
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
            </TouchableOpacity>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Enregistrement…  {formatDuration(recordingDuration)}</Text>
            </View>
            <TouchableOpacity onPress={stopRecording} style={styles.recordSendBtn}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Input bar */
          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.attachBtn} onPress={handlePickPhoto}>
              <Ionicons name="image-outline" size={22} color={Colors.text3} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Écrire un message…"
              placeholderTextColor={Colors.text3}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              returnKeyType="default"
            />
            {text.trim() ? (
              <TouchableOpacity
                style={[styles.sendBtn, sendMutation.isPending && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={18} color="#fff" />
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.micBtn} onPress={startRecording}>
                <Ionicons name="mic-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Full-screen photo viewer ───────────────────────────────────── */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} contentFit="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.pageBg },

  // Header
  headerSafe: { backgroundColor: Colors.bg, ...Shadow.sm },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
    backgroundColor: Colors.bg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  headerContact: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarFallback: { backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  headerName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  headerMetaText: { fontSize: 11, color: Colors.text3 },
  headerActions: { flexDirection: "row", gap: 6 },
  headerActionBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },

  // Empty
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", ...Shadow.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.text3, textAlign: "center", lineHeight: 20 },

  // Messages list
  messagesList: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 8, gap: 4 },

  // Date separator
  dateSep: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 12 },
  dateLine: { flex: 1, height: 1, backgroundColor: Colors.divider },
  dateLabel: { fontSize: 11, color: Colors.text3, fontWeight: "600" },

  // Message rows
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginVertical: 3 },
  msgRowMine: { flexDirection: "row-reverse" },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },

  // Bubbles
  bubble: {
    maxWidth: "72%", borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.bg, borderBottomLeftRadius: 4, ...Shadow.sm },
  bubbleText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  bubbleTextMine: { color: "#fff" },
  bubbleMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  bubbleTime: { fontSize: 10, color: Colors.text3 },
  bubbleTimeMine: { color: "rgba(255,255,255,0.65)" },

  // Image bubble
  bubbleImage: { width: 200, height: 160, borderRadius: Radius.md },

  // Voice bubble
  voiceBubble: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  voicePlayBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  voiceWave: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1 },
  voiceBar: { width: 3, borderRadius: 2 },
  voiceDuration: { fontSize: 11, color: Colors.text3, minWidth: 32 },

  // Input bar
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28,
    backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center",
  },
  input: {
    flex: 1, backgroundColor: Colors.inputBg, borderRadius: Radius.xl,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: Colors.text, maxHeight: 100, lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
  micBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },

  // Recording bar
  recordingBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28,
    backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  recordCancelBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: "#FFEBEE", alignItems: "center", justifyContent: "center",
  },
  recordingIndicator: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error },
  recordingText: { fontSize: 14, color: Colors.text, fontWeight: "500" },
  recordSendBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },

  // Full-screen photo viewer
  viewerOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  viewerClose: {
    position: "absolute", top: 56, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  viewerImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.8,
  },
});
