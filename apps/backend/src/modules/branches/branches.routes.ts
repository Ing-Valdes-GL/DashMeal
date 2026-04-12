import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { CreateBranchSchema, UpdateBranchSchema, CreateDeliveryZoneSchema } from "@dash-meal/shared";
import * as controller from "./branches.controller.js";

const router: import("express").Router = Router();

// ─── Public : agences proches (pour l'app mobile) ─────────────────────────────
router.get("/nearby", controller.getNearbyBranches);
router.get("/:id", controller.getBranch);
router.get("/:id/time-slots", controller.getTimeSlots);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.post("/", authenticate, requireRole("admin", "superadmin"), validate(CreateBranchSchema), controller.createBranch);
router.patch("/:id", authenticate, requireRole("admin", "superadmin"), validate(UpdateBranchSchema), controller.updateBranch);
router.delete("/:id", authenticate, requireRole("admin", "superadmin"), controller.deleteBranch);

// Créneaux Click & Collect
router.post("/time-slots", authenticate, requireRole("admin", "superadmin"), controller.createTimeSlot);

// Zones de livraison
router.post("/delivery-zones", authenticate, requireRole("admin", "superadmin"), validate(CreateDeliveryZoneSchema), controller.createDeliveryZone);
router.get("/:id/delivery-zones", controller.getDeliveryZones);

export default router;
