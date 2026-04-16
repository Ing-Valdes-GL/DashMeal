import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess } from "../../utils/response.js";

export async function getDriverProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, phone, branch_id, brand_id, is_active, created_at, branches(name, address)")
      .eq("id", req.user!.id)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Livreur introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getMyDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.query as Record<string, string>;

    let query = supabase
      .from("deliveries")
      .select(`
        *,
        orders(id, total, status, notes, users(name, phone)),
        driver_positions(lat, lng, updated_at)
      `)
      .eq("driver_id", req.user!.id)
      .order("orders.created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select(`
        *,
        orders(
          id, total, status, notes,
          users(name, phone),
          order_items(quantity, unit_price, products(name_fr, name_en)),
          branches(name, address, lat, lng, phone)
        )
      `)
      .eq("id", req.params.id)
      .eq("driver_id", req.user!.id) // sécurité : livreur ne voit que ses livraisons
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Livraison introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateDeliveryStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, note } = req.body;

    const { data: delivery } = await supabase
      .from("deliveries")
      .select("id, order_id, driver_id, status")
      .eq("id", req.params.id)
      .single();

    if (!delivery) throw new AppError(404, "NOT_FOUND", "Livraison introuvable");

    // Le livreur ne peut mettre à jour que ses propres livraisons
    if (req.user?.role === "driver" && delivery.driver_id !== req.user.id) {
      throw new AppError(403, "FORBIDDEN", "Accès refusé");
    }

    const updates: Record<string, unknown> = { status };
    if (status === "picked_up") updates.started_at = new Date().toISOString();
    if (status === "delivered") updates.delivered_at = new Date().toISOString();

    await supabase.from("deliveries").update(updates).eq("id", req.params.id);

    // Synchroniser le statut de la commande
    const orderStatus = status === "delivered" ? "delivered"
      : status === "on_the_way" ? "delivering"
      : status === "failed" ? "cancelled"
      : undefined;

    if (orderStatus) {
      await supabase
        .from("orders")
        .update({ status: orderStatus })
        .eq("id", delivery.order_id);

      await supabase.from("order_status_history").insert({
        order_id: delivery.order_id,
        status: orderStatus,
        changed_by: req.user!.id,
        changed_by_role: req.user!.role,
        note: note ?? null,
      });
    }

    // TODO: Notifier l'utilisateur du changement de statut

    sendSuccess(res, { status }, "Statut de livraison mis à jour");
  } catch (err) {
    next(err);
  }
}

export async function updateDriverPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng } = req.body;

    // Upsert la position du livreur (une seule ligne par livraison)
    await supabase
      .from("driver_positions")
      .upsert({
        delivery_id: req.params.id,
        driver_id: req.user!.id,
        lat,
        lng,
        updated_at: new Date().toISOString(),
      });

    // Supabase Realtime diffuse automatiquement ce changement aux abonnés (ex: utilisateur qui track)

    sendSuccess(res, { lat, lng }, "Position mise à jour");
  } catch (err) {
    next(err);
  }
}

export async function trackDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    // Vérifier que la commande appartient à l'utilisateur
    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, status")
      .eq("id", req.params.orderId)
      .single();

    if (!order || order.user_id !== req.user!.id) {
      throw new AppError(404, "NOT_FOUND", "Commande introuvable");
    }

    const { data, error } = await supabase
      .from("deliveries")
      .select(`
        id, status, address, lat, lng, started_at, delivered_at,
        drivers(name, phone),
        driver_positions(lat, lng, updated_at)
      `)
      .eq("order_id", req.params.orderId)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Livraison introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function listDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, driver_id, branch_id, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from("deliveries")
      .select(`
        *,
        orders!inner(id, total, status, created_at, branch_id, users(name, phone)),
        drivers(name, phone)
      `, { count: "exact" })
      .order("orders.created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (status) query = query.eq("status", status);
    if (driver_id) query = query.eq("driver_id", driver_id);
    if (branch_id) query = query.eq("orders.branch_id", branch_id);

    // Restriction admin : seulement sa marque
    if (req.user?.role === "admin") {
      query = query.eq("orders.branches.brand_id", req.user.brand_id!);
    }

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
