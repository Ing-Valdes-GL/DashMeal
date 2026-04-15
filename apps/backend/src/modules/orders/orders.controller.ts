import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { generateQrCode } from "../../utils/qrcode.js";
import { campayCollect } from "../../services/campay.js";
import { notifyOrderStatus } from "../../utils/push.js";

// ─── Création unifiée avec items + paiement Campay ───────────────────────────
export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      branch_id, type, items,
      slot_id, delivery_address, delivery_lat, delivery_lng, delivery_phone,
      payment_method, payment_phone, notes,
    } = req.body;

    const user_id = req.user!.id;

    // ── Calculer le total depuis les produits ─────────────────────────────────
    let subtotal = 0;
    const orderItems: Array<{ product_id: string; variant_id: string | null; quantity: number; unit_price: number; subtotal: number }> = [];

    for (const item of items as Array<{ product_id: string; quantity: number; variant_id?: string }>) {
      const { data: product } = await supabase
        .from("products")
        .select("price")
        .eq("id", item.product_id)
        .single();

      if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", `Produit introuvable: ${item.product_id}`);

      const unit_price = product.price;
      const sub = unit_price * item.quantity;
      subtotal += sub;
      orderItems.push({ product_id: item.product_id, variant_id: item.variant_id ?? null, quantity: item.quantity, unit_price, subtotal: sub });
    }

    const delivery_fee = type === "delivery" ? 500 : 0;
    const total = subtotal + delivery_fee;

    // ── Créer la commande ─────────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({ user_id, branch_id, type, status: "pending", subtotal, delivery_fee, total, notes: notes ?? null })
      .select()
      .single();

    if (orderErr || !order) throw new AppError(500, "CREATE_ORDER_ERROR", "Échec création commande");

    // ── Insérer les articles ──────────────────────────────────────────────────
    await supabase.from("order_items").insert(orderItems.map((i) => ({ ...i, order_id: order.id })));

    // ── Enregistrements type-spécifiques ─────────────────────────────────────
    if (type === "collect" && slot_id) {
      const qr_code = await generateQrCode(order.id);
      await supabase.rpc("increment_slot_booking", { slot_id });
      await supabase.from("collect_orders").insert({ order_id: order.id, slot_id, qr_code, pickup_status: "waiting" });
    } else if (type === "delivery") {
      await supabase.from("deliveries").insert({
        order_id: order.id,
        address: delivery_address,
        lat: delivery_lat ?? null,
        lng: delivery_lng ?? null,
        phone: delivery_phone ?? null,
        status: "pending",
      });
    }

    // ── Initier le paiement Campay ────────────────────────────────────────────
    let payment_reference: string | null = null;
    let ussd_code: string | null = null;
    let operator: string | null = null;

    try {
      const campayData = await campayCollect({
        amount: total,
        phone: payment_phone,
        description: `DashMeal #${order.id.slice(0, 8)}`,
        externalReference: order.id,
      });

      payment_reference = campayData.reference;
      ussd_code = campayData.ussd_code ?? null;
      operator = campayData.operator ?? null;

      await supabase.from("payments").insert({
        order_id: order.id,
        method: payment_method,
        amount: total,
        status: "pending",
        provider_ref: payment_reference,
        provider: "campay",
        operator,
      });
    } catch (campayErr) {
      console.error("Campay initiation failed:", campayErr);
      // Commande créée même si Campay échoue — l'utilisateur peut réessayer
    }

    sendCreated(res, { order_id: order.id, total, payment_reference, ussd_code, operator });
  } catch (err) {
    next(err);
  }
}

export async function createCollectOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { branch_id, slot_id, notes, promotion_code } = req.body;
    const user_id = req.user!.id;

    const order = await buildAndCreateOrder(user_id, branch_id, "collect", notes, promotion_code);

    // Réserver le créneau
    await supabase.rpc("increment_slot_booking", { slot_id });

    // Générer QR code
    const qr_code = await generateQrCode(order.id);

    await supabase.from("collect_orders").insert({
      order_id: order.id,
      slot_id,
      qr_code,
      pickup_status: "waiting",
    });

    sendCreated(res, { ...order, qr_code });
  } catch (err) {
    next(err);
  }
}

export async function createDeliveryOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { branch_id, delivery_address, delivery_lat, delivery_lng, notes, promotion_code } = req.body;
    const user_id = req.user!.id;

    const order = await buildAndCreateOrder(user_id, branch_id, "delivery", notes, promotion_code);

    await supabase.from("deliveries").insert({
      order_id: order.id,
      address: delivery_address,
      lat: delivery_lat,
      lng: delivery_lng,
      status: "assigned",
    });

    sendCreated(res, order);
  } catch (err) {
    next(err);
  }
}

