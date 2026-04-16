import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiPost } from "./api";

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
  if (!isDevice) {
    console.log("[Push] Simulateur — notifications désactivées");
    return null;
  }

  // Canal Android (requis pour Android 8+)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Dash Meal",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f97316",
    });
  }

  // Demander la permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permission refusée");
    return null;
  }

  // Obtenir le token Expo
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[Push] projectId manquant dans app.json (eas.projectId) — token ne sera pas lié au bon projet");
  }

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenData.data;
  console.log("[Push] Token obtenu:", token);

  // Enregistrer côté backend
  try {
    await apiPost("/users/me/push-token", { token, platform: Platform.OS });
    console.log("[Push] Token enregistré côté backend");
  } catch (err) {
    console.error("[Push] Échec enregistrement token:", err);
  }

  return token;
}
