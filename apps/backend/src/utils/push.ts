import { supabase } from "../config/supabase.js";

// ─── Types Expo Push ──────────────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

// ─── Envoi bas niveau vers l'API Expo ─────────────────────────────────────────

async function sendToExpo(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Push] Expo API error (${response.status}):`, text);
    }
  } catch (err) {
    // Ne jamais faire crasher l'app pour une notif ratée
    console.error("[Push] Network error:", err);
  }
}

// ─── Notifier un utilisateur (tous ses appareils enregistrés) ─────────────────

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);

  if (!tokens || tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title,
    body,
    data,
    sound: "default",
    priority: "high",
    channelId: "default",
  }));

  await sendToExpo(messages);
}

// ─── Messages prédéfinis par statut de commande ───────────────────────────────

export async function notifyOrderStatus(
  userId: string,
  orderId: string,
  status: string,
  orderRef?: string
): Promise<void> {
  const ref = orderRef ? `#${orderRef.slice(0, 8).toUpperCase()}` : "";
  const data = { orderId, screen: "order", type: "order_status" };

  const MESSAGES: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: "Commande confirmée ✅",
      body: `Votre commande ${ref} a été confirmée. Nous la préparons dès maintenant.`,
    },
    preparing: {
      title: "En préparation 👨‍🍳",
      body: `Votre commande ${ref} est en cours de préparation.`,
    },
    ready: {
      title: "Prête à retirer ! 🎉",
      body: `Votre commande ${ref} est prête. Venez la récupérer en agence.`,
    },
    delivering: {
      title: "En cours de livraison 🛵",
      body: `Votre commande ${ref} est en route vers vous !`,
    },
    delivered: {
      title: "Livraison effectuée 🏠",
      body: `Votre commande ${ref} a été livrée. Bon appétit !`,
    },
    cancelled: {
      title: "Commande annulée ❌",
      body: `Votre commande ${ref} a été annulée.`,
    },
  };

  const msg = MESSAGES[status];
  if (!msg) return;

  await notifyUser(userId, msg.title, msg.body, data);
}

export async function notifyPaymentFailed(
  userId: string,
  orderId: string,
  orderRef?: string
): Promise<void> {
  const ref = orderRef ? `#${orderRef.slice(0, 8).toUpperCase()}` : "";
  await notifyUser(
    userId,
    "Paiement échoué ❌",
    `Le paiement de la commande ${ref} a échoué. Vérifiez votre solde et réessayez.`,
    { orderId, screen: "order", type: "payment_failed" }
  );
}
