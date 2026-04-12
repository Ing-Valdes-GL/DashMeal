import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess } from "../../utils/response.js";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const brand_id = req.user!.role === "superadmin" ? (req.query.brand_id as string) : req.user!.brand_id!;
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Commandes du jour
    const { count: todayOrders } = await supabase
      .from("orders")
      .select("id", { count: "exact" })
      .gte("created_at", `${today}T00:00:00`)
      .eq("branches.brand_id", brand_id);

    // En attente
    const { count: pendingOrders } = await supabase
      .from("orders")
      .select("id", { count: "exact" })
      .eq("status", "pending");

    // Produits en rupture
    const { count: outOfStock } = await supabase
      .from("branch_stock")
      .select("id", { count: "exact" })
      .eq("stock_qty", 0);

    sendSuccess(res, {
      today_orders: todayOrders ?? 0,
      pending_orders: pendingOrders ?? 0,
      out_of_stock: outOfStock ?? 0,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrdersStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { period = "week" } = req.query;
    // TODO: Requêtes SQL agrégées selon la période
    sendSuccess(res, { period, stats: [] });
  } catch (err) {
    next(err);
  }
}

export async function getTopProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("order_items")
      .select("product_id, quantity, products(name_fr)")
      .limit(10);

    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getRevenue(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO: Agrégation par période
    sendSuccess(res, { revenue: 0 });
  } catch (err) {
    next(err);
  }
}

export async function getPlatformStats(req: Request, res: Response, next: NextFunction) {
  try {
    const [
      { count: totalBrands },
      { count: totalUsers },
      { count: totalOrders },
    ] = await Promise.all([
      supabase.from("brands").select("id", { count: "exact" }).eq("is_active", true),
      supabase.from("users").select("id", { count: "exact" }),
      supabase.from("orders").select("id", { count: "exact" }),
    ]);

    sendSuccess(res, {
      total_brands: totalBrands ?? 0,
      total_users: totalUsers ?? 0,
      total_orders: totalOrders ?? 0,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCommissionsOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("commissions")
      .select("type, amount, is_settled, brands(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");

    const total_online = data.filter(c => c.type === "online").reduce((sum, c) => sum + c.amount, 0);
    const total_inperson = data.filter(c => c.type === "inperson").reduce((sum, c) => sum + c.amount, 0);
    const pending = data.filter(c => !c.is_settled).reduce((sum, c) => sum + c.amount, 0);

    sendSuccess(res, { total_online, total_inperson, pending_settlement: pending, entries: data });
  } catch (err) {
    next(err);
  }
}
