/**
 * AddressAutocomplete
 *
 * TextInput with Google Places suggestions fetched via the backend proxy
 * (never exposes the API key to the client).
 *
 * Props:
 *  - value / onChangeText  : controlled input value
 *  - onSelectAddress       : called with (address, lat, lng) when user picks a suggestion
 *  - placeholder           : optional input placeholder
 *  - showGpsButton         : show the GPS locator button (default true)
 */

import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, StyleSheet, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { apiGet } from "@/lib/api";
import { Colors, Radius } from "@/lib/theme";

interface Prediction {
  place_id: string;
  description: string;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  showGpsButton?: boolean;
}

export function AddressAutocomplete({
  value,
  onChangeText,
  onSelectAddress,
  placeholder = "Entrez une adresse…",
  showGpsButton = true,
}: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Each autocomplete + details pair = one billing "session"
  const sessionToken = useRef<string>(newSession());

  function newSession() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Text change → debounced autocomplete ────────────────────────────────────
  const handleTextChange = (text: string) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await apiGet("/maps/autocomplete", {
          input: text.trim(),
          sessiontoken: sessionToken.current,
        });
        const preds: Prediction[] = resp?.data ?? [];
        setPredictions(preds);
        setShowDropdown(preds.length > 0);
      } catch {
        // silent — network hiccups shouldn't break the form
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  // ── Select a prediction → fetch coordinates ──────────────────────────────────
  const handleSelect = async (prediction: Prediction) => {
    setShowDropdown(false);
    setPredictions([]);
    setResolving(true);

    try {
      const resp = await apiGet("/maps/place", {
        place_id: prediction.place_id,
        sessiontoken: sessionToken.current,
      });
      const { formatted_address, lat, lng } = resp?.data ?? {};
      const addr = formatted_address ?? prediction.description;
      onChangeText(addr);
      onSelectAddress(addr, lat ?? 0, lng ?? 0);
    } catch {
      // fallback: use the description text, no coordinates
      onChangeText(prediction.description);
      onSelectAddress(prediction.description, 0, 0);
    } finally {
      setResolving(false);
      // Rotate session token — billing session is closed after details call
      sessionToken.current = newSession();
    }
  };

  // ── GPS button → reverse geocode via backend ─────────────────────────────────
  const handleGps = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Activez la localisation dans les paramètres.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: lat, longitude: lng } = loc.coords;

      // Use backend reverse geocode (keeps API key server-side)
      try {
        const resp = await apiGet("/maps/reverse", {
          lat: lat.toString(),
          lng: lng.toString(),
        });
        const addr: string =
          resp?.data?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChangeText(addr);
        onSelectAddress(addr, lat, lng);
      } catch {
        // If backend unreachable, fall back to expo-location reverse geocode
        const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const parts = [geo?.streetNumber, geo?.street, geo?.district, geo?.city].filter(Boolean);
        const addr = parts.join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChangeText(addr);
        onSelectAddress(addr, lat, lng);
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'obtenir votre position.");
    } finally {
      setGpsLoading(false);
    }
  };

  const busy = resolving || gpsLoading;

  return (
    <View style={styles.wrapper}>
      {/* Input row */}
      <View style={styles.inputRow}>
        <Ionicons name="location-outline" size={18} color={Colors.text3} style={styles.leadIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.text3}
          value={value}
          onChangeText={handleTextChange}
          editable={!busy}
        />
        {(searching || busy) && (
          <ActivityIndicator size="small" color={Colors.primary} style={styles.spinnerInline} />
        )}
        {showGpsButton && !busy && (
          <TouchableOpacity onPress={handleGps} style={styles.gpsBtn} disabled={gpsLoading}>
            <Ionicons name="locate-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown suggestions */}
      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="always"
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.prediction,
                  index < predictions.length - 1 && styles.predictionBorder,
                ]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={13} color={Colors.text3} />
                <Text style={styles.predictionText} numberOfLines={2}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative", zIndex: 50 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.md,
    paddingLeft: 14,
    minHeight: 52,
  },
  leadIcon: { marginRight: 8 },
  input: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 12 },
  spinnerInline: { marginRight: 10 },
  gpsBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 220,
    zIndex: 999,
    // shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  prediction: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  predictionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  predictionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
});
