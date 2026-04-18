import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import * as controller from "./analytics.controller.js";

const router: import("express").Router = Router();

// ─── Admin (sa marque) ────────────────────────────────────────────────────────
router.get("/dashboard",    authenticate, requireRole("admin"), controller.getDashboard);
router.get("/branches",     authenticate, requireRole("admin"), controller.getBranchesStats);
router.get("/orders-stats", authenticate, requireRole("admin", "superadmin"), controller.getOrdersStats);
router.get("/top-products", authenticate, requireRole("admin", "superadmin"), controller.getTopProducts);
router.get("/revenue",      authenticate, requireRole("admin", "superadmin"), controller.getRevenue);

// ─── Analytiques par agence ───────────────────────────────────────────────────
router.get("/branch/:branch_id", authenticate, requireRole("admin", "superadmin"), controller.getBranchStats);

// ─── Super Admin uniquement ───────────────────────────────────────────────────
router.get("/platform",    authenticate, requireRole("superadmin"), controller.getPlatformStats);
router.get("/commissions", authenticate, requireRole("superadmin"), controller.getCommissionsOverview);

export default router;
