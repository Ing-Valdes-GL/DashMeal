import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import * as controller from "./analytics.controller.js";

const router: import("express").Router = Router();

// ─── Dashboard admin (sa marque) ─────────────────────────────────────────────
router.get("/dashboard", authenticate, requireRole("admin", "superadmin"), controller.getDashboard);
router.get("/orders-stats", authenticate, requireRole("admin", "superadmin"), controller.getOrdersStats);
router.get("/top-products", authenticate, requireRole("admin", "superadmin"), controller.getTopProducts);
router.get("/revenue", authenticate, requireRole("admin", "superadmin"), controller.getRevenue);

// ─── Super Admin uniquement ───────────────────────────────────────────────────
router.get("/platform", authenticate, requireRole("superadmin"), controller.getPlatformStats);
router.get("/commissions", authenticate, requireRole("superadmin"), controller.getCommissionsOverview);

export default router;
