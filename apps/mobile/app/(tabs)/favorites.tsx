/**
 * Favoris — (tabs)/favorites.tsx
 *
 * Grille 2 colonnes de produits favoris avec suppression inline.
 * API : GET /favorites  →  [{ id, product_id, products: { id, name_fr, price, image_url } }]
 *       DELETE /favorites/:product_id
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiDelete } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FavoriteProduct {
  id: string;
  product_id: string;
  products: {
    id: string;
    name_fr: string;
    price: number;
    image_url: string | null;
  };
}

interface FavoritesResponse {
  success: boolean;
  data: FavoriteProduct[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_H_PADDING = 16;
const CARD_W = (SCREEN_W - CARD_H_PADDING * 2 - CARD_GAP) / 2;

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={[styles.card, { width: CARD_W }]}>
      <View style={[styles.cardImage, styles.skeleton]} />
      <View style={styles.cardBody}>
        <View style={[styles.skeleton, { height: 12, borderRadius: 6, marginBottom: 6 }]} />
        <View style={[styles.skeleton, { height: 12, borderRadius: 6, width: "60%" }]} />
        <View style={[styles.skeleton, { height: 14, borderRadius: 6, width: "40%", marginTop: 8 }]} />
      </View>
    </View>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

interface ProductCardProps {
  item: FavoriteProduct;
  onPress: () => void;
  onRemove: () => void;
  removing: boolean;
}

const ProductCard = React.memo(function ProductCard({
  item,
  onPress,
  onRemove,
  removing,
}: ProductCardProps) {
  const product = item.products;

  return (
    <TouchableOpacity
      style={[styles.card, { width: CARD_W }]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      {/* Image */}
      <View style={styles.cardImageWrap}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Ionicons name="image-outline" size={28} color={Colors.border} />
          </View>
        )}
        {/* Remove button */}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onRemove}
          disabled={removing}
          activeOpacity={0.8}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
        >
          {removing ? (
            <ActivityIndicator size="small" color={Colors.error} />
          ) : (
            <Ionicons name="heart" size={16} color={Colors.error} />
          )}
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>
          {product.name_fr}
        </Text>
        <Text style={styles.cardPrice}>{formatCurrency(product.price)}</Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FavoritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<FavoritesResponse>({
    queryKey: ["favorites"],
    queryFn: () => apiGet("/favorites"),
    staleTime: 1000 * 60,
  });
  const favorites = data?.data ?? [];

  const removeMutation = useMutation({
    mutationFn: (productId: string) => apiDelete(`/favorites/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: () => Alert.alert("Erreur", "Impossible de retirer ce favori."),
  });

  const handleRemove = useCallback(
    (item: FavoriteProduct) => {
      Alert.alert(
        "Retirer des favoris",
        `Retirer "${item.products.name_fr}" de vos favoris ?`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Retirer",
            style: "destructive",
            onPress: () => removeMutation.mutate(item.product_id),
          },
        ]
      );
    },
    [removeMutation]
  );

  const renderItem = useCallback(
    ({ item }: { item: FavoriteProduct }) => (
      <ProductCard
        item={item}
        onPress={() => router.push(`/product/${item.products.id}`)}
        onRemove={() => handleRemove(item)}
        removing={
          removeMutation.isPending &&
          removeMutation.variables === item.product_id
        }
      />
    ),
    [router, handleRemove, removeMutation.isPending, removeMutation.variables]
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mes favoris</Text>
          {favorites.length > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{favorites.length}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Content */}
      {isLoading ? (
        // Skeleton grid
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="heart-outline" size={44} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Aucun favori</Text>
              <Text style={styles.emptySubtitle}>
                Ajoutez des produits en favoris pour les retrouver rapidement ici
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/(tabs)/catalog")}
                activeOpacity={0.85}
              >
                <Ionicons name="grid-outline" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Parcourir les produits</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },

  headerSafe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.bg,
    gap: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.text },
  headerBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  headerBadgeText: { fontSize: 13, fontWeight: "700", color: Colors.primary },

  list: { padding: CARD_H_PADDING, paddingBottom: 90 },
  row: { justifyContent: "space-between", marginBottom: CARD_GAP },

  // Product card
  card: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadow.sm,
  },
  cardImageWrap: { position: "relative" },
  cardImage: { width: "100%", height: CARD_W * 0.8 },
  cardImageFallback: {
    backgroundColor: Colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.sm,
  },
  cardBody: { padding: 10 },
  cardName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 6,
  },
  cardPrice: { fontSize: 14, fontWeight: "800", color: Colors.primary },

  // Skeleton
  skeleton: { backgroundColor: Colors.border, opacity: 0.5 },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: CARD_H_PADDING,
    gap: CARD_GAP,
  },

  // Empty state
  empty: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.text3,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 8,
    ...Shadow.primary,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
