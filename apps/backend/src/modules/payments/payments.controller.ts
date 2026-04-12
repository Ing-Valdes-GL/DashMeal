import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { env } from "../../config/env.js";
import {
  COMMISSION_RATE_ONLINE,
  COMMISSION_RATE_INPERSON,
} from "@dash-meal/shared";

export async function initiatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id, method, phone } = req.body;

    // Vérifier que la commande appartient à l'utilisateur
    const { data: order } = await supabase
      .from("orders")
      .select("id, total, user_id, branch_id, branches(brand_id)")
      .eq("id", order_id)
      .single();

    if (!order || order.user_id !== req.user!.id) {
      throw new AppError(404, "NOT_FOUND", "Commande introuvable");
    }

    if (method === "mobile_money") {
      if (!phone) throw new AppError(400, "PHONE_REQUIRED", "Numéro de téléphone requis");

      // Obtenir token Campay
      const tokenRes = await fetch(`${env.CAMPAY_BASE_URL}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: env.CAMPAY_APP_USERNAME,
          password: env.CAMPAY_APP_PASSWORD,
        }),
      });
      const { token } = await tokenRes.json() as { token: string };

      // Initier la collecte
      const collectRes = await fetch(`${env.CAMPAY_BASE_URL}/collect/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          amount: String(order.total),
          from: phone.replace(/^\+/, ""),
          description: `Commande Dash Meal #${order_id.slice(0, 8)}`,
          external_reference: order_id,
          redirect_url: env.CAMPAY_CALLBACK_URL,
        }),
      });

      const campayData = await collectRes.json() as { reference: string; ussd_code?: string };

      // Enregistrer le paiement en attente
      const { data: payment } = await supabase
        .from("payments")
        .insert({
          order_id,
          method: "mobile_money",
          amount: order.total,
          status: "pending",
          provider_ref: campayData.reference,
          provider: "campay",
        })
        .select()
        .single();

      sendCreated(res, { payment, ussd_code: campayData.ussd_code });
    } else if (method === "wallet") {
      // TODO: Implémentation portefeuille interne
      throw new AppError(501, "NOT_IMPLEMENTED", "Paiement par portefeuille bientôt disponible");
    }
  } catch (err) {
    next(err);
  }
}

export async function campayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const { reference, status, external_reference } = req.body;

    if (status === "SUCCESSFUL") {
      // Mettre à jour le paiement
      const { data: payment } = await supabase
        .from("payments")
        .update({ status: "paid" })
        .eq("provider_ref", reference)
        .select("*, orders(branch_id, total, branches(brand_id))")
        .single();

      if (payment) {
        // Mettre à jour la commande
        await supabase
          .from("orders")
          .update({ status: "confirmed" })
          .eq("id", external_reference);

        // Calculer et enregistrer la commission (2% en ligne)
        const brandId = (payment.orders as Record<string, Record<string, string>>).branches.brand_id;
        const commission = Math.round(payment.amount * COMMISSION_RATE_ONLINE);

        await supabase.from("commissions").insert({
          payment_id: payment.id,
          order_id: external_reference,
          brand_id: brandId,
          type: "online",
          rate: COMMISSION_RATE_ONLINE,
          amount: commission,
          is_settled: false,
        });

        // TODO: Notifier l'utilisateur et l'admin
      }
    } else if (status === "FAILED") {
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("provider_ref", reference);
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    next(err);
  }
}

export async function recordInPersonPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id, amount, reference } = req.body;

    const { data: order } = await supabase
      .from("orders")
      .select("id, total, branches(brand_id)")
      .eq("id", order_id)
      .single();

    if (!order) throw new AppError(404, "NOT_FOUND", "Commande introuvable");

    const { data: payment } = await supabase
      .from("payments")
      .insert({
        order_id,
        method: "cash_on_delivery",
        amount,
        status: "paid",
        provider_ref: reference ?? null,
        provider: "inperson",
      })
      .select()
      .single();

    // Mettre à jour la commande
    await supabase.from("orders").update({ status: "delivered" }).eq("id", order_id);

    // Commission 1,5% en présentiel
    const brandId = (order.branches as unknown as Record<string, string>).brand_id;
    const commission = Math.round(amount * COMMISSION_RATE_INPERSON);

    await supabase.from("commissions").insert({
      payment_id: payment!.id,
      order_id,
      brand_id: brandId,
      type: "inperson",
      rate: COMMISSION_RATE_INPERSON,
      amount: commission,
      is_settled: false,
    });

    sendSuccess(res, payment, "Paiement enregistré");
  } catch (err) {
    next(err);
  }
}

export async function getPaymentByOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", req.params.orderId)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Paiement introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}
