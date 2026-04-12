import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { BrandApplicationSchema, ReviewApplicationSchema } from "@dash-meal/shared";
import * as controller from "./brands.controller.js";

const router: import("express").Router = Router();

// ─── Public : soumettre une demande d'accès ───────────────────────────────────
router.post("/apply", validate(BrandApplicationSchema), controller.applyForBrand);

// ─── Super Admin uniquement ───────────────────────────────────────────────────
router.get("/", authenticate, requireRole("superadmin"), controller.listBrands);
router.get("/applications", authenticate, requireRole("superadmin"), controller.listApplications);
router.get("/applications/:id", authenticate, requireRole("superadmin"), controller.getApplication);
router.post("/applications/:id/review", authenticate, requireRole("superadmin"), validate(ReviewApplicationSchema), controller.reviewApplication);
router.patch("/:id/suspend", authenticate, requireRole("superadmin"), controller.suspendBrand);

// ─── Admin (sa propre marque) ─────────────────────────────────────────────────
router.get("/:id", authenticate, requireRole("admin", "superadmin"), controller.getBrand);
router.patch("/:id", authenticate, requireRole("admin", "superadmin"), controller.updateBrand);

export default router;
