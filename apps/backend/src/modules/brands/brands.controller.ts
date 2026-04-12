import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { COMMISSION_RATE_ONLINE, COMMISSION_RATE_INPERSON } from "@dash-meal/shared";
import bcrypt from "bcryptjs";

export async function applyForBrand(req: Request, res: Response, next: NextFunction) {
  try {
    const { brand_name, contact_email, contact_phone } = req.body;

    const { data, error } = await supabase
      .from("brand_applications")
      .insert({ brand_name, contact_email, contact_phone, status: "pending" })
      .select()
      .single();

    if (error) throw new AppError(500, "APPLICATION_ERROR", "Échec de la soumission");

    sendCreated(res, data, "Demande soumise. Notre équipe vous contactera sous 48h.");
  } catch (err) {
    next(err);
  }
}

export async function listApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.query;
    let query = supabase
      .from("brand_applications")
      .select("*, brand_documents(*)")
      .order("submitted_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("brand_applications")
      .select("*, brand_documents(*)")
      .eq("id", req.params.id)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Demande introuvable");

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function reviewApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    const { data: app } = await supabase
      .from("brand_applications")
      .select("*")
      .eq("id", id)
      .single();

    if (!app) throw new AppError(404, "NOT_FOUND", "Demande introuvable");
    if (app.status !== "pending") {
      throw new AppError(400, "ALREADY_REVIEWED", "Cette demande a déjà été traitée");
    }

    await supabase
      .from("brand_applications")
      .update({
        status,
        rejection_reason: rejection_reason ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user!.id,
      })
      .eq("id", id);

    if (status === "approved") {
      // Créer la marque et l'admin
      const { data: brand } = await supabase
        .from("brands")
        .insert({
          name: app.brand_name,
          is_active: true,
        })
        .select()
        .single();

      // Générer un mot de passe temporaire
      const tempPassword = Math.random().toString(36).slice(-10);
      const password_hash = await bcrypt.hash(tempPassword, 12);

      await supabase.from("admins").insert({
        username: app.brand_name.toLowerCase().replace(/\s+/g, "_"),
        email: app.contact_email,
        phone: app.contact_phone,
        password_hash,
        brand_id: brand!.id,
        role: "admin",
        is_active: true,
      });

      // TODO: Envoyer les identifiants par email/SMS
      sendSuccess(res, { brand, temp_password: tempPassword }, "Marque approuvée");
    } else {
      sendSuccess(res, { status }, "Demande rejetée");
    }
  } catch (err) {
    next(err);
  }
}

export async function listBrands(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getBrand(req: Request, res: Response, next: NextFunction) {
  try {
    // Un admin ne peut voir que sa propre marque
    if (req.user?.role === "admin" && req.user.brand_id !== req.params.id) {
      throw new AppError(403, "FORBIDDEN", "Accès refusé");
    }

    const { data, error } = await supabase
      .from("brands")
      .select("*, branches(*)")
      .eq("id", req.params.id)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Marque introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateBrand(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === "admin" && req.user.brand_id !== req.params.id) {
      throw new AppError(403, "FORBIDDEN", "Accès refusé");
    }

    const { data, error } = await supabase
      .from("brands")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Marque introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function suspendBrand(req: Request, res: Response, next: NextFunction) {
  try {
    await supabase
      .from("brands")
      .update({ is_active: false })
      .eq("id", req.params.id);

    await supabase
      .from("admins")
      .update({ is_active: false })
      .eq("brand_id", req.params.id);

    sendSuccess(res, null, "Marque suspendue");
  } catch (err) {
    next(err);
  }
}
