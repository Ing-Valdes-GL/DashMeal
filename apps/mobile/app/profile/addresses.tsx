import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Radius, Shadow } from "@/lib/theme";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

interface Address {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  is_default: boolean;
}

const LABEL_ICONS: Record<string, string> = {
  Maison: "home-outline",
  Bureau: "briefcase-outline",
  Autre: "location-outline",
};

export default function AddressesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: resp, isLoading } = useQuery<{ success: boolean; data: Address[] }>({
    queryKey: ["my-addresses"],
    queryFn: () => apiGet("/users/me/addresses"),
    staleTime: 1000 * 60,
  });
  const addresses = resp?.data ?? [];

  // ── Form modal ────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("Maison");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const openAdd = () => {
    setEditId(null); setLabel("Maison"); setAddress(""); setIsDefault(false); setCoords(null);
    setShowForm(true);
  };

  const openEdit = (a: Address) => {
    setEditId(a.id); setLabel(a.label); setAddress(a.address);
    setIsDefault(a.is_default); setCoords({ lat: a.lat, lng: a.lng });
    setShowForm(true);
  };


  const saveMutation = useMutation({
    mutationFn: (payload: object) => editId
      ? apiPatch(`/users/me/addresses/${editId}`, payload)
      : apiPost("/users/me/addresses", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-addresses"] });
      setShowForm(false);
    },
    onError: () => Alert.alert("Erreur", "Impossible d'enregistrer l'adresse."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/users/me/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-addresses"] }),
    onError: () => Alert.alert("Erreur", "Impossible de supprimer l'adresse."),
  });

  const handleSave = () => {
    if (!address.trim()) { Alert.alert("Champ requis", "Saisissez une adresse."); return; }
    saveMutation.mutate({
      label,
      address: address.trim(),
      lat: coords?.lat ?? 0,
      lng: coords?.lng ?? 0,
      is_default: isDefault,
    });
  };

  const confirmDelete = (id: string) => {
    Alert.alert("Supprimer", "Voulez-vous supprimer cette adresse ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes adresses</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {addresses.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucune adresse sauvegardée</Text>
              <Text style={styles.emptySubtitle}>Ajoutez vos adresses pour accélérer vos commandes</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>Ajouter une adresse</Text>
              </TouchableOpacity>
            </View>
          ) : (
            addresses.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIcon, a.is_default && styles.cardIconDefault]}>
                    <Ionicons
                      name={(LABEL_ICONS[a.label] ?? "location-outline") as any}
                      size={18}
                      color={a.is_default ? "#fff" : Colors.text2}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardLabel}>{a.label}</Text>
                      {a.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Par défaut</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardAddress} numberOfLines={2}>{a.address}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(a)}>
                    <Ionicons name="pencil-outline" size={16} color={Colors.text2} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(a.id)}>
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Add / Edit modal ────────────────────────────────────────────── */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editId ? "Modifier" : "Nouvelle adresse"}</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={18} color={Colors.text2} />
              </TouchableOpacity>
            </View>

            {/* Label picker */}
            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.labelRow}>
              {["Maison", "Bureau", "Autre"].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.labelChip, label === l && styles.labelChipActive]}
                  onPress={() => setLabel(l)}
                >
                  <Ionicons name={(LABEL_ICONS[l] ?? "location-outline") as any} size={14} color={label === l ? "#fff" : Colors.text2} />
                  <Text style={[styles.labelChipText, label === l && styles.labelChipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Address input */}
            <Text style={styles.inputLabel}>Adresse</Text>
            <View style={{ marginBottom: 14, zIndex: 50 }}>
              <AddressAutocomplete
                value={address}
                onChangeText={setAddress}
                onSelectAddress={(addr, lat, lng) => {
                  setAddress(addr);
                  setCoords({ lat, lng });
                }}
                placeholder="Ex: Rue 1234, Bastos, Yaoundé"
              />
            </View>

            {/* Default toggle */}
            <TouchableOpacity style={styles.defaultRow} onPress={() => setIsDefault(!isDefault)}>
              <Ionicons
                name={isDefault ? "checkbox" : "square-outline"}
                size={20}
                color={isDefault ? Colors.primary : Colors.text3}
              />
              <Text style={styles.defaultLabel}>Définir comme adresse par défaut</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Enregistrer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  safe: { backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg,
  },
  backBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  addBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.text3, textAlign: "center" },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  card: { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 14, ...Shadow.sm, flexDirection: "row", alignItems: "center", gap: 12 },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  cardIconDefault: { backgroundColor: Colors.primary },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  cardLabel: { fontSize: 14, fontWeight: "700", color: Colors.text },
  defaultBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.primary },
  cardAddress: { fontSize: 12, color: Colors.text3, lineHeight: 16 },
  cardActions: { flexDirection: "row", gap: 4 },
  actionBtn: { width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: Colors.text },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg, alignItems: "center", justifyContent: "center" },
  inputLabel: { fontSize: 11, fontWeight: "700", color: Colors.text3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  labelRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  labelChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  labelChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  labelChipText: { fontSize: 13, fontWeight: "600", color: Colors.text2 },
  labelChipTextActive: { color: "#fff" },
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  defaultLabel: { fontSize: 14, color: Colors.text, fontWeight: "500" },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
