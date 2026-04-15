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

export async function getBranchStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { branch_id } = req.params;

    // Vérifier l'accès : admin ne peut voir que ses propres agences
    if (req.user!.role === "admin") {
      const { data: branch } = await supabase.from("branches").select("brand_id").eq("id", branch_id).single();
      if (!branch || branch.brand_id !== req.user!.brand_id) {
        throw new AppError(403, "FORBIDDEN", "Accès refusé à cette agence");
      }
    }

    const [
      { count: totalOrders },
      { count: pendingOrders },
      { count: todayOrders },
      { data: revenueData },
      { data: statusData },
    ] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact" }).eq("branch_id", branch_id),
      supabase.from("orders").select("id", { count: "exact" }).eq("branch_id", branch_id).eq("status", "pending"),
      supabase.from("orders").select("id", { count: "exact" })
        .eq("branch_id", branch_id)
        .gte("created_at", new Date().toISOString().split("T")[0] + "T00:00:00"),
      supabase.from("orders").select("total").eq("branch_id", branch_id).eq("status", "delivered"),
      supabase.from("orders").select("status").eq("branch_id", branch_id),
    ]);

    const totalRevenue = (revenueData ?? []).reduce((s: number, o: any) => s + (o.total ?? 0), 0);

    // Compter par statut
    const byStatus: Record<string, number> = {};
    for (const o of (statusData ?? [])) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }

    sendSuccess(res, {
      total_orders: totalOrders ?? 0,
      pending_orders: pendingOrders ?? 0,
      today_orders: todayOrders ?? 0,
      total_revenue: Math.round(totalRevenue),
      by_status: byStatus,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPlatformStats(req: Request, res: Response, next: NextFunction) {
  try {
    const [
      { count: activeBrands },
      { count: suspendedBrands },
      { count: totalUsers },
      { count: verifiedUsers },
      { count: totalOrders },
      { count: todayOrders },
      { count: deliveringOrders },
      { data: commissionsData },
      { count: pendingApplications },
      { count: approvedApplications },
      { count: rejectedApplications },
    ] = await Promise.all([
      supabase.from("brands").select("id", { count: "exact" }).eq("is_active", true),
      supabase.from("brands").select("id", { count: "exact" }).eq("is_active", false),
      supabase.from("users").select("id", { count: "exact" }),
      supabase.from("users").select("id", { count: "exact" }).eq("is_verified", true),
      supabase.from("orders").select("id", { count: "exact" }),
      supabase.from("orders").select("id", { count: "exact" }).gte("created_at", new Date().toISOString().split("T")[0] + "T00:00:00"),
      supabase.from("orders").select("id", { count: "exact" }).eq("status", "delivering"),
      supabase.from("commissions").select("amount, is_settled, type"),
      supabase.from("brand_applications").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("brand_applications").select("id", { count: "exact" }).eq("status", "approved"),
      supabase.from("brand_applications").select("id", { count: "exact" }).eq("status", "rejected"),
    ]);

    const commissions = (commissionsData ?? []) as { amount: number; is_settled: boolean; type: string }[];
    const gmvOnline = commissions.filter(c => c.type === "online").reduce((s, c) => s + (c.amount / 0.02), 0);
    const gmvInperson = commissions.filter(c => c.type === "inperson").reduce((s, c) => s + (c.amount / 0.015), 0);
    const commTotal = commissions.reduce((s, c) => s + c.amount, 0);
    const commSettled = commissions.filter(c => c.is_settled).reduce((s, c) => s + c.amount, 0);
    const commPending = commissions.filter(c => !c.is_settled).reduce((s, c) => s + c.amount, 0);

    sendSuccess(res, {
      brands: {
        total: (activeBrands ?? 0) + (suspendedBrands ?? 0),
        active: activeBrands ?? 0,
        suspended: suspendedBrands ?? 0,
      },
      users: {
        total: totalUsers ?? 0,
        verified: verifiedUsers ?? 0,
      },
      orders: {
        total: totalOrders ?? 0,
        today: todayOrders ?? 0,
        delivering: deliveringOrders ?? 0,
      },
      revenue: {
        gmv_total: Math.round(gmvOnline + gmvInperson),
        gmv_online: Math.round(gmvOnline),
        gmv_inperson: Math.round(gmvInperson),
      },
      commissions: {
        total: Math.round(commTotal),
        pending: Math.round(commPending),
        settled: Math.round(commSettled),
      },
      applications: {
        pending: pendingApplications ?? 0,
        approved: approvedApplications ?? 0,
        rejected: rejectedApplications ?? 0,
      },
      gmv_by_day: [],
      top_brands: [],
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
