import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import bcrypt from "bcryptjs";

export async function applyForBrand(req: Request, res: Response, next: NextFunction) {
  try {
    const { brand_name, contact_email, contact_phone } = req.body;

    const { data: existing, error: existingErr } = await supabase
      .from("brand_applications")
      .select("id, status")
      .or(`contact_email.eq.${contact_email},contact_phone.eq.${contact_phone}`)
      .limit(1);

    if (existingErr) {
      console.error("Supabase pre-check error (brand_applications):", {
        code: existingErr.code,
        message: existingErr.message,
        details: existingErr.details,
        hint: existingErr.hint,
      });
      throw new AppError(500, "APPLICATION_ERROR", "Error while checking existing application");
    }

    if (existing && existing.length > 0) {
      throw new AppError(
        409,
        "APPLICATION_ALREADY_EXISTS",
        "An application already exists with this email or phone"
      );
    }

    const { data, error } = await supabase
      .from("brand_applications")
      .insert({ brand_name, contact_email, contact_phone, status: "pending" })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error (brand_applications):", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      if (error.code === "23505") {
        throw new AppError(
          409,
          "APPLICATION_ALREADY_EXISTS",
          "An application already exists with this email or phone"
        );
      }

      if (error.code === "42P01") {
        throw new AppError(
          500,
          "BRAND_APPLICATIONS_TABLE_MISSING",
          "Table brand_applications is missing in Supabase"
        );
      }

      if (error.code === "42501") {
        throw new AppError(
          500,
          "SUPABASE_PERMISSION_ERROR",
          "Supabase permission denied on brand_applications"
        );
      }

      throw new AppError(500, "APPLICATION_ERROR", "Failed to submit application");
    }

    sendCreated(res, data, "Application submitted. Our team will contact you soon.");
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
    if (error) throw new AppError(500, "FETCH_ERROR", "Error while fetching applications");

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

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Application not found");

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

    if (!app) throw new AppError(404, "NOT_FOUND", "Application not found");
    if (app.status !== "pending") {
      throw new AppError(400, "ALREADY_REVIEWED", "This application has already been reviewed");
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
      const { data: brand } = await supabase
        .from("brands")
        .insert({
          name: app.brand_name,
          is_active: true,
        })
        .select()
        .single();

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

      sendSuccess(res, { brand, temp_password: tempPassword }, "Brand approved");
    } else {
      sendSuccess(res, { status }, "Application rejected");
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

    if (error) throw new AppError(500, "FETCH_ERROR", "Error while fetching brands");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getBrand(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === "admin" && req.user.brand_id !== req.params.id) {
      throw new AppError(403, "FORBIDDEN", "Access denied");
    }

    const { data, error } = await supabase
      .from("brands")
      .select("*, branches(*)")
      .eq("id", req.params.id)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Brand not found");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateBrand(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === "admin" && req.user.brand_id !== req.params.id) {
      throw new AppError(403, "FORBIDDEN", "Access denied");
    }

    const { data, error } = await supabase
      .from("brands")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Brand not found");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function suspendBrand(req: Request, res: Response, next: NextFunction) {
  try {
    await supabase.from("brands").update({ is_active: false }).eq("id", req.params.id);
    await supabase.from("admins").update({ is_active: false }).eq("brand_id", req.params.id);
    sendSuccess(res, null, "Brand suspended");
  } catch (err) {
    next(err);
  }
}
