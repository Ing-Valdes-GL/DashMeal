import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  CreateProductSchema,
  UpdateProductSchema,
  CreateProductVariantSchema,
  UpdateStockSchema,
  CreateCategorySchema,
  ProductSearchSchema,
  SetPromoSchema,
} from "@dash-meal/shared";
import * as controller from "./products.controller.js";

const router: import("express").Router = Router();

// ─── Public (mobile) ─────────────────────────────────────────────────────────
router.get("/search", validate(ProductSearchSchema, "query"), controller.searchProducts);
router.get("/categories", controller.listCategories);
router.get("/:id", controller.getProduct);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.get("/branch/:branch_id", authenticate, requireRole("admin", "superadmin"), controller.listByBranch);
router.post("/", authenticate, requireRole("admin", "superadmin"), validate(CreateProductSchema), controller.createProduct);
router.patch("/:id", authenticate, requireRole("admin", "superadmin"), validate(UpdateProductSchema), controller.updateProduct);
router.patch("/:id/toggle-hidden", authenticate, requireRole("admin", "superadmin"), controller.toggleHidden);
router.patch("/:id/promo", authenticate, requireRole("admin", "superadmin"), validate(SetPromoSchema), controller.setPromo);
router.delete("/:id", authenticate, requireRole("admin", "superadmin"), controller.deleteProduct);

// Variantes
router.post("/:id/variants", authenticate, requireRole("admin", "superadmin"), validate(CreateProductVariantSchema), controller.createVariant);

// Stock par agence
router.put("/stock", authenticate, requireRole("admin", "superadmin"), validate(UpdateStockSchema), controller.updateStock);
router.get("/:id/stock", authenticate, requireRole("admin", "superadmin"), controller.getStockByBranch);

// Catégories
router.post("/categories", authenticate, requireRole("admin", "superadmin"), validate(CreateCategorySchema), controller.createCategory);

export default router;