export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, branch_id, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from("orders")
      .select("*, users(name, phone), branches(name), order_items(*, products(name_fr))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (req.user?.role === "admin") {
      query = query.eq("branches.brand_id", req.user.brand_id!);
    }
    if (status) query = query.eq("status", status);
    if (branch_id) query = query.eq("branch_id", branch_id);

    const { data, count, error } = await query;
    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");

    res.json({
      success: true,
      data: data ?? [],
      pagination: { page: pageNum, limit: limitNum, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limitNum) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*, products(name_fr, name_en, product_images(url, is_primary))), users(name, phone), branches(name, address)")
      .eq("id", req.params.id)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Commande introuvable");

    // Vérifier que l'utilisateur a accès à cette commande
    if (req.user?.role === "user" && data.user_id !== req.user.id) {
      throw new AppError(403, "FORBIDDEN", "Accès refusé");
    }

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getUserOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, branches(name, brands(name, logo_url)), order_items(quantity, unit_price, products(name_fr))")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, note } = req.body;
    const orderId = req.params.id as string;

    const { data: order } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .select("id, user_id")
      .single();

    await supabase.from("order_status_history").insert({
      order_id: orderId,
      status,
      changed_by: req.user!.id,
      changed_by_role: req.user!.role,
      note: note ?? null,
    });

    // Notification push selon le nouveau statut
    if (order?.user_id) {
      notifyOrderStatus(order.user_id, orderId, status, orderId).catch(() => {});
    }

    sendSuccess(res, { status }, "Statut mis à jour");
  } catch (err) {
    next(err);
  }
}

export async function assignDriver(req: Request, res: Response, next: NextFunction) {
  try {
    await supabase
      .from("deliveries")
      .update({ driver_id: req.body.driver_id, status: "assigned" })
      .eq("order_id", req.params.id);

    sendSuccess(res, null, "Livreur assigné");
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { data: order } = await supabase
      .from("orders")
      .select("status, user_id")
      .eq("id", req.params.id)
      .single();

    if (!order) throw new AppError(404, "NOT_FOUND", "Commande introuvable");

    if (req.user?.role === "user" && order.user_id !== req.user.id) {
      throw new AppError(403, "FORBIDDEN", "Accès refusé");
    }

    if (!["pending", "confirmed"].includes(order.status)) {
      throw new AppError(400, "CANNOT_CANCEL", "Cette commande ne peut plus être annulée");
    }

    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", req.params.id);

    sendSuccess(res, null, "Commande annulée");
  } catch (err) {
    next(err);
  }
}

// ─── Helper privé ─────────────────────────────────────────────────────────────

async function buildAndCreateOrder(
  user_id: string,
  branch_id: string,
  type: "collect" | "delivery",
  notes?: string,
  promotion_code?: string
) {
  const { data: cart } = await supabase
    .from("carts")
    .select("id, cart_items(product_id, variant_id, quantity, products(price), product_variants(price_modifier))")
    .eq("user_id", user_id)
    .eq("branch_id", branch_id)
    .single();

  if (!cart || !cart.cart_items?.length) {
    throw new AppError(400, "EMPTY_CART", "Le panier est vide");
  }

  // Calculer le total
  let subtotal = 0;
  const items: Array<{ product_id: string; variant_id: string | null; quantity: number; unit_price: number; subtotal: number }> = [];

  for (const item of cart.cart_items as Array<Record<string, unknown>>) {
    const basePrice = (item.products as Record<string, number>).price;
    const modifier = (item.product_variants as Record<string, number> | null)?.price_modifier ?? 0;
    const unit_price = basePrice + modifier;
    const sub = unit_price * (item.quantity as number);
    subtotal += sub;
    items.push({
      product_id: item.product_id as string,
      variant_id: (item.variant_id as string | null),
      quantity: item.quantity as number,
      unit_price,
      subtotal: sub,
    });
  }

  // Appliquer promotion si fournie
  // TODO: valider promotion_code

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id,
      branch_id,
      type,
      status: "pending",
      subtotal,
      delivery_fee: type === "delivery" ? 500 : 0, // TODO: calculer selon zone
      total: subtotal + (type === "delivery" ? 500 : 0),
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error || !order) throw new AppError(500, "CREATE_ORDER_ERROR", "Échec création commande");

  // Insérer les lignes
  await supabase.from("order_items").insert(
    items.map((item) => ({ ...item, order_id: order.id }))
  );

  // Vider le panier
  await supabase.from("cart_items").delete().eq("cart_id", cart.id);

  return order;
}
