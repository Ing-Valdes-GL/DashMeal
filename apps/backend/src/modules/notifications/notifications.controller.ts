import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { env } from "../../config/env.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
};

// Envoie les messages push en lots de 100 (limite recommandée par Expo)
async function dispatchExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (env.EXPO_ACCESS_TOKEN) {
    headers["Authorization"] = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }

  const BATCH = 100;
  for (let i = 0; i < messages.length; i += BATCH) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(messages.slice(i, i + BATCH)),
      });
    } catch {
      // Les push sont best-effort : on ne bloque pas la réponse en cas d'échec Expo
    }
  }
}

// ─── Admin / Superadmin : envoyer à des utilisateurs ciblés (ou à la marque) ──
export async function sendNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_ids, title_fr, title_en, body_fr, body_en, type, data } = req.body as {
      user_ids?: string[];
      title_fr: string;
      title_en: string;
      body_fr: string;
      body_en: string;
      type?: string;
      data?: Record<string, unknown>;
    };

    let targetIds: string[] = user_ids ?? [];

    // Si aucun user_id fourni et rôle admin → cibler les clients de sa marque
    if (targetIds.length === 0 && req.user?.role === "admin" && req.user.brand_id) {
      const { data: rows } = await supabase
        .from("orders")
        .select("user_id, branches!inner(brand_id)")
        .eq("branches.brand_id", req.user.brand_id)
        .limit(2000);

      if (rows) {
        targetIds = [...new Set(rows.map((r) => r.user_id as string))];
      }
    }

    if (targetIds.length === 0) {
      return sendSuccess(res, { sent: 0 }, "Aucun destinataire trouvé");
    }

    // Récupérer les tokens push
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("user_id, token, locale")
      .in("user_id", targetIds);

    if (tokens && tokens.length > 0) {
      const messages: ExpoPushMessage[] = (tokens as { user_id: string; token: string; locale: string }[]).map((t) => ({
        to: t.token,
        title: t.locale === "en" ? title_en : title_fr,
        body: t.locale === "en" ? body_en : body_fr,
        data: data ?? {},
        sound: "default",
      }));
      await dispatchExpoPush(messages);
    }

    // Persister les notifications en base
    const rows = targetIds.map((uid) => ({
      user_id: uid,
      title_fr,
      title_en,
      body_fr,
      body_en,
      type: type ?? "general",
      data: data ?? null,
    }));
    await supabase.from("notifications").insert(rows);

    sendSuccess(res, { sent: targetIds.length }, "Notifications envoyées");
  } catch (err) {
    next(err);
  }
}

// ─── Superadmin : broadcast à tous les utilisateurs ──────────────────────────
export async function broadcastNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const { title_fr, title_en, body_fr, body_en, type, data } = req.body as {
      title_fr: string;
      title_en: string;
      body_fr: string;
      body_en: string;
      type?: string;
      data?: Record<string, unknown>;
    };

    const { data: tokens, error } = await supabase
      .from("push_tokens")
      .select("user_id, token, locale");

    if (error) throw new AppError(500, "FETCH_ERROR", "Impossible de récupérer les tokens");

    if (tokens && tokens.length > 0) {
      const messages: ExpoPushMessage[] = (tokens as { user_id: string; token: string; locale: string }[]).map((t) => ({
        to: t.token,
        title: t.locale === "en" ? title_en : title_fr,
        body: t.locale === "en" ? body_en : body_fr,
        data: data ?? {},
        sound: "default",
      }));
      await dispatchExpoPush(messages);
    }

    // Tous les user_ids uniques
    const allUserIds = [
      ...new Set((tokens ?? []).map((t) => (t as { user_id: string }).user_id)),
    ];

    // Insertion en lots de 500 pour éviter timeout Supabase
    const BATCH = 500;
    for (let i = 0; i < allUserIds.length; i += BATCH) {
      const batchRows = allUserIds.slice(i, i + BATCH).map((uid) => ({
        user_id: uid,
        title_fr,
        title_en,
        body_fr,
        body_en,
        type: type ?? "general",
        data: data ?? null,
      }));
      await supabase.from("notifications").insert(batchRows);
    }

    sendSuccess(res, { sent: allUserIds.length }, `Broadcast envoyé à ${allUserIds.length} utilisateur(s)`);
  } catch (err) {
    next(err);
  }
}
