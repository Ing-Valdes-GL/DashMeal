import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import type { BranchType } from "@dash-meal/shared";

const DEFAULT_CATEGORIES: Record<BranchType, { name_fr: string; name_en: string; icon: string; sort_order: number }[]> = {
  supermarket: [
    { name_fr: "Épicerie", name_en: "Grocery", icon: "🛒", sort_order: 1 },
    { name_fr: "Boissons", name_en: "Beverages", icon: "🥤", sort_order: 2 },
    { name_fr: "Produits laitiers", name_en: "Dairy", icon: "🥛", sort_order: 3 },
    { name_fr: "Viandes & Poissons", name_en: "Meat & Fish", icon: "🥩", sort_order: 4 },
    { name_fr: "Fruits & Légumes", name_en: "Fruits & Vegetables", icon: "🥦", sort_order: 5 },
    { name_fr: "Boulangerie", name_en: "Bakery", icon: "🥖", sort_order: 6 },
    { name_fr: "Surgelés", name_en: "Frozen", icon: "❄️", sort_order: 7 },
    { name_fr: "Hygiène", name_en: "Hygiene", icon: "🧴", sort_order: 8 },
    { name_fr: "Ménager", name_en: "Household", icon: "🧹", sort_order: 9 },
  ],
  superette: [
    { name_fr: "Épicerie", name_en: "Grocery", icon: "🛒", sort_order: 1 },
    { name_fr: "Boissons", name_en: "Beverages", icon: "🥤", sort_order: 2 },
    { name_fr: "Snacks", name_en: "Snacks", icon: "🍿", sort_order: 3 },
    { name_fr: "Hygiène", name_en: "Hygiene", icon: "🧴", sort_order: 4 },
    { name_fr: "Boulangerie", name_en: "Bakery", icon: "🥖", sort_order: 5 },
  ],
  restaurant: [
    { name_fr: "Entrées", name_en: "Starters", icon: "🥗", sort_order: 1 },
    { name_fr: "Plats principaux", name_en: "Main dishes", icon: "🍽️", sort_order: 2 },
    { name_fr: "Desserts", name_en: "Desserts", icon: "🍰", sort_order: 3 },
    { name_fr: "Boissons", name_en: "Beverages", icon: "🥤", sort_order: 4 },
    { name_fr: "Menus", name_en: "Menus", icon: "📋", sort_order: 5 },
  ],
  cafe: [
    { name_fr: "Boissons chaudes", name_en: "Hot drinks", icon: "☕", sort_order: 1 },
    { name_fr: "Boissons froides", name_en: "Cold drinks", icon: "🧊", sort_order: 2 },
    { name_fr: "Viennoiseries", name_en: "Pastries", icon: "🥐", sort_order: 3 },
    { name_fr: "Snacks", name_en: "Snacks", icon: "🍿", sort_order: 4 },
  ],
  bakery: [
    { name_fr: "Pains", name_en: "Bread", icon: "🍞", sort_order: 1 },
    { name_fr: "Viennoiseries", name_en: "Pastries", icon: "🥐", sort_order: 2 },
    { name_fr: "Gâteaux", name_en: "Cakes", icon: "🎂", sort_order: 3 },
    { name_fr: "Boissons", name_en: "Beverages", icon: "🥤", sort_order: 4 },
  ],
  pharmacy: [
    { name_fr: "Médicaments", name_en: "Medicines", icon: "💊", sort_order: 1 },
    { name_fr: "Hygiène", name_en: "Hygiene", icon: "🧴", sort_order: 2 },
    { name_fr: "Cosmétiques", name_en: "Cosmetics", icon: "💄", sort_order: 3 },
    { name_fr: "Bébé", name_en: "Baby", icon: "👶", sort_order: 4 },
  ],
  other: [
    { name_fr: "Produits", name_en: "Products", icon: "📦", sort_order: 1 },
  ],
};

export async function listBranches(req: Request, res: Response, next: NextFunction) {
  try {
    const brand_id = req.user!.role === "superadmin"
      ? (req.query.brand_id as string | undefined)
      : req.user!.brand_id;

    let query = supabase
      .from("branches")
      .select("*, brands(id, name, logo_url)")
      .order("created_at", { ascending: false });

    if (brand_id) query = query.eq("brand_id", brand_id);

    const { data, error } = await query;
    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function getNearbyBranches(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng, radius_km = 20, brand_id } = req.query;

    // TODO: Utiliser PostGIS ou calcul Haversine pour filtrer par distance
    // Pour l'instant, retourner toutes les agences actives
    let query = supabase
      .from("branches")
      .select("*, brands(id, name, logo_url)")
      .eq("is_active", true);

    if (brand_id) query = query.eq("brand_id", brand_id);

    const { data, error } = await query;
    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("branches")
      .select("*, brands(id, name, logo_url)")
      .eq("id", req.params.id)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Agence introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const brand_id = req.user!.role === "superadmin"
      ? req.body.brand_id
      : req.user!.brand_id;

    const branchType: BranchType = req.body.type ?? "other";

    const { data, error } = await supabase
      .from("branches")
      .insert({ ...req.body, brand_id })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "CREATE_ERROR", "Échec de création");

    // Créer les catégories par défaut selon le type d'établissement
    const defaultCats = DEFAULT_CATEGORIES[branchType] ?? DEFAULT_CATEGORIES.other;
    if (defaultCats.length > 0) {
      await supabase.from("categories").insert(
        defaultCats.map((c) => ({ ...c, branch_id: data.id }))
      );
    }

    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("branches")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Agence introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function deleteBranch(req: Request, res: Response, next: NextFunction) {
  try {
    await supabase
      .from("branches")
      .update({ is_active: false })
      .eq("id", req.params.id);

    sendSuccess(res, null, "Agence désactivée");
  } catch (err) {
    next(err);
  }
}

export async function getTimeSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const { date } = req.query;
    let query = supabase
      .from("time_slots")
      .select("*")
      .eq("branch_id", req.params.id)
      .filter("booked", "lt", "capacity"); // créneaux non complets

    if (date) query = query.eq("date", date);

    const { data, error } = await query.order("start_time");
    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createTimeSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("time_slots")
      .insert({ ...req.body, booked: 0 })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "CREATE_ERROR", "Échec de création");
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createDeliveryZone(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("delivery_zones")
      .insert(req.body)
      .select()
      .single();

    if (error || !data) throw new AppError(500, "CREATE_ERROR", "Échec de création");
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryZones(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("branch_id", req.params.id)
      .eq("is_active", true);

    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}
