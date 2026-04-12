import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../middleware/errorHandler.js";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response.js";

export async function searchProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { q, category_id, branch_id, min_price, max_price, in_stock, page = 1, limit = 20 } = req.query as Record<string, string>;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from("products")
      .select(`
        *,
        product_images(url, is_primary),
        product_variants(*),
        branch_stock!inner(stock_qty)
      `, { count: "exact" })
      .eq("is_active", true)
      .eq("branch_stock.branch_id", branch_id)
      .range(offset, offset + limitNum - 1);

    if (q) query = query.ilike("name_fr", `%${q}%`);
    if (category_id) query = query.eq("category_id", category_id);
    if (min_price) query = query.gte("price", Number(min_price));
    if (max_price) query = query.lte("price", Number(max_price));
    if (in_stock === "true") query = query.gt("branch_stock.stock_qty", 0);

    const { data, count, error } = await query;
    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la recherche");

    sendPaginated(res, data ?? [], count ?? 0, pageNum, limitNum);
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(*), product_variants(*), categories(name_fr, name_en)")
      .eq("id", req.params.id)
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Produit introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const brand_id = req.user!.role === "superadmin" ? req.body.brand_id : req.user!.brand_id;

    const { data, error } = await supabase
      .from("products")
      .insert({ ...req.body, brand_id })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "CREATE_ERROR", "Échec de création");
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("products")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) throw new AppError(404, "NOT_FOUND", "Produit introuvable");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    await supabase.from("products").update({ is_active: false }).eq("id", req.params.id);
    sendSuccess(res, null, "Produit désactivé");
  } catch (err) {
    next(err);
  }
}

export async function createVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .insert({ ...req.body, product_id: req.params.id })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "CREATE_ERROR", "Échec de création");
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { branch_id, product_id, variant_id, stock_qty } = req.body;

    const { data, error } = await supabase
      .from("branch_stock")
      .upsert({ branch_id, product_id, variant_id: variant_id ?? null, stock_qty, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "STOCK_UPDATE_ERROR", "Échec mise à jour stock");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getStockByBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("branch_stock")
      .select("*, branches(name)")
      .eq("product_id", req.params.id);

    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const { brand_id } = req.query;
    let query = supabase.from("categories").select("*").order("sort_order");

    if (brand_id) {
      query = query.or(`brand_id.eq.${brand_id},brand_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw new AppError(500, "FETCH_ERROR", "Erreur lors de la récupération");
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const brand_id = req.user!.role === "superadmin" ? null : req.user!.brand_id;
    const { data, error } = await supabase
      .from("categories")
      .insert({ ...req.body, brand_id })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "CREATE_ERROR", "Échec de création");
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
}
