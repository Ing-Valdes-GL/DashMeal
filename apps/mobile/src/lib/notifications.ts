import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost } from "./api";

const PUSH_DENIED_KEY = "dm_push_denied";

// Configuration globale : affichage des notifs même en premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  // Les notifications push ne fonctionnent que sur un vrai appareil
  const isDevice = Constants.isDevice ?? true;
  if (!isDevice) return null;

  // Ne pas re-demander si l'utilisateur a déjà refusé
  const wasDenied = await AsyncStorage.getItem(PUSH_DENIED_KEY).catch(() => null);
  if (wasDenied === "1") return null;

  // Canal Android (requis pour Android 8+)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Dash Meal",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f97316",
    });
  }

  // Vérifier la permission existante sans re-demander
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    // Mémoriser le refus — ne plus spammer les logs ni re-demander
    await AsyncStorage.setItem(PUSH_DENIED_KEY, "1").catch(() => {});
    return null;
  }

  // Obtenir le token Expo
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[Push] projectId manquant dans app.json (eas.projectId) — token ne sera pas lié au bon projet");
  }

  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = tokenData.data;
    console.log("[Push] Token obtenu:", token);
  } catch (err) {
    // Expo Go ne supporte pas getExpoPushTokenAsync sans development build
    console.warn("[Push] Token non disponible (Expo Go ou projectId manquant):", err);
    return null;
  }

  // Enregistrer côté backend
  try {
    await apiPost("/users/me/push-token", { token, platform: Platform.OS });
    console.log("[Push] Token enregistré côté backend");
  } catch (err) {
    console.error("[Push] Échec enregistrement token:", err);
  }

  return token;
}

export async function registerDriverPushToken(): Promise<void> {
  const isDevice = Constants.isDevice ?? true;
  if (!isDevice) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Dash Meal Livreur",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f97316",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = tokenData.data;
  } catch {
    console.warn("[Push] Token livreur non disponible (Expo Go)");
    return;
  }

  try {
    await apiPost("/delivery/push-token", { token });
    console.log("[Push] Token livreur enregistré");
  } catch (err) {
    console.error("[Push] Échec enregistrement token livreur:", err);
  }
}
