import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";

export async function getConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params;

    const { data, error } = await supabase
      .from("conversations")
      .select("*, messages(count)")
      .eq("order_id", orderId);

    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversationId } = req.params;
    const { page = "1", limit = "50" } = req.query as Record<string, string>;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const { data, count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, { messages: data, total: count });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      throw new AppError(400, "EMPTY_MESSAGE", "Le message ne peut pas être vide");
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: req.user!.id,
        sender_role: req.user!.role,
        content: content.trim(),
        is_read: false,
      })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "SEND_ERROR", "Échec d'envoi du message");

    // Supabase Realtime diffuse automatiquement le changement aux abonnés
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", req.params.conversationId)
      .neq("sender_id", req.user!.id);

    sendSuccess(res, null, "Messages marqués comme lus");
  } catch (err) {
    next(err);
  }
}
