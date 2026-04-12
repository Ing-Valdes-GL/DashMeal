import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";

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

    const { data, error } = await supabase
      .from("branches")
      .insert({ ...req.body, brand_id })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "CREATE_ERROR", "Échec de création");
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
